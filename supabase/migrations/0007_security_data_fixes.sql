-- =========================================================================
-- Tactic Corpus Builder — security & data-integrity fixes
--
-- Idempotent. Safe to re-run. Apply in the Supabase SQL editor after 0006.
--
--   1. profiles.role can no longer be changed by the user themself
--   2. admin_set_role: no race that leaves zero admins
--   3. admin_audit_log: no direct client inserts
--   4. event tables: value bounds, is_demo flag, learner insert on touchpoints
--   5. admin_lesson_funnel: fixed (was always failing)
--   6. admin_retention: real D+N cohorts, Europe/Paris day boundaries
--   7. admin_demo_status(): lets the UI flag demo data
--   8. corpus_lessons: new lessons default to 'draft'
--   9. corpus_resources.url: http(s) only
--  10. storage bucket 'resources': size / type limits, no public listing
--  11. AI usage quota (admin_ai_consume) used by the admin-ai edge function
--  12. missing indexes on lesson_events
-- =========================================================================

-- ─── 1. Lock profiles.role ────────────────────────────────────────────────
-- Clients (roles anon / authenticated) may update their own profile row for
-- coins, xp, etc., but never the role. Role changes go through
-- admin_set_role() (SECURITY DEFINER) or the service role (edge function).
-- A client write that tries to change the role keeps the current role
-- instead of failing, so a mobile "upsert the whole profile" keeps working.
-- NOTE: a signup trigger (handle_new_user) runs as its owner and is not
-- covered here — it must never copy `role` from raw_user_meta_data.
create or replace function public.profiles_guard_role()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.role := 'learner';
    elsif new.role is distinct from old.role then
      new.role := old.role;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role
  before insert or update on public.profiles
  for each row execute function public.profiles_guard_role();

-- ─── 2. admin_set_role without the last-admin race ────────────────────────
create or replace function public.admin_set_role(p_id uuid, p_role text)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_actor   uuid := auth.uid();
  v_email   text;
  v_target  text;
  v_admins  int;
begin
  -- Serialise role changes (taken before the admin check) so two
  -- concurrent calls cannot both pass the "last admin" check, and a caller
  -- demoted meanwhile is re-checked.
  perform pg_advisory_xact_lock(hashtext('tactic.admin_set_role'));

  if not public.is_admin() then
    raise exception 'Admin role required';
  end if;
  if p_role not in ('learner','ux','ped','data','admin') then
    raise exception 'Invalid role %', p_role;
  end if;

  select count(*) into v_admins from public.profiles where role = 'admin';
  if v_admins <= 1 and p_role <> 'admin'
     and exists (select 1 from public.profiles where id = p_id and role = 'admin') then
    raise exception 'Cannot remove the last admin';
  end if;

  update public.profiles set role = p_role where id = p_id
    returning email into v_target;
  if not found then
    raise exception 'Unknown member';
  end if;

  select email into v_email from public.profiles where id = v_actor;
  insert into public.admin_audit_log (actor_id, actor_email, action, target, detail)
  values (v_actor, v_email, 'set_role', coalesce(v_target, p_id::text),
          jsonb_build_object('role', p_role));

  return p_role;
end;
$$;
revoke all on function public.admin_set_role(uuid, text) from public;
grant execute on function public.admin_set_role(uuid, text) to authenticated;

-- ─── 3. Audit log: written only by SECURITY DEFINER functions / service role
drop policy if exists "audit_admin_insert" on public.admin_audit_log;

-- ─── 4. Event tables ──────────────────────────────────────────────────────
alter table public.lesson_events         add column if not exists is_demo boolean not null default false;
alter table public.trading_sim_results   add column if not exists is_demo boolean not null default false;
alter table public.marketing_touchpoints add column if not exists is_demo boolean not null default false;

-- Bounds. NOT VALID: existing rows are not re-checked, new rows are.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'lesson_events_bounds') then
    alter table public.lesson_events add constraint lesson_events_bounds
      check (step_index between 0 and 200 and seconds between 0 and 7200
             and created_at <= now() + interval '1 hour') not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'trading_sim_bounds') then
    alter table public.trading_sim_results add constraint trading_sim_bounds
      check (quiz_completion between 0 and 1 and pnl between -1000000 and 1000000) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'touchpoints_channel_len') then
    alter table public.marketing_touchpoints add constraint touchpoints_channel_len
      check (char_length(channel) <= 40) not valid;
  end if;
end $$;

-- Learners can only write real (non-demo), current rows for themselves.
-- The lower bound on created_at stops back-dated events that would inflate
-- retention.
drop policy if exists "lesson_events_owner_insert" on public.lesson_events;
create policy "lesson_events_owner_insert" on public.lesson_events
  for insert with check (
    auth.uid() = user_id and not is_demo
    and created_at >= now() - interval '10 minutes'
  );

drop policy if exists "trading_sim_owner_insert" on public.trading_sim_results;
create policy "trading_sim_owner_insert" on public.trading_sim_results
  for insert with check (
    auth.uid() = user_id and not is_demo
    and created_at >= now() - interval '10 minutes'
  );

-- marketing_touchpoints stays admin / service-role only: a learner must not
-- be able to record conversions. The mobile app should write them through a
-- server-side function.

