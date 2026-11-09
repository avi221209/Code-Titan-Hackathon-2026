-- =====================================================================
-- BrandGuardian — Migration 0002: RLS & Constraint Hardening [DEF-10]
-- =====================================================================
-- Idempotent migration (safe to re-run in Supabase SQL Editor).
-- Covers:
--   1. Wrap auth.uid() in (select auth.uid()) inside RLS helpers while
--      keeping SECURITY DEFINER and SET search_path = public.
--   2. Enforce immutability of documents.workspace_id and documents.created_by
--      via BEFORE UPDATE trigger (does NOT block inserts into review_runs,
--      findings, suggestions, or status updates on documents).
--   3. Tighten documents_update policy WITH CHECK.
--   4. Revoke DELETE from authenticated on all 14 public tables where the
--      product has no delete feature (service_role retains ALL privileges).
--   5. Add indexes on RLS/knowledge lookup columns.
-- =====================================================================

-- ---------- 1. RLS helper functions with initplan (select auth.uid()) ----------
create or replace function public.is_member(ws uuid) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = ws
      and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.has_role(ws uuid, roles text[]) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = ws
      and m.user_id = (select auth.uid())
      and m.role = any(roles)
  );
$$;

grant execute on function public.is_member(uuid), public.has_role(uuid, text[]) to authenticated, service_role;

-- ---------- 2. Documents column immutability trigger (UPDATE only) ----------
create or replace function public.enforce_documents_immutable_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.workspace_id is distinct from old.workspace_id then
    raise exception 'documents.workspace_id is immutable on update'
      using errcode = '42501';
  end if;

  if new.created_by is distinct from old.created_by then
    raise exception 'documents.created_by is immutable on update'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_documents_immutable_columns on public.documents;
create trigger trg_documents_immutable_columns
  before update on public.documents
  for each row
  execute function public.enforce_documents_immutable_columns();

-- ---------- 3. Tighten documents_update RLS policy ----------
drop policy if exists documents_update on public.documents;
create policy documents_update on public.documents for update to authenticated
  using (
    created_by = (select auth.uid())
    or public.has_role(workspace_id, array['manager','admin'])
  )
  with check (
    public.has_role(workspace_id, array['creator','manager','approver','admin'])
    and (
      created_by = (select auth.uid())
      or public.has_role(workspace_id, array['manager','admin'])
    )
  );

-- ---------- 4. Revoke DELETE from authenticated on non-deletable tables ----------
-- BrandGuardian has no client DELETE workflow on any entity (guidelines archive;
-- audit logs, review runs, findings, suggestions, and decisions are preserved).
-- service_role retains ALL table grants for backend/maintenance operations.
revoke delete on table
  public.profiles,
  public.workspaces,
  public.workspace_members,
  public.guidelines,
  public.guideline_rules,
  public.approved_facts,
  public.terminology,
  public.documents,
  public.review_runs,
  public.findings,
  public.suggestions,
  public.review_decisions,
  public.comments,
  public.audit_events
from authenticated;

-- ---------- 5. Indexes for RLS and workspace knowledge queries ----------
create index if not exists idx_workspace_members_user_ws
  on public.workspace_members (user_id, workspace_id);

create index if not exists idx_guideline_rules_ws_approved
  on public.guideline_rules (workspace_id, approved);

create index if not exists idx_approved_facts_ws_status
  on public.approved_facts (workspace_id, status);

create index if not exists idx_terminology_ws
  on public.terminology (workspace_id);

-- =====================================================================
-- ROLLBACK NOTE (run manually only if reverting Migration 0002)
-- =====================================================================
-- drop trigger if exists trg_documents_immutable_columns on public.documents;
-- drop function if exists public.enforce_documents_immutable_columns();
-- drop policy if exists documents_update on public.documents;
-- create policy documents_update on public.documents for update to authenticated
--   using (created_by = auth.uid() or public.has_role(workspace_id, array['manager','admin']))
--   with check (public.is_member(workspace_id));
-- grant delete on all tables in schema public to authenticated;
-- drop index if exists public.idx_workspace_members_user_ws;
-- drop index if exists public.idx_guideline_rules_ws_approved;
-- drop index if exists public.idx_approved_facts_ws_status;
-- drop index if exists public.idx_terminology_ws;
-- (Restore 0001 versions of public.is_member / public.has_role if desired.)
