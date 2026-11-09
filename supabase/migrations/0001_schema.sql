-- =====================================================================
-- BrandGuardian (Team Stark) - Supabase schema + RLS + Asterra seed
-- Run in the Supabase SQL editor, top to bottom.
-- Differences from the roadmap PDF (deliberate, explained in README):
--   * workspace_id is denormalised onto every child table -> simple, fast RLS
--   * approved_facts / guideline_rules got `pattern` columns -> deterministic checks
--   * review_runs has ai_status -> honest "AI unavailable" state
-- =====================================================================
create extension if not exists pgcrypto;

-- ---------- core ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'creator' check (role in ('creator','manager','approver','admin')),
  primary key (workspace_id, user_id)
);

-- ---------- approved knowledge ----------
create table public.guidelines (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  version int not null default 1,
  status text not null default 'approved' check (status in ('draft','approved','archived')),
  created_at timestamptz not null default now()
);

create table public.guideline_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  guideline_id uuid references public.guidelines(id) on delete cascade,
  category text not null check (category in ('tone','terminology','fact','unsupported_claim','messaging')),
  rule_text text not null,
  severity text not null default 'medium' check (severity in ('critical','high','medium','low')),
  pattern text,            -- optional regex for deterministic matching (manager-authored only)
  suggestion text,         -- optional safe rewrite hint
  approved boolean not null default false
);

create table public.approved_facts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  fact_text text not null,
  topic text,
  value text,              -- canonical value, e.g. '2021'
  match_pattern text,      -- regex with ONE capture group for the value, e.g. founded in (\d{4})
  source_name text,
  source_url text,
  valid_from date,
  valid_until date,
  status text not null default 'active' check (status in ('active','expired','draft'))
);

create table public.terminology (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  term text not null,
  preferred_term text not null,
  notes text
);

-- ---------- review workflow ----------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  title text not null,
  content text not null check (char_length(content) <= 6000),
  status text not null default 'draft' check (status in ('draft','in_review','reviewed')),
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.review_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  model_name text,
  status text not null default 'running' check (status in ('running','completed','failed')),
  ai_status text check (ai_status in ('ok','unavailable','invalid_output','skipped')),
  error text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.findings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  review_run_id uuid not null references public.review_runs(id) on delete cascade,
  category text not null check (category in ('tone','terminology','fact','unsupported_claim','messaging')),
  severity text not null check (severity in ('critical','high','medium','low')),
  matched_text text not null,
  start_offset int not null,
  end_offset int not null,
  explanation text not null,
  source_type text,                     -- terminology | fact | guideline_rule | model
  source_id uuid,
  confidence numeric(3,2),
  verification_status text not null default 'unverified' check (verification_status in ('verified','unverified')),
  origin text not null default 'deterministic' check (origin in ('deterministic','llm')),
  created_at timestamptz not null default now()
);

create table public.suggestions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  finding_id uuid not null unique references public.findings(id) on delete cascade,
  suggested_text text,                  -- null = no safe rewrite; human must verify/remove
  status text not null default 'pending' check (status in ('pending','accepted','edited','rejected','dismissed'))
);

create table public.review_decisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  suggestion_id uuid not null unique references public.suggestions(id) on delete cascade,  -- unique = no duplicate decisions
  reviewer_id uuid not null references auth.users(id),
  decision text not null check (decision in ('accepted','edited','rejected','dismissed')),
  edited_text text,
  comment text,
  created_at timestamptz not null default now()
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  body text not null,
  created_at timestamptz not null default now()
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index on public.documents (workspace_id, created_at desc);
create index on public.findings (review_run_id);
create index on public.audit_events (workspace_id, created_at desc);

-- ---------- RLS helpers (security definer avoids recursive policies) ----------
create or replace function public.is_member(ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.workspace_members m
                 where m.workspace_id = ws and m.user_id = auth.uid());
$$;

create or replace function public.has_role(ws uuid, roles text[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.workspace_members m
                 where m.workspace_id = ws and m.user_id = auth.uid() and m.role = any(roles));
$$;

-- ---------- RLS: enable everywhere, members can read their own workspace ----------
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

create policy profiles_self on public.profiles for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy workspaces_select on public.workspaces for select to authenticated
  using (public.is_member(id));
create policy members_select on public.workspace_members for select to authenticated
  using (public.is_member(workspace_id));

do $$
declare t text;
begin
  foreach t in array array['guidelines','guideline_rules','approved_facts','terminology',
    'documents','review_runs','findings','suggestions','review_decisions','comments','audit_events']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_member(workspace_id))',
                   t || '_select', t);
  end loop;
end $$;

-- ---------- RLS: writes (enforced server-side by Postgres, not by hiding buttons) ----------
-- Knowledge: managers/admins only
do $$
declare t text;
begin
  foreach t in array array['guidelines','guideline_rules','approved_facts','terminology']
  loop
    execute format('create policy %I on public.%I for all to authenticated
      using (public.has_role(workspace_id, array[''manager'',''admin'']))
      with check (public.has_role(workspace_id, array[''manager'',''admin'']))', t || '_write', t);
  end loop;
end $$;

-- Documents: any role can submit; edit own (or manager/admin)
create policy documents_insert on public.documents for insert to authenticated
  with check (created_by = auth.uid()
    and public.has_role(workspace_id, array['creator','manager','approver','admin']));
create policy documents_update on public.documents for update to authenticated
  using (created_by = auth.uid() or public.has_role(workspace_id, array['manager','admin']))
  with check (public.is_member(workspace_id));

-- review_runs / findings / suggestions: NO client write policies -> only the server (service role) writes them.

-- Decisions: approvers/managers/admins; reviewer must be the caller; suggestion must belong to same workspace; immutable
create policy decisions_insert on public.review_decisions for insert to authenticated
  with check (
    reviewer_id = auth.uid()
    and public.has_role(workspace_id, array['approver','manager','admin'])
    and exists (select 1 from public.suggestions s
                where s.id = suggestion_id and s.workspace_id = review_decisions.workspace_id)
  );

create policy comments_insert on public.comments for insert to authenticated
  with check (user_id = auth.uid() and public.is_member(workspace_id));

-- Audit log: append-only
create policy audit_insert on public.audit_events for insert to authenticated
  with check (actor_id = auth.uid() and public.is_member(workspace_id));

-- ---------- grants (tables made in the SQL editor need explicit GRANTs; RLS still applies) ----------
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant execute on function public.is_member(uuid), public.has_role(uuid, text[]) to authenticated, service_role;
