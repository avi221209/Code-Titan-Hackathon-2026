-- =====================================================================
-- BrandGuardian (M1 / Hardened) — RLS Isolation & Role Verification
-- =====================================================================
-- Run BLOCK 1 in Supabase SQL Editor first.
-- Note: Supabase SQL Editor displays only the last statement's output.
-- If your editor shows "No rows returned" because ROLLBACK runs last,
-- highlight from `begin;` through `select * from results order by case_id;`,
-- run that selection to inspect the 7 rows (cases a-g), and then run `rollback;`.
-- =====================================================================

-- ---------------------------------------------------------------------
-- BLOCK 1: Impersonated RLS test cases (a) through (g)
-- ---------------------------------------------------------------------
begin;

create temp table results (
  case_id text primary key,
  description text not null,
  expected text not null,
  actual text not null,
  pass boolean not null
) on commit drop;

do $$
declare
  v_judge uuid;
  v_outsider uuid;
  v_asterra uuid;
  v_northwind uuid;
begin
  select id into v_judge from auth.users where email = 'judge@brandguardian.demo';
  if v_judge is null then
    raise exception 'Missing judge@brandguardian.demo in auth.users';
  end if;

  select id into v_outsider from auth.users where email = 'outsider@brandguardian.demo';
  if v_outsider is null then
    v_outsider := gen_random_uuid();
  end if;

  select id into v_asterra from public.workspaces where name = 'Asterra (demo)' limit 1;
  select id into v_northwind from public.workspaces where name = 'Northwind (isolation test)' limit 1;

  if v_asterra is null or v_northwind is null then
    raise exception 'Missing seeded workspaces Asterra (demo) or Northwind (isolation test)';
  end if;

  perform set_config('bg.judge_id', v_judge::text, true);
  perform set_config('bg.outsider_id', v_outsider::text, true);
  perform set_config('bg.asterra_id', v_asterra::text, true);
  perform set_config('bg.northwind_id', v_northwind::text, true);
end $$;

-- Case (a): judge can read Asterra knowledge
set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('bg.judge_id'), 'role', 'authenticated')::text,
  true
);
do $$
declare
  v_rules int;
  v_facts int;
  v_terms int;
begin
  select count(*) into v_rules
  from public.guideline_rules
  where workspace_id = current_setting('bg.asterra_id')::uuid;

  select count(*) into v_facts
  from public.approved_facts
  where workspace_id = current_setting('bg.asterra_id')::uuid;

  select count(*) into v_terms
  from public.terminology
  where workspace_id = current_setting('bg.asterra_id')::uuid;

  perform set_config(
    'bg.res_a_actual',
    format('rules=%s, facts=%s, terminology=%s', v_rules, v_facts, v_terms),
    true
  );
  perform set_config(
    'bg.res_a_pass',
    (v_rules = 5 and v_facts = 5 and v_terms = 2)::text,
    true
  );
end $$;
reset role;
insert into results(case_id, description, expected, actual, pass) values (
  'a',
  'judge can read Asterra knowledge',
  'rules=5, facts=5, terminology=2',
  current_setting('bg.res_a_actual'),
  current_setting('bg.res_a_pass')::boolean
);

-- Case (b): judge cannot read Northwind rows
set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('bg.judge_id'), 'role', 'authenticated')::text,
  true
);
do $$
declare
  v_ws int;
  v_facts int;
begin
  select count(*) into v_ws
  from public.workspaces
  where id = current_setting('bg.northwind_id')::uuid;

  select count(*) into v_facts
  from public.approved_facts
  where workspace_id = current_setting('bg.northwind_id')::uuid;

  perform set_config(
    'bg.res_b_actual',
    format('workspaces=%s, approved_facts=%s', v_ws, v_facts),
    true
  );
  perform set_config(
    'bg.res_b_pass',
    (v_ws = 0 and v_facts = 0)::text,
    true
  );
end $$;
reset role;
insert into results(case_id, description, expected, actual, pass) values (
  'b',
  'judge cannot read Northwind rows',
  'workspaces=0, approved_facts=0',
  current_setting('bg.res_b_actual'),
  current_setting('bg.res_b_pass')::boolean
);

-- Case (c): outsider cannot read Asterra rows
set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('bg.outsider_id'), 'role', 'authenticated')::text,
  true
);
do $$
declare
  v_ws int;
  v_rules int;
  v_facts int;
  v_terms int;
  v_docs int;