-- ─── 5. admin_lesson_funnel (rewritten: was failing on every call) ────────
drop function if exists public.admin_lesson_funnel(text);
create function public.admin_lesson_funnel(p_lesson_id text)
returns table (step_index int, learners bigint)
language sql stable security definer set search_path = public
as $$
  with reached as (
    select e.user_id, max(e.step_index) as max_step
    from public.lesson_events e
    where e.lesson_id = p_lesson_id and public.is_admin()
    group by e.user_id
  )
  select s.step::int,
         (select count(*) from reached r where r.max_step >= s.step)::bigint
  from generate_series(0, (select coalesce(max(max_step), -1) from reached)) as s(step)
  order by s.step;
$$;
revoke all on function public.admin_lesson_funnel(text) from public;
grant execute on function public.admin_lesson_funnel(text) to authenticated;

-- ─── 6. admin_retention ───────────────────────────────────────────────────
-- D+N = share of learners, among those whose first activity is at least N
-- days old, who were active again on day N or later. Days are counted in
-- Europe/Paris time. `cohort` = learners whose first activity is at least
-- 7 days old (the D+7 denominator). Same signature as 0005.
create or replace function public.admin_retention()
returns table (d7 numeric, d30 numeric, cohort bigint)
language sql stable security definer set search_path = public
as $$
  with days as (
    select user_id, (created_at at time zone 'Europe/Paris')::date as day
    from public.lesson_events
    where public.is_admin() and user_id is not null
  ),
  firsts as (
    select user_id, min(day) as first_day, max(day) as last_day
    from days group by user_id
  ),
  today as (select (now() at time zone 'Europe/Paris')::date as d)
  select
    round(count(*) filter (where f.first_day <= t.d - 7  and f.last_day >= f.first_day + 7)::numeric
          / nullif(count(*) filter (where f.first_day <= t.d - 7), 0), 3),
    round(count(*) filter (where f.first_day <= t.d - 30 and f.last_day >= f.first_day + 30)::numeric
          / nullif(count(*) filter (where f.first_day <= t.d - 30), 0), 3),
    count(*) filter (where f.first_day <= t.d - 7)::bigint
  from firsts f cross join today t;
$$;
revoke all on function public.admin_retention() from public;
grant execute on function public.admin_retention() to authenticated;

-- ─── 7. Demo-data status ──────────────────────────────────────────────────
create or replace function public.admin_demo_status()
returns table (demo_rows bigint, real_rows bigint)
language sql stable security definer set search_path = public
as $$
  select
    (select count(*) from public.lesson_events where is_demo)
      + (select count(*) from public.trading_sim_results where is_demo)
      + (select count(*) from public.marketing_touchpoints where is_demo),
    (select count(*) from public.lesson_events where not is_demo)
      + (select count(*) from public.trading_sim_results where not is_demo)
      + (select count(*) from public.marketing_touchpoints where not is_demo)
  where public.is_admin();
$$;
revoke all on function public.admin_demo_status() from public;
grant execute on function public.admin_demo_status() to authenticated;

-- ─── 8. New lessons are drafts until someone publishes them ───────────────
alter table public.corpus_lessons alter column status set default 'draft';

-- ─── 9. Resource links: http(s) only ──────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'corpus_resources_url_http') then
    alter table public.corpus_resources add constraint corpus_resources_url_http
      check (url ~* '^https?://') not valid;
  end if;
end $$;

-- ─── 10. Storage bucket 'resources' ───────────────────────────────────────
-- Files stay downloadable through their public URL; listing the bucket is
-- no longer possible for anonymous users.
update storage.buckets
   set file_size_limit = 26214400,  -- 25 MB
       allowed_mime_types = array[
         'application/pdf',
         'image/png','image/jpeg','image/webp','image/gif',
         'audio/mpeg','audio/mp4','audio/x-m4a','audio/wav','audio/x-wav','audio/wave','audio/ogg',
         'text/plain','text/markdown'
       ]
 where id = 'resources';

drop policy if exists "resources_public_read" on storage.objects;
drop policy if exists "resources_admin_read" on storage.objects;
create policy "resources_admin_read" on storage.objects
  for select using (bucket_id = 'resources' and public.is_admin());

-- ─── 11. AI usage quota ───────────────────────────────────────────────────
create table if not exists public.admin_ai_usage (
  user_id  uuid not null,
  day      date not null,
  calls    int  not null default 0,
  primary key (user_id, day)
);
alter table public.admin_ai_usage enable row level security;
drop policy if exists "ai_usage_admin_read" on public.admin_ai_usage;
create policy "ai_usage_admin_read" on public.admin_ai_usage
  for select using (public.is_admin());

-- Counts one AI call for the current admin. Returns false once the daily
-- limit is reached. Called by the admin-ai edge function.
create or replace function public.admin_ai_consume(p_limit int default 200)
returns boolean
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_calls int;
begin
  if not public.is_admin() then
    return false;
  end if;
  insert into public.admin_ai_usage as u (user_id, day, calls)
  values (auth.uid(), (now() at time zone 'Europe/Paris')::date, 1)
  on conflict (user_id, day) do update set calls = u.calls + 1
  returning calls into v_calls;
  return v_calls <= greatest(1, coalesce(p_limit, 200));
end;
$$;
revoke all on function public.admin_ai_consume(int) from public;
grant execute on function public.admin_ai_consume(int) to authenticated;

-- ─── 12. Indexes ──────────────────────────────────────────────────────────
create index if not exists lesson_events_lesson_user_idx
  on public.lesson_events(lesson_id, user_id, step_index);
create index if not exists lesson_events_user_created_idx
  on public.lesson_events(user_id, created_at);
