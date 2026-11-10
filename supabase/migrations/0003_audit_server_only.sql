-- =====================================================================
-- BrandGuardian — Migration 0003: Server-Only Audit Events (NOT APPLIED)
-- =====================================================================
-- DO NOT APPLY until after an M3 human-decision test passes cleanly.
-- All web/ audit_events inserts (`review.completed`, `decision.recorded`,
-- `document.reviewed`) run server-side via createAdminClient() (service_role).
-- Dropping `audit_insert` prevents authenticated client sessions from
-- forging arbitrary audit_events rows directly through PostgREST while
-- preserving authenticated SELECT via `audit_events_select`.
-- =====================================================================

drop policy if exists audit_insert on public.audit_events;

-- =====================================================================
-- ROLLBACK NOTE (run manually only if reverting Migration 0003)
-- =====================================================================
-- create policy audit_insert on public.audit_events for insert to authenticated
--   with check (actor_id = (select auth.uid()) and public.is_member(workspace_id));
