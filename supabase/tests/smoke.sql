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

-- Team page: admin_list_staff (0008)
insert into auth.users select ('00000000-0000-0000-0001-' || lpad(g::text, 12, '0'))::uuid
  from generate_series(1, 120) g on conflict do nothing;
insert into public.profiles (id, email, full_name)
  select ('00000000-0000-0000-0001-' || lpad(g::text, 12, '0'))::uuid, 'learner' || g || '@test', 'Learner ' || g
  from generate_series(1, 120) g on conflict do nothing;
insert into auth.users values ('00000000-0000-0000-0000-00000000000d') on conflict do nothing;
insert into public.profiles (id, email, full_name)
  values ('00000000-0000-0000-0000-00000000000d', 'odd_100%@test', 'Zoé Pédago') on conflict do nothing;

-- Learner: refused
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
do $$ begin
  begin
    perform * from public.admin_list_staff();
    raise exception 'FAIL: learner listed the staff';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- Anonymous: no execute grant
set role anon;
do $$ begin
  begin
    perform * from public.admin_list_staff();
    raise exception 'FAIL: anon listed the staff';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- Admin
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$
declare
  v_n     int;
  v_total bigint;
  v_first text;
begin
  perform public.admin_set_role('00000000-0000-0000-0000-00000000000b', 'ped');
  perform public.admin_set_role('00000000-0000-0000-0000-00000000000d', 'data');

  -- No search: staff only (a admin, b ped, d data), admin first, with a total.
  select count(*), max(total_count) into v_n, v_total from public.admin_list_staff();
  if v_n <> 3 or v_total <> v_n then
    raise exception 'FAIL: staff list % rows, total %', v_n, v_total;
  end if;
  if exists (select 1 from public.admin_list_staff() where role = 'learner') then
    raise exception 'FAIL: learner in the staff list';
  end if;
  select role into v_first from public.admin_list_staff() limit 1;
  if v_first <> 'admin' then raise exception 'FAIL: admins not listed first (%)', v_first; end if;
  if not exists (select 1 from public.admin_list_staff('  ') where email = 'b@test' and role = 'ped') then
    raise exception 'FAIL: blank search is not the staff list';
  end if;

  -- Search covers learners too, by e-mail or name, case-insensitive.
  if not exists (select 1 from public.admin_list_staff('C@TE') where email = 'c@test' and role = 'learner') then
    raise exception 'FAIL: search by e-mail missed a learner';
  end if;
  if not exists (select 1 from public.admin_list_staff('zoé péd') where email = 'odd_100%@test') then
    raise exception 'FAIL: search by name failed';
  end if;

  -- LIKE wildcards are matched literally.
  select count(*) into v_n from public.admin_list_staff('%');
  if v_n <> 1 then raise exception 'FAIL: %% wildcard not escaped (% rows)', v_n; end if;
  select count(*) into v_n from public.admin_list_staff('r_1');  -- unescaped, would match 'Learner 1…'
  if v_n <> 0 then raise exception 'FAIL: _ wildcard not escaped (% rows)', v_n; end if;
  select count(*) into v_n from public.admin_list_staff('d_1');
  if v_n <> 1 then raise exception 'FAIL: literal _ not found (% rows)', v_n; end if;

  -- Bounded paging, total before paging.
  select count(*), max(total_count) into v_n, v_total from public.admin_list_staff('learner', 100000, 0);
  if v_n <> 100 or v_total < 120 then raise exception 'FAIL: limit not capped (% rows, total %)', v_n, v_total; end if;
  select count(*) into v_n from public.admin_list_staff('learner', 0, -5);
  if v_n <> 1 then raise exception 'FAIL: limit/offset not floored (% rows)', v_n; end if;
  select count(*) into v_n from public.admin_list_staff('learner', 50, 100);
  if v_n <> (v_total - 100) then raise exception 'FAIL: offset paging (% rows)', v_n; end if;
  if (select count(*) from public.admin_list_staff(repeat('x', 5000))) <> 0 then
    raise exception 'FAIL: long search not handled';
  end if;
end $$;
reset role;

select 'smoke tests passed' as result;