begin
  select count(*) into v_ws
  from public.workspaces
  where id = current_setting('bg.asterra_id')::uuid;

  select count(*) into v_rules
  from public.guideline_rules
  where workspace_id = current_setting('bg.asterra_id')::uuid;

  select count(*) into v_facts
  from public.approved_facts
  where workspace_id = current_setting('bg.asterra_id')::uuid;

  select count(*) into v_terms
  from public.terminology
  where workspace_id = current_setting('bg.asterra_id')::uuid;

  select count(*) into v_docs
  from public.documents
  where workspace_id = current_setting('bg.asterra_id')::uuid;

  perform set_config(
    'bg.res_c_actual',
    format('workspaces=%s, rules=%s, facts=%s, terminology=%s, documents=%s', v_ws, v_rules, v_facts, v_terms, v_docs),
    true
  );
  perform set_config(
    'bg.res_c_pass',
    (v_ws = 0 and v_rules = 0 and v_facts = 0 and v_terms = 0 and v_docs = 0)::text,
    true
  );
end $$;
reset role;
insert into results(case_id, description, expected, actual, pass) values (
  'c',
  'outsider cannot read Asterra rows',
  'workspaces=0, rules=0, facts=0, terminology=0, documents=0',
  current_setting('bg.res_c_actual'),
  current_setting('bg.res_c_pass')::boolean
);

-- Case (d): a creator-role member cannot insert approved_facts
update public.workspace_members
  set role = 'creator'
  where workspace_id = current_setting('bg.asterra_id')::uuid
    and user_id = current_setting('bg.judge_id')::uuid;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('bg.judge_id'), 'role', 'authenticated')::text,
  true
);
do $$
begin
  begin
    insert into public.approved_facts(workspace_id, fact_text, status)
    values (
      current_setting('bg.asterra_id')::uuid,
      'Unauthorized creator fact insert attempt',
      'active'
    );

    perform set_config('bg.res_d_actual', 'UNEXPECTED SUCCESS: approved_facts row inserted', true);
    perform set_config('bg.res_d_pass', 'false', true);
  exception
    when sqlstate '42501' then
      perform set_config('bg.res_d_actual', format('denied (%s): %s', SQLSTATE, SQLERRM), true);
      perform set_config('bg.res_d_pass', 'true', true);
    when others then
      perform set_config('bg.res_d_actual', format('error (%s): %s', SQLSTATE, SQLERRM), true);
      perform set_config('bg.res_d_pass', 'false', true);
  end;
end $$;
reset role;
insert into results(case_id, description, expected, actual, pass) values (
  'd',
  'creator-role member cannot insert approved_facts',
  'SQLSTATE 42501 (RLS denied)',
  current_setting('bg.res_d_actual'),
  current_setting('bg.res_d_pass')::boolean
);

-- Case (e): inserting a document with another user's created_by is denied
update public.workspace_members
  set role = 'admin'
  where workspace_id = current_setting('bg.asterra_id')::uuid
    and user_id = current_setting('bg.judge_id')::uuid;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('bg.judge_id'), 'role', 'authenticated')::text,
  true
);
do $$
begin
  begin
    insert into public.documents(workspace_id, created_by, title, content)
    values (
      current_setting('bg.asterra_id')::uuid,
      current_setting('bg.outsider_id')::uuid,
      'Spoofed Author Document',
      'Attempt to spoof created_by under RLS.'
    );

    perform set_config('bg.res_e_actual', 'UNEXPECTED SUCCESS: document row inserted', true);
    perform set_config('bg.res_e_pass', 'false', true);
  exception
    when sqlstate '42501' then
      perform set_config('bg.res_e_actual', format('denied (%s): %s', SQLSTATE, SQLERRM), true);
      perform set_config('bg.res_e_pass', 'true', true);
    when others then
      perform set_config('bg.res_e_actual', format('error (%s): %s', SQLSTATE, SQLERRM), true);
      perform set_config('bg.res_e_pass', 'false', true);
  end;
end $$;
reset role;
insert into results(case_id, description, expected, actual, pass) values (
  'e',
  'inserting a document with another user created_by is denied',
  'SQLSTATE 42501 (RLS denied)',
  current_setting('bg.res_e_actual'),
  current_setting('bg.res_e_pass')::boolean
);

