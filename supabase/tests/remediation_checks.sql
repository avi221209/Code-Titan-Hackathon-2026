-- =====================================================================
-- BrandGuardian — Migration 0004 Integrity & Atomic RPC Verification
-- =====================================================================
-- NOT APPLIED ANYWHERE — Run manually in Supabase SQL Editor AFTER
-- applying 0003_audit_server_only.sql and 0004_remediation_integrity_and_rpc.sql.
-- Wrapped in BEGIN / ROLLBACK so zero test rows persist.
--
-- Tip for Supabase SQL Editor:
-- Highlight from `begin;` through `select * from results order by case_id;`,
-- run to verify all 8 cases (`h` through `o`) report `pass = true`,
-- then run `rollback;`.
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
  v_doc_draft uuid;
  v_doc_reviewed_seed uuid;
  v_run uuid;
  v_f1 uuid;
  v_f2 uuid;
  v_s1 uuid;
  v_s2 uuid;
  v_g_northwind uuid;
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
    raise exception 'Missing outsider@brandguardian.demo in auth.users';
  end if;

  select id into v_asterra from public.workspaces where name = 'Asterra (demo)' limit 1;
  select id into v_northwind from public.workspaces where name = 'Northwind (isolation test)' limit 1;
  if v_asterra is null or v_northwind is null then
    raise exception 'Missing seeded workspaces Asterra (demo) or Northwind (isolation test)';
  end if;

  delete from public.workspace_members
   where workspace_id = v_asterra and user_id = v_outsider;

  insert into public.workspace_members(workspace_id, user_id, role)
  values (v_northwind, v_outsider, 'admin')
  on conflict (workspace_id, user_id) do update set role = excluded.role;

  update public.workspace_members
     set role = 'admin'
   where workspace_id = v_asterra and user_id = v_judge;

  insert into public.guidelines(workspace_id, title)
  values (v_northwind, 'Northwind Guideline Fixture')
  returning id into v_g_northwind;

  insert into public.documents(workspace_id, created_by, title, content, status)
  values (v_asterra, v_judge, '0004 Draft Immutability Fixture', 'Draft copy.', 'draft')
  returning id into v_doc_draft;

  insert into public.documents(workspace_id, created_by, title, content, status)
  values (
    v_asterra,
    v_judge,
    '0004 Atomic Decision Fixture',
    'Our consumers enjoy Asterra Flow and guarantee results.',
    'in_review'
  )
  returning id into v_doc_reviewed_seed;

  insert into public.review_runs(workspace_id, document_id, model_name, status, ai_status)
  values (v_asterra, v_doc_reviewed_seed, 'openai/gpt-oss-20b', 'completed', 'ok')
  returning id into v_run;

  insert into public.findings(
    workspace_id, review_run_id, category, severity, matched_text,
    start_offset, end_offset, explanation, verification_status, origin
  ) values (
    v_asterra, v_run, 'terminology', 'medium', 'consumers',
    4, 13, 'Use customers.', 'verified', 'deterministic'
  )
  returning id into v_f1;

  insert into public.findings(
    workspace_id, review_run_id, category, severity, matched_text,
    start_offset, end_offset, explanation, verification_status, origin
  ) values (
    v_asterra, v_run, 'unsupported_claim', 'critical', 'guarantee',
    35, 44, 'Evidence missing.', 'verified', 'deterministic'
  )
  returning id into v_f2;

  insert into public.suggestions(workspace_id, finding_id, suggested_text, status)
  values (v_asterra, v_f1, 'customers', 'pending')
  returning id into v_s1;

  insert into public.suggestions(workspace_id, finding_id, suggested_text, status)
  values (v_asterra, v_f2, null, 'pending')
  returning id into v_s2;

  perform set_config('bg.judge_id', v_judge::text, true);
  perform set_config('bg.outsider_id', v_outsider::text, true);
  perform set_config('bg.asterra_id', v_asterra::text, true);
  perform set_config('bg.northwind_id', v_northwind::text, true);
  perform set_config('bg.g_northwind_id', v_g_northwind::text, true);
  perform set_config('bg.doc_draft_id', v_doc_draft::text, true);
  perform set_config('bg.doc_reviewed_id', v_doc_reviewed_seed::text, true);
  perform set_config('bg.s1_id', v_s1::text, true);
  perform set_config('bg.s2_id', v_s2::text, true);
