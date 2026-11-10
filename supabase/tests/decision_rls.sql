-- =====================================================================
-- BrandGuardian (M3) — Review Decisions RLS & Uniqueness Verification
-- =====================================================================
-- NOT APPLIED ANYWHERE — Run manually in Supabase SQL Editor after seeded
-- workspace data is present. Wrapped in BEGIN / ROLLBACK so zero test rows
-- persist in the database.
--
-- Note: Supabase SQL Editor displays only the last statement's output.
-- If your editor shows "No rows returned" because ROLLBACK runs last,
-- highlight from `begin;` through `select * from results order by case_id;`,
-- run that selection to inspect the 4 rows (cases a-d), and then run `rollback;`.
-- =====================================================================

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
  v_doc uuid;
  v_run uuid;
  v_f1 uuid;
  v_f2 uuid;
  v_s1 uuid;
  v_s2 uuid;
begin
  select id into v_judge from auth.users where email = 'judge@brandguardian.demo';
  if v_judge is null then
    raise exception 'Missing judge@brandguardian.demo in auth.users';
  end if;

  select id into v_outsider from auth.users where email = 'outsider@brandguardian.demo';
  if v_outsider is null then
    select id into v_outsider from auth.users where id <> v_judge limit 1;
  end if;
  if v_outsider is null then
    raise exception 'Missing outsider@brandguardian.demo (a second auth.users account) for case (d)';
  end if;

  select id into v_asterra from public.workspaces where name = 'Asterra (demo)' limit 1;
  select id into v_northwind from public.workspaces where name = 'Northwind (isolation test)' limit 1;
  if v_asterra is null or v_northwind is null then
    raise exception 'Missing seeded workspaces Asterra (demo) or Northwind (isolation test)';
  end if;

  -- Guarantee v_outsider belongs to Northwind (admin) and NOT Asterra inside this rollback scope
  delete from public.workspace_members
  where workspace_id = v_asterra and user_id = v_outsider;

  insert into public.workspace_members(workspace_id, user_id, role)
  values (v_northwind, v_outsider, 'admin')
  on conflict (workspace_id, user_id) do update set role = excluded.role;

  insert into public.documents(workspace_id, created_by, title, content, status)
  values (
    v_asterra,
    v_judge,
    'M3 Decision RLS Fixture Draft',
    'Our consumers enjoy Asterra Flow and we guarantee instant profits.',
    'in_review'
  )
  returning id into v_doc;

  insert into public.review_runs(workspace_id, document_id, model_name, status, ai_status)
  values (v_asterra, v_doc, 'openai/gpt-oss-20b', 'completed', 'ok')
  returning id into v_run;

  insert into public.findings(
    workspace_id, review_run_id, category, severity, matched_text,
    start_offset, end_offset, explanation, verification_status, origin
  )
  values
    (v_asterra, v_run, 'terminology', 'medium', 'consumers', 4, 13, 'Use customers.', 'verified', 'deterministic')
  returning id into v_f1;

  insert into public.findings(
    workspace_id, review_run_id, category, severity, matched_text,
    start_offset, end_offset, explanation, verification_status, origin
  )
  values
    (v_asterra, v_run, 'unsupported_claim', 'critical', 'guarantee instant profits', 38, 63, 'Remove guarantee.', 'verified', 'deterministic')
  returning id into v_f2;

  insert into public.suggestions(workspace_id, finding_id, suggested_text, status)
  values (v_asterra, v_f1, 'customers', 'pending')
  returning id into v_s1;

  insert into public.suggestions(workspace_id, finding_id, suggested_text, status)
  values (v_asterra, v_f2, 'deliver measurable value', 'pending')
  returning id into v_s2;

  perform set_config('bg.judge_id', v_judge::text, true);
  perform set_config('bg.outsider_id', v_outsider::text, true);
  perform set_config('bg.asterra_id', v_asterra::text, true);
  perform set_config('bg.northwind_id', v_northwind::text, true);
  perform set_config('bg.s1_id', v_s1::text, true);
  perform set_config('bg.s2_id', v_s2::text, true);
end $$;

-- Case (a): approver (and admin) can insert a decision on their workspace suggestion
update public.workspace_members
  set role = 'approver'
  where workspace_id = current_setting('bg.asterra_id')::uuid
    and user_id = current_setting('bg.judge_id')::uuid;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('bg.judge_id'), 'role', 'authenticated')::text,
  true
);
do $$
declare
  v_dec_id uuid;
begin
  begin
    insert into public.review_decisions(workspace_id, suggestion_id, reviewer_id, decision, comment)
    values (
      current_setting('bg.asterra_id')::uuid,
      current_setting('bg.s1_id')::uuid,
      current_setting('bg.judge_id')::uuid,
      'accepted',
      'Approved as approver role in RLS test.'
    )
    returning id into v_dec_id;

    perform set_config('bg.res_a_actual', format('inserted decision=%s', v_dec_id), true);
    perform set_config('bg.res_a_pass', 'true', true);
  exception
    when others then
      perform set_config('bg.res_a_actual', format('error (%s): %s', SQLSTATE, SQLERRM), true);
      perform set_config('bg.res_a_pass', 'false', true);
  end;