-- Seed a fixture document inside Asterra owned by judge (rolled back at end)
-- and add temporary Northwind membership for judge so case (f) isolates the
-- 0002 immutability trigger even for a multi-workspace member.
do $$
declare
  v_doc uuid;
begin
  insert into public.documents(workspace_id, created_by, title, content)
  values (
    current_setting('bg.asterra_id')::uuid,
    current_setting('bg.judge_id')::uuid,
    'RLS Immutability Fixture Draft',
    'Asterra Flow fixture draft for immutability trigger verification.'
  )
  returning id into v_doc;

  perform set_config('bg.test_doc_id', v_doc::text, true);

  insert into public.workspace_members(workspace_id, user_id, role)
  values (
    current_setting('bg.northwind_id')::uuid,
    current_setting('bg.judge_id')::uuid,
    'creator'
  )
  on conflict do nothing;
end $$;

-- Case (f): updating documents.workspace_id is denied
set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('bg.judge_id'), 'role', 'authenticated')::text,
  true
);
do $$
declare
  v_rows int := 0;
begin
  begin
    update public.documents
    set workspace_id = current_setting('bg.northwind_id')::uuid
    where id = current_setting('bg.test_doc_id')::uuid;

    get diagnostics v_rows = row_count;
    perform set_config(
      'bg.res_f_actual',
      format('UNEXPECTED SUCCESS: updated %s row(s) workspace_id', v_rows),
      true
    );
    perform set_config('bg.res_f_pass', 'false', true);
  exception
    when sqlstate '42501' then
      perform set_config('bg.res_f_actual', format('denied (%s): %s', SQLSTATE, SQLERRM), true);
      perform set_config('bg.res_f_pass', 'true', true);
    when others then
      perform set_config('bg.res_f_actual', format('error (%s): %s', SQLSTATE, SQLERRM), true);
      perform set_config('bg.res_f_pass', 'false', true);
  end;
end $$;
reset role;
insert into results(case_id, description, expected, actual, pass) values (
  'f',
  'updating documents.workspace_id is denied',
  'SQLSTATE 42501 (immutable column / trigger denied)',
  current_setting('bg.res_f_actual'),
  current_setting('bg.res_f_pass')::boolean
);

-- Case (g): updating documents.created_by is denied
set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('bg.judge_id'), 'role', 'authenticated')::text,
  true
);
do $$
declare
  v_rows int := 0;
begin
  begin
    update public.documents
    set created_by = current_setting('bg.outsider_id')::uuid
    where id = current_setting('bg.test_doc_id')::uuid;

    get diagnostics v_rows = row_count;
    perform set_config(
      'bg.res_g_actual',
      format('UNEXPECTED SUCCESS: updated %s row(s) created_by', v_rows),
      true
    );
    perform set_config('bg.res_g_pass', 'false', true);
  exception
    when sqlstate '42501' then
      perform set_config('bg.res_g_actual', format('denied (%s): %s', SQLSTATE, SQLERRM), true);
      perform set_config('bg.res_g_pass', 'true', true);
    when others then
      perform set_config('bg.res_g_actual', format('error (%s): %s', SQLSTATE, SQLERRM), true);
      perform set_config('bg.res_g_pass', 'false', true);
  end;
end $$;
reset role;
insert into results(case_id, description, expected, actual, pass) values (
  'g',
  'updating documents.created_by is denied',
  'SQLSTATE 42501 (immutable column / trigger denied)',
  current_setting('bg.res_g_actual'),
  current_setting('bg.res_g_pass')::boolean
);

select * from results order by case_id;

rollback;


-- ---------------------------------------------------------------------
-- BLOCK 2: Run separately — pg_policies summary per public table
-- ---------------------------------------------------------------------
select
  t.tablename,
  t.rowsecurity as rls_enabled,
  count(p.policyname) as policy_count,
  coalesce(
    string_agg(p.policyname || ' [' || p.cmd || ']', ', ' order by p.policyname),
    '(none)'
  ) as policies
from pg_tables t
left join pg_policies p
  on p.schemaname = t.schemaname
 and p.tablename = t.tablename
where t.schemaname = 'public'
group by t.tablename, t.rowsecurity
order by t.tablename;
