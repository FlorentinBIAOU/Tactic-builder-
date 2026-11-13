-- Smoke tests for the admin migrations. Run after stub.sql + migrations +
-- seed/demo_analytics.sql. Any failed check raises and stops the run.
\set ON_ERROR_STOP 1

grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
insert into auth.users values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000c') on conflict do nothing;
insert into public.profiles (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test'),
  ('00000000-0000-0000-0000-00000000000c', 'c@test') on conflict do nothing;
update public.profiles set role = 'admin' where email in ('a@test', 'b@test');
insert into public.corpus_lessons (id, name) select 'l' || g, 'L' || g from generate_series(1, 10) g
  on conflict do nothing;

\i supabase/seed/demo_analytics.sql

-- Learner
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
update public.profiles set role = 'admin' where id = auth.uid();
do $$ begin
  if (select role from public.profiles where id = auth.uid()) <> 'learner' then
    raise exception 'FAIL: a learner changed their own role';
  end if;
  if public.is_admin() then raise exception 'FAIL: learner is admin'; end if;
end $$;
do $$ begin
  begin
    insert into public.lesson_events (user_id, lesson_id, step_index, seconds) values (auth.uid(), 'l1', 999999, -5);
    raise exception 'FAIL: out-of-range event accepted';
  exception when check_violation then null;
  end;
  begin
    insert into public.lesson_events (user_id, lesson_id, created_at) values (auth.uid(), 'l1', '2001-01-01');
    raise exception 'FAIL: back-dated event accepted';
  exception when insufficient_privilege then null;
  end;
end $$;
insert into public.lesson_events (user_id, lesson_id, step_index, seconds) values (auth.uid(), 'l1', 2, 30);
reset role;

-- Admin
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$
declare v_lesson text;
begin
  select lesson_id into v_lesson from public.lesson_events where is_demo limit 1;
  if (select count(*) from public.admin_lesson_funnel(v_lesson)) = 0 then
    raise exception 'FAIL: admin_lesson_funnel returned nothing';
  end if;
  if (select cohort from public.admin_retention()) is null then
    raise exception 'FAIL: admin_retention returned nothing';
  end if;
  if (select demo_rows from public.admin_demo_status()) = 0 then
    raise exception 'FAIL: demo rows not flagged';
  end if;
  if (select count(*) from public.admin_lesson_time(10)) = 0 then
    raise exception 'FAIL: admin_lesson_time returned nothing';
  end if;
  perform * from public.admin_global_counts();
  perform * from public.admin_marketing_kpis();
  perform * from public.admin_list_members();
  if not public.admin_ai_consume(5) then raise exception 'FAIL: ai quota refused first call'; end if;
  begin
    insert into public.admin_audit_log (actor_id, action) values (auth.uid(), 'forged');
    raise exception 'FAIL: direct audit insert accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.corpus_resources (kind, title, url) values ('link', 'x', 'javascript:alert(1)');
    raise exception 'FAIL: javascript: link accepted';
  exception when check_violation then null;
  end;
  insert into public.corpus_lessons (id, name) values ('smoke-new', 'N');
  if (select status from public.corpus_lessons where id = 'smoke-new') <> 'draft' then
    raise exception 'FAIL: new lesson not a draft';
  end if;
  perform public.admin_set_role('00000000-0000-0000-0000-00000000000b', 'learner');
  begin
    perform public.admin_set_role('00000000-0000-0000-0000-00000000000a', 'learner');
    raise exception 'FAIL: last admin removed';
  exception when raise_exception then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
end $$;
reset role;

select 'smoke tests passed' as result;
