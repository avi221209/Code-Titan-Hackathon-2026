-- =====================================================================
-- SEED: fictional brand "Asterra" (synthetic data only)
-- 1) Supabase > Authentication > Users > Add user: judge@brandguardian.demo (set a password, auto-confirm)
-- 2) Optionally add a 2nd user, e.g. outsider@brandguardian.demo, for the cross-workspace denial test
-- 3) Run the block below
-- =====================================================================
do $$
declare
  ws uuid := gen_random_uuid();
  ws2 uuid := gen_random_uuid();
  g uuid := gen_random_uuid();
  demo uuid;
  outsider uuid;
begin
  select id into demo from auth.users where email = 'judge@brandguardian.demo';
  if demo is null then
    raise exception 'Create user judge@brandguardian.demo first (Authentication > Users)';
  end if;
  select id into outsider from auth.users where email = 'outsider@brandguardian.demo';

  insert into public.profiles(id, full_name) values (demo, 'Demo Judge') on conflict do nothing;
  insert into public.workspaces(id, name, created_by) values
    (ws, 'Asterra (demo)', demo), (ws2, 'Northwind (isolation test)', outsider);
  insert into public.workspace_members(workspace_id, user_id, role) values (ws, demo, 'admin');
  if outsider is not null then
    insert into public.profiles(id, full_name) values (outsider, 'Outsider') on conflict do nothing;
    insert into public.workspace_members(workspace_id, user_id, role) values (ws2, outsider, 'admin');
  end if;

  insert into public.guidelines(id, workspace_id, title) values (g, ws, 'Asterra Brand Guidelines v1');

  insert into public.guideline_rules(workspace_id, guideline_id, category, rule_text, severity, pattern, suggestion, approved) values
    (ws, g, 'tone', 'Tone must be confident, clear, helpful and professional.', 'medium', null, null, true),
    (ws, g, 'messaging', 'Use simple, direct English.', 'low', null, null, true),
    (ws, g, 'messaging', 'Always write the product name as "Asterra Flow".', 'medium', null, null, true),
    (ws, g, 'unsupported_claim', 'No guaranteed financial results without approved evidence.', 'critical',
       '\bguarantee[sd]?\b[^.]{0,40}', 'Remove the guarantee or attach approved evidence.', true),
    (ws, g, 'unsupported_claim', 'Avoid "cheapest", "best" and "number one" without substantiation.', 'high',
       '\b(?:cheapest|best|number one)(?:\s+and\s+(?:cheapest|best|number one))?\b', 'Substantiate or remove the comparison.', true);

  insert into public.approved_facts(workspace_id, fact_text, topic, value, match_pattern, source_name, status) values
    (ws, 'Asterra was founded in 2021.', 'founded', '2021', '(?:founded|established)\s+in\s+(\d{4})', 'Asterra fact sheet', 'active'),
    (ws, 'Asterra has 12,000 active business accounts.', 'accounts', '12,000', '(\d[\d,]*)\s+(?:active\s+)?business\s+accounts', 'Asterra fact sheet', 'active'),
    (ws, 'The product is called Asterra Flow.', 'product', 'Asterra Flow', null, 'Asterra fact sheet', 'active'),
    (ws, 'Support is available Monday to Friday.', 'support', null, null, 'Asterra fact sheet', 'active'),
    (ws, 'There is NO approved guarantee of revenue growth.', 'guarantee', null, null, 'Asterra fact sheet', 'active');

  insert into public.terminology(workspace_id, term, preferred_term, notes) values
    (ws, 'consumers', 'customers', 'Asterra says "customers", not "consumers".'),
    (ws, 'consumer', 'customer', 'Asterra says "customers", not "consumers".');

  -- A different fact in the other workspace, so cross-workspace reads can be tested
  insert into public.approved_facts(workspace_id, fact_text, topic, value, source_name, status)
    values (ws2, 'Northwind secret fact: launch date is 1 Jan 2030.', 'launch', '2030', 'Northwind memo', 'active');

  insert into public.audit_events(workspace_id, actor_id, action, entity_type, entity_id, metadata)
    values (ws, demo, 'workspace.seeded', 'workspace', ws, '{"note":"synthetic demo data"}');
end $$;
