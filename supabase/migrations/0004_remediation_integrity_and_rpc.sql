-- =====================================================================
-- BrandGuardian — Migration 0004: Reliability & Trust Hardening (NOT APPLIED)
-- =====================================================================
-- Remediates [DEF-14], [DEF-15], [DEF-18], and [DEF-22] DB-layer gaps.
-- Idempotent (safe to re-run in Supabase SQL Editor).
-- DO NOT APPLY automatically from agent tooling — owner runs manually
-- in Supabase SQL Editor after reviewing diffs.
-- =====================================================================

-- ---------- 1. Restrict RLS helper RPC probing ([DEF-14]) ----------
revoke all on function public.is_member(uuid), public.has_role(uuid, text[]) from public, anon;
grant execute on function public.is_member(uuid), public.has_role(uuid, text[]) to authenticated, service_role;

-- ---------- 2. Documents insert/update immutability & workflow lock ([DEF-14]) ----------
drop policy if exists documents_insert on public.documents;
create policy documents_insert on public.documents for insert to authenticated
  with check (
    status = 'draft'
    and created_by = (select auth.uid())
    and public.has_role(workspace_id, array['creator','manager','approver','admin'])
  );

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

  -- Direct authenticated updates cannot spoof workflow status or alter
  -- copy/title once compliance review runs exist or the draft left 'draft'.
  -- Server writes (service_role) and SECURITY DEFINER workflow RPCs
  -- (postgres / supabase_admin) execute with current_user in that set.
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    if new.status is distinct from old.status then
      raise exception 'documents.status can only transition via server review workflows'
        using errcode = '42501';
    end if;

    if (new.content is distinct from old.content or new.title is distinct from old.title)
       and (
         old.status <> 'draft'
         or exists (select 1 from public.review_runs r where r.document_id = old.id)
       ) then
      raise exception 'documents title and content are locked once review runs exist'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_documents_immutable_columns on public.documents;
create trigger trg_documents_immutable_columns
  before update on public.documents
  for each row
  execute function public.enforce_documents_immutable_columns();

-- ---------- 3. Composite workspace integrity foreign keys ([DEF-14]) ----------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'uq_guidelines_ws_id'
      and conrelid = 'public.guidelines'::regclass
  ) then
    alter table public.guidelines
      add constraint uq_guidelines_ws_id unique (workspace_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'uq_documents_ws_id'
      and conrelid = 'public.documents'::regclass
  ) then
    alter table public.documents
      add constraint uq_documents_ws_id unique (workspace_id, id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'fk_guideline_rules_ws_guideline'
      and conrelid = 'public.guideline_rules'::regclass
  ) then
    alter table public.guideline_rules
      add constraint fk_guideline_rules_ws_guideline
      foreign key (workspace_id, guideline_id)
      references public.guidelines (workspace_id, id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'fk_review_runs_ws_doc'
      and conrelid = 'public.review_runs'::regclass
  ) then
    alter table public.review_runs
      add constraint fk_review_runs_ws_doc
      foreign key (workspace_id, document_id)
      references public.documents (workspace_id, id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'fk_comments_ws_doc'
      and conrelid = 'public.comments'::regclass
  ) then
    alter table public.comments
      add constraint fk_comments_ws_doc
      foreign key (workspace_id, document_id)
      references public.documents (workspace_id, id) on delete cascade;
  end if;
end $$;