end $$;
reset role;
insert into results(case_id, description, expected, actual, pass) values (
  'a',
  'approver or admin can insert a review decision',
  'insert succeeds under authenticated RLS',
  current_setting('bg.res_a_actual'),
  current_setting('bg.res_a_pass')::boolean
);

-- Case (b): a creator-role member cannot insert a review decision (42501)
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
    insert into public.review_decisions(workspace_id, suggestion_id, reviewer_id, decision)
    values (
      current_setting('bg.asterra_id')::uuid,
      current_setting('bg.s2_id')::uuid,
      current_setting('bg.judge_id')::uuid,
      'accepted'
    );

    perform set_config('bg.res_b_actual', 'UNEXPECTED SUCCESS: creator inserted review_decisions', true);
    perform set_config('bg.res_b_pass', 'false', true);
  exception
    when sqlstate '42501' then
      perform set_config('bg.res_b_actual', format('denied (%s): %s', SQLSTATE, SQLERRM), true);
      perform set_config('bg.res_b_pass', 'true', true);
    when others then
      perform set_config('bg.res_b_actual', format('error (%s): %s', SQLSTATE, SQLERRM), true);
      perform set_config('bg.res_b_pass', 'false', true);
  end;
end $$;
reset role;
insert into results(case_id, description, expected, actual, pass) values (
  'b',
  'creator-role member cannot insert a review decision',
  'SQLSTATE 42501 (RLS denied)',
  current_setting('bg.res_b_actual'),
  current_setting('bg.res_b_pass')::boolean
);

-- Case (c): a second decision on one suggestion violates unique constraint (23505)
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
    insert into public.review_decisions(workspace_id, suggestion_id, reviewer_id, decision)
    values (
      current_setting('bg.asterra_id')::uuid,
      current_setting('bg.s1_id')::uuid,
      current_setting('bg.judge_id')::uuid,
      'dismissed'
    );

    perform set_config('bg.res_c_actual', 'UNEXPECTED SUCCESS: duplicate review_decisions inserted', true);
    perform set_config('bg.res_c_pass', 'false', true);
  exception
    when sqlstate '23505' then
      perform set_config('bg.res_c_actual', format('duplicate blocked (%s): %s', SQLSTATE, SQLERRM), true);
      perform set_config('bg.res_c_pass', 'true', true);
    when others then
      perform set_config('bg.res_c_actual', format('error (%s): %s', SQLSTATE, SQLERRM), true);
      perform set_config('bg.res_c_pass', 'false', true);
  end;
end $$;
reset role;
insert into results(case_id, description, expected, actual, pass) values (
  'c',
  'second decision on one suggestion violates unique constraint',
  'SQLSTATE 23505 (unique_violation)',
  current_setting('bg.res_c_actual'),
  current_setting('bg.res_c_pass')::boolean
);

-- Case (d): a member of another workspace (Northwind admin) cannot decide on Asterra suggestion
set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', current_setting('bg.outsider_id'), 'role', 'authenticated')::text,
  true
);
do $$
declare
  v_denied_asterra_ws boolean := false;
  v_denied_spoofed_ws boolean := false;
  v_detail text := '';
begin
  -- Attempt 1: targeting Asterra workspace directly
  begin
    insert into public.review_decisions(workspace_id, suggestion_id, reviewer_id, decision, comment)
    values (
      current_setting('bg.asterra_id')::uuid,
      current_setting('bg.s2_id')::uuid,
      current_setting('bg.outsider_id')::uuid,
      'rejected',
      'Cross-workspace attempt 1'
    );
    v_detail := 'UNEXPECTED SUCCESS inserting with Asterra workspace_id';
  exception
    when sqlstate '42501' then
      v_denied_asterra_ws := true;
      v_detail := format('asterra_ws=%s', SQLSTATE);
    when others then
      v_detail := format('asterra_ws=%s (%s)', SQLSTATE, SQLERRM);
  end;

  -- Attempt 2: supplying outsider's own Northwind workspace_id paired with Asterra suggestion_id
  begin
    insert into public.review_decisions(workspace_id, suggestion_id, reviewer_id, decision, comment)
    values (
      current_setting('bg.northwind_id')::uuid,
      current_setting('bg.s2_id')::uuid,
      current_setting('bg.outsider_id')::uuid,
      'rejected',
      'Cross-workspace attempt 2'
    );
    v_detail := v_detail || '; UNEXPECTED SUCCESS inserting with Northwind workspace_id';
  exception
    when sqlstate '42501' then
      v_denied_spoofed_ws := true;
      v_detail := v_detail || format('; spoofed_ws=%s', SQLSTATE);
    when others then
      v_detail := v_detail || format('; spoofed_ws=%s (%s)', SQLSTATE, SQLERRM);
  end;

  perform set_config('bg.res_d_actual', v_detail, true);
  perform set_config('bg.res_d_pass', (v_denied_asterra_ws and v_denied_spoofed_ws)::text, true);
end $$;
reset role;
insert into results(case_id, description, expected, actual, pass) values (
  'd',
  'member of another workspace cannot decide on Asterra suggestion',
  'SQLSTATE 42501 on both Asterra and spoofed workspace_id',
  current_setting('bg.res_d_actual'),
  current_setting('bg.res_d_pass')::boolean
);

select * from results order by case_id;

rollback;