end $$;

-- Case (h): authenticated creator cannot update documents.status directly
update public.workspace_members
   set role = 'creator'
 where workspace_id = current_setting('bg.asterra_id')::uuid
   and user_id = current_setting('bg.judge_id')::uuid;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('bg.judge_id'), 'role', 'authenticated')::text, true);
do $$
begin
  begin
    update public.documents
       set status = 'reviewed'
     where id = current_setting('bg.doc_draft_id')::uuid;
    perform set_config('bg.res_h_actual', 'UNEXPECTED SUCCESS updating documents.status', true);
    perform set_config('bg.res_h_pass', 'false', true);
  exception
    when sqlstate '42501' then
      perform set_config('bg.res_h_actual', format('denied (%s): %s', SQLSTATE, SQLERRM), true);
      perform set_config('bg.res_h_pass', 'true', true);
    when others then
      perform set_config('bg.res_h_actual', format('unexpected (%s): %s', SQLSTATE, SQLERRM), true);
      perform set_config('bg.res_h_pass', 'false', true);
  end;
end $$;
reset role;
insert into results values (
  'h',
  'authenticated creator cannot mutate documents.status',
  'SQLSTATE 42501',
  current_setting('bg.res_h_actual'),
  current_setting('bg.res_h_pass')::boolean
);

-- Case (i): authenticated creator cannot mutate documents.content after review runs exist
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('bg.judge_id'), 'role', 'authenticated')::text, true);
do $$
begin
  begin
    update public.documents
       set content = 'Tampered post-review text'
     where id = current_setting('bg.doc_reviewed_id')::uuid;
    perform set_config('bg.res_i_actual', 'UNEXPECTED SUCCESS mutating reviewed content', true);
    perform set_config('bg.res_i_pass', 'false', true);
  exception
    when sqlstate '42501' then
      perform set_config('bg.res_i_actual', format('denied (%s): %s', SQLSTATE, SQLERRM), true);
      perform set_config('bg.res_i_pass', 'true', true);
    when others then
      perform set_config('bg.res_i_actual', format('unexpected (%s): %s', SQLSTATE, SQLERRM), true);
      perform set_config('bg.res_i_pass', 'false', true);
  end;
end $$;
reset role;
insert into results values (
  'i',
  'authenticated user cannot mutate content after review runs exist',
  'SQLSTATE 42501',
  current_setting('bg.res_i_actual'),
  current_setting('bg.res_i_pass')::boolean
);

-- Case (j): authenticated user cannot insert document with pre-set status='reviewed'
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('bg.judge_id'), 'role', 'authenticated')::text, true);
do $$
begin
  begin
    insert into public.documents(workspace_id, created_by, title, content, status)
    values (current_setting('bg.asterra_id')::uuid, current_setting('bg.judge_id')::uuid, 'Spoofed', 'Text', 'reviewed');
    perform set_config('bg.res_j_actual', 'UNEXPECTED SUCCESS inserting reviewed draft', true);
    perform set_config('bg.res_j_pass', 'false', true);
  exception
    when sqlstate '42501' then
      perform set_config('bg.res_j_actual', format('denied (%s): %s', SQLSTATE, SQLERRM), true);
      perform set_config('bg.res_j_pass', 'true', true);
    when others then
      perform set_config('bg.res_j_actual', format('unexpected (%s): %s', SQLSTATE, SQLERRM), true);
      perform set_config('bg.res_j_pass', 'false', true);
  end;
end $$;
reset role;
insert into results values (
  'j',
  'authenticated user cannot insert document with status != draft',
  'SQLSTATE 42501',
  current_setting('bg.res_j_actual'),
  current_setting('bg.res_j_pass')::boolean
);