-- ---------- 4. Domain CHECK constraints ([DEF-14], [DEF-18]) ----------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_documents_title_len'
      and conrelid = 'public.documents'::regclass
  ) then
    alter table public.documents
      add constraint chk_documents_title_len
      check (char_length(btrim(title)) between 1 and 200) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_documents_content_nonblank'
      and conrelid = 'public.documents'::regclass
  ) then
    alter table public.documents
      add constraint chk_documents_content_nonblank
      check (char_length(btrim(content)) >= 1) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_findings_offsets'
      and conrelid = 'public.findings'::regclass
  ) then
    alter table public.findings
      add constraint chk_findings_offsets
      check (start_offset >= 0 and end_offset > start_offset) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_findings_confidence'
      and conrelid = 'public.findings'::regclass
  ) then
    alter table public.findings
      add constraint chk_findings_confidence
      check (confidence is null or (confidence >= 0 and confidence <= 1)) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_decisions_edited_text'
      and conrelid = 'public.review_decisions'::regclass
  ) then
    alter table public.review_decisions
      add constraint chk_decisions_edited_text
      check (
        decision <> 'edited'
        or (edited_text is not null and char_length(btrim(edited_text)) between 1 and 500)
      ) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_decisions_rejected_comment'
      and conrelid = 'public.review_decisions'::regclass
  ) then
    alter table public.review_decisions
      add constraint chk_decisions_rejected_comment
      check (
        decision <> 'rejected'
        or (comment is not null and char_length(btrim(comment)) between 1 and 500)
      ) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_decisions_comment_len'
      and conrelid = 'public.review_decisions'::regclass
  ) then
    alter table public.review_decisions
      add constraint chk_decisions_comment_len
      check (comment is null or char_length(btrim(comment)) <= 500) not valid;
  end if;
end $$;

-- ---------- 5. Concurrency guard: at most one running review per document ([DEF-15]) ----------
create unique index if not exists uq_review_runs_one_running
  on public.review_runs (document_id)
  where status = 'running';