-- Case (k): composite workspace FK blocks cross-workspace guideline_id link
do $$
begin
  begin
    insert into public.guideline_rules(workspace_id, guideline_id, category, rule_text, severity, approved)
    values (
      current_setting('bg.asterra_id')::uuid,
      current_setting('bg.g_northwind_id')::uuid,
      'messaging',
      'Cross-WS link attempt',
      'low',
      true
    );
    perform set_config('bg.res_k_actual', 'UNEXPECTED SUCCESS cross-workspace FK insert', true);
    perform set_config('bg.res_k_pass', 'false', true);
  exception
    when sqlstate '23503' then
      perform set_config('bg.res_k_actual', format('fk blocked (%s)', SQLSTATE), true);
      perform set_config('bg.res_k_pass', 'true', true);
    when others then
      perform set_config('bg.res_k_actual', format('unexpected (%s): %s', SQLSTATE, SQLERRM), true);
      perform set_config('bg.res_k_pass', 'false', true);
  end;
end $$;
insert into results values (
  'k',
  'composite FK blocks cross-workspace guideline_id link',
  'SQLSTATE 23503',
  current_setting('bg.res_k_actual'),
  current_setting('bg.res_k_pass')::boolean
);

-- Case (l): uq_review_runs_one_running prevents two concurrent running rows on one doc
do $$
begin
  begin
    insert into public.review_runs(workspace_id, document_id, status)
    values (current_setting('bg.asterra_id')::uuid, current_setting('bg.doc_draft_id')::uuid, 'running');
    insert into public.review_runs(workspace_id, document_id, status)
    values (current_setting('bg.asterra_id')::uuid, current_setting('bg.doc_draft_id')::uuid, 'running');
    perform set_config('bg.res_l_actual', 'UNEXPECTED SUCCESS two running runs on one document', true);
    perform set_config('bg.res_l_pass', 'false', true);
  exception
    when sqlstate '23505' then
      perform set_config('bg.res_l_actual', format('unique blocked (%s)', SQLSTATE), true);
      perform set_config('bg.res_l_pass', 'true', true);
    when others then
      perform set_config('bg.res_l_actual', format('unexpected (%s): %s', SQLSTATE, SQLERRM), true);
      perform set_config('bg.res_l_pass', 'false', true);
  end;
end $$;
insert into results values (
  'l',
  'uq_review_runs_one_running blocks concurrent running rows',
  'SQLSTATE 23505',
  current_setting('bg.res_l_actual'),
  current_setting('bg.res_l_pass')::boolean
);

-- Case (m): record_review_decision blocks creator (42501) and blocks edited on suggested_text=null (22023)
update public.workspace_members
   set role = 'creator'
 where workspace_id = current_setting('bg.asterra_id')::uuid
   and user_id = current_setting('bg.judge_id')::uuid;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('bg.judge_id'), 'role', 'authenticated')::text, true);
do $$
declare
  v_creator_ok boolean := false;
begin
  begin
    perform * from public.record_review_decision(current_setting('bg.s1_id')::uuid, 'accepted', null, null);
  exception
    when sqlstate '42501' then
      v_creator_ok := true;
    when others then
      v_creator_ok := false;
  end;
  perform set_config('bg.res_m_creator', v_creator_ok::text, true);
end $$;
reset role;

update public.workspace_members
   set role = 'approver'
 where workspace_id = current_setting('bg.asterra_id')::uuid
   and user_id = current_setting('bg.judge_id')::uuid;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('bg.judge_id'), 'role', 'authenticated')::text, true);
do $$
declare
  v_null_edit_ok boolean := false;
begin
  begin
    perform * from public.record_review_decision(current_setting('bg.s2_id')::uuid, 'edited', 'manual fix', null);
  exception
    when sqlstate '22023' then
      v_null_edit_ok := true;
    when others then
      v_null_edit_ok := false;
  end;
  perform set_config('bg.res_m_null_edit', v_null_edit_ok::text, true);
end $$;
reset role;

insert into results values (
  'm',
  'record_review_decision denies creator and blocks edited on null suggested_text',
  'creator_42501=true, null_edit_22023=true',
  format('creator_42501=%s, null_edit_22023=%s', current_setting('bg.res_m_creator'), current_setting('bg.res_m_null_edit')),
  (current_setting('bg.res_m_creator')::boolean and current_setting('bg.res_m_null_edit')::boolean)
);

-- Case (n): record_review_decision atomically transitions document to reviewed & logs audit events
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('bg.judge_id'), 'role', 'authenticated')::text, true);
do $$
declare
  v_doc_status_1 text;
  v_doc_status_2 text;
  v_dup_blocked boolean := false;
  v_s1_status text;
  v_doc_actual text;
  v_audit_count int := 0;
begin
  begin
    select document_status into v_doc_status_1
      from public.record_review_decision(current_setting('bg.s1_id')::uuid, 'accepted', null, null);

    select document_status into v_doc_status_2
      from public.record_review_decision(current_setting('bg.s2_id')::uuid, 'dismissed', null, null);

    begin
      perform * from public.record_review_decision(current_setting('bg.s1_id')::uuid, 'dismissed', null, null);
    exception
      when sqlstate '23505' then
        v_dup_blocked := true;
      when others then
        v_dup_blocked := false;
    end;

    select status into v_s1_status from public.suggestions where id = current_setting('bg.s1_id')::uuid;
    select status into v_doc_actual from public.documents where id = current_setting('bg.doc_reviewed_id')::uuid;
    select count(*) into v_audit_count
      from public.audit_events
     where workspace_id = current_setting('bg.asterra_id')::uuid
       and action in ('decision.recorded', 'document.reviewed')
       and (entity_id = current_setting('bg.doc_reviewed_id')::uuid
            or entity_id in (current_setting('bg.s1_id')::uuid, current_setting('bg.s2_id')::uuid));

    perform set_config(
      'bg.res_n_actual',
      format('s1_doc=%s, s2_doc=%s, s1=%s, doc=%s, audits=%s, dup_23505=%s',
        coalesce(v_doc_status_1, 'null'), coalesce(v_doc_status_2, 'null'),
        coalesce(v_s1_status, 'null'), coalesce(v_doc_actual, 'null'),
        v_audit_count, v_dup_blocked),
      true
    );
    perform set_config(
      'bg.res_n_pass',
      (v_doc_status_1 is null and v_doc_status_2 = 'reviewed' and v_s1_status = 'accepted' and v_doc_actual = 'reviewed' and v_audit_count = 3 and v_dup_blocked)::text,
      true
    );
  exception
    when others then
      perform set_config('bg.res_n_actual', format('unexpected (%s): %s', SQLSTATE, SQLERRM), true);
      perform set_config('bg.res_n_pass', 'false', true);
  end;
end $$;
reset role;
insert into results values (
  'n',
  'record_review_decision updates suggestions, document status, audit_events and blocks duplicate',
  's1_doc=null, s2_doc=reviewed, s1=accepted, doc=reviewed, audits=3, dup_23505=true',
  current_setting('bg.res_n_actual'),
  current_setting('bg.res_n_pass')::boolean
);

-- Case (o): anon cannot invoke is_member/has_role/record_review_decision RPCs
do $$
declare
  v_is_member_priv boolean;
  v_rpc_priv boolean;
begin
  select has_function_privilege('anon', 'public.is_member(uuid)', 'EXECUTE') into v_is_member_priv;
  select has_function_privilege('anon', 'public.record_review_decision(uuid,text,text,text)', 'EXECUTE') into v_rpc_priv;

  perform set_config(
    'bg.res_o_actual',
    format('anon_is_member=%s, anon_rpc=%s', v_is_member_priv, v_rpc_priv),
    true
  );
  perform set_config(
    'bg.res_o_pass',
    ((not v_is_member_priv) and (not v_rpc_priv))::text,
    true
  );
end $$;
insert into results values (
  'o',
  'anon EXECUTE revoked on security helper and RPC functions',
  'anon_is_member=false, anon_rpc=false',
  current_setting('bg.res_o_actual'),
  current_setting('bg.res_o_pass')::boolean
);

select * from results order by case_id;

rollback;