-- ---------- 6. Atomic transactional RPC for human decisions ([DEF-15], [DEF-18]) ----------
create or replace function public.record_review_decision(
  p_suggestion_id uuid,
  p_decision text,
  p_edited_text text default null,
  p_comment text default null
)
returns table (
  decision_id uuid,
  decision text,
  edited_text text,
  comment text,
  created_at timestamptz,
  document_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_ws uuid;
  v_run_id uuid;
  v_doc_id uuid;
  v_sug_text text;
  v_edited text := null;
  v_comment text := null;
  v_dec_id uuid;
  v_created_at timestamptz;
  v_latest_run uuid;
  v_pending_count int;
  v_total_count int;
  v_doc_status text := null;
begin
  if v_uid is null then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  if p_decision is null or p_decision not in ('accepted', 'edited', 'rejected', 'dismissed') then
    raise exception 'Decision must be accepted, edited, rejected, or dismissed.'
      using errcode = '22023';
  end if;

  if p_comment is not null then
    v_comment := nullif(btrim(p_comment), '');
    if v_comment is not null and char_length(v_comment) > 500 then
      raise exception 'Comment must be 500 characters or fewer.'
        using errcode = '22023';
    end if;
  end if;

  if p_decision = 'edited' then
    if p_edited_text is not null then
      v_edited := nullif(btrim(p_edited_text), '');
    end if;
    if v_edited is null or char_length(v_edited) > 500 then
      raise exception 'Edited text (1..500 chars) is required when saving an edited revision.'
        using errcode = '22023';
    end if;
  end if;

  if p_decision = 'rejected' and v_comment is null then
    raise exception 'A rejection reason is required when rejecting a finding.'
      using errcode = '22023';
  end if;

  select s.workspace_id, f.review_run_id, r.document_id, s.suggested_text
    into v_ws, v_run_id, v_doc_id, v_sug_text
  from public.suggestions s
  join public.findings f on f.id = s.finding_id
  join public.review_runs r on r.id = f.review_run_id
  where s.id = p_suggestion_id
  for update of s;

  if v_ws is null or not public.is_member(v_ws) then
    raise exception 'Suggestion not found' using errcode = 'P0002';
  end if;

  if not public.has_role(v_ws, array['approver','manager','admin']) then
    raise exception 'Your role cannot record decisions' using errcode = '42501';
  end if;

  if p_decision in ('accepted', 'edited') and v_sug_text is null then
    raise exception 'Cannot accept or edit a finding without a suggested revision.'
      using errcode = '22023';
  end if;

  insert into public.review_decisions (
    workspace_id, suggestion_id, reviewer_id, decision, edited_text, comment
  ) values (
    v_ws, p_suggestion_id, v_uid, p_decision, v_edited, v_comment
  )
  returning id, review_decisions.created_at into v_dec_id, v_created_at;

  update public.suggestions
     set status = p_decision
   where id = p_suggestion_id
     and workspace_id = v_ws;

  insert into public.audit_events (
    workspace_id, actor_id, action, entity_type, entity_id, metadata
  ) values (
    v_ws,
    v_uid,
    'decision.recorded',
    'suggestion',
    p_suggestion_id,
    jsonb_strip_nulls(jsonb_build_object(
      'decision', p_decision,
      'document_id', v_doc_id,
      'review_run_id', v_run_id,
      'comment', v_comment
    ))
  );

  select id into v_latest_run
  from public.review_runs
  where document_id = v_doc_id
    and workspace_id = v_ws
    and status = 'completed'
  order by started_at desc
  limit 1;

  if v_latest_run = v_run_id then
    select count(*), count(*) filter (where s.status = 'pending')
      into v_total_count, v_pending_count
    from public.findings f
    join public.suggestions s on s.finding_id = f.id
    where f.review_run_id = v_latest_run
      and f.workspace_id = v_ws;

    if v_total_count > 0 and v_pending_count = 0 then
      update public.documents
         set status = 'reviewed', updated_at = now()
       where id = v_doc_id
         and workspace_id = v_ws;

      insert into public.audit_events (
        workspace_id, actor_id, action, entity_type, entity_id, metadata
      ) values (
        v_ws,
        v_uid,
        'document.reviewed',
        'document',
        v_doc_id,
        jsonb_build_object('review_run_id', v_latest_run, 'decided_count', v_total_count)
      );
      v_doc_status := 'reviewed';
    end if;
  end if;

  return query select v_dec_id, p_decision, v_edited, v_comment, v_created_at, v_doc_status;
end;
$$;

revoke all on function public.record_review_decision(uuid, text, text, text) from public, anon;
grant execute on function public.record_review_decision(uuid, text, text, text) to authenticated, service_role;

-- ---------- 7. Tighten seeded "best practices" false-positive regex ([DEF-22]) ----------
update public.guideline_rules
   set pattern = '\b(?:cheapest|best(?!\s+practices\b)|number one)(?:\s+and\s+(?:cheapest|best(?!\s+practices\b)|number one))?\b'
 where pattern = '\b(?:cheapest|best|number one)(?:\s+and\s+(?:cheapest|best|number one))?\b';

-- =====================================================================
-- ROLLBACK NOTE (run manually only if reverting Migration 0004)
-- =====================================================================
-- revoke all on function public.record_review_decision(uuid, text, text, text) from authenticated, service_role;
-- drop function if exists public.record_review_decision(uuid, text, text, text);
-- drop index if exists public.uq_review_runs_one_running;
-- alter table public.review_decisions drop constraint if exists chk_decisions_comment_len;
-- alter table public.review_decisions drop constraint if exists chk_decisions_rejected_comment;
-- alter table public.review_decisions drop constraint if exists chk_decisions_edited_text;
-- alter table public.findings drop constraint if exists chk_findings_confidence;
-- alter table public.findings drop constraint if exists chk_findings_offsets;
-- alter table public.documents drop constraint if exists chk_documents_content_nonblank;
-- alter table public.documents drop constraint if exists chk_documents_title_len;
-- alter table public.comments drop constraint if exists fk_comments_ws_doc;
-- alter table public.review_runs drop constraint if exists fk_review_runs_ws_doc;
-- alter table public.guideline_rules drop constraint if exists fk_guideline_rules_ws_guideline;
-- alter table public.documents drop constraint if exists uq_documents_ws_id;
-- alter table public.guidelines drop constraint if exists uq_guidelines_ws_id;
-- (Restore 0002 versions of enforce_documents_immutable_columns, documents_insert policy, and seed pattern if needed.)

