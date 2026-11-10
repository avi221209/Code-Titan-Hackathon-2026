# Known Limitations

## Current Milestone State (M0–M3 Implemented; Live DB E2E & M4+ Pending)

- **Live Review & Decision DB Writes Require Server Secrets (`USER-RUN`):** `POST /api/review` and `POST /api/suggestions/[id]/decision` require `SUPABASE_SERVICE_ROLE_KEY` (`web/.env.local`) and a matching `AI_SERVICE_TOKEN` in both `ai-service/.env` and `web/.env.local`. Until those secrets are configured by the user, `POST /api/review` honestly refuses with `HTTP 503` (creating `0` fake findings), and end-to-end DB persistence checks for M2/M3 remain `USER-RUN`.
- **SQL Migrations `0002` & `0003` and SQL RLS Tests Are Human-Executed (`USER-RUN`):** `supabase/migrations/0002_rls_hardening.sql` (`[DEF-10]`), `supabase/tests/rls_checks.sql` (`cases a–g`), `supabase/tests/decision_rls.sql` (`cases a–d`), and `supabase/migrations/0003_audit_server_only.sql` (apply **only after a live decision test passes**) are committed in the repository and await manual execution in the Supabase SQL Editor.
- **No `/documents` Index Route or Document Editing UI:** Exposes `/dashboard`, `/knowledge`, `/documents/new`, `/documents/[id]`, and `/documents/[id]/history`; no `/documents` index route exists, and `"Preview final text"` is strictly read-only + clipboard copy without mutating the stored draft.
- **M4+ Features Not Built:** Analytics dashboards and cloud deployment automation belong to later milestones.

## Open QA Findings (Tier B — Awaiting Explicit Approval)

- **ESLint & Transitive `postcss` Advisories (`[DEF-09]`):** No `eslint` script is configured in `web/package.json`, and `pnpm audit` reports 4 transitive advisories (`2 high`, `2 moderate`) in `next > postcss <= 8.5.22`.
- **SSR Route Latency Over Remote Supabase Auth (`[DEF-11]`):** Protected SSR navigations to `/dashboard` perform remote `supabase.auth.getUser()` validation in both `web/middleware.ts` and `web/lib/workspace.ts`, measured at `[4224.2, 1559.9, 1309.2, 1613.7, 1399.3] ms` (`median 1559.9 ms`, cold max `4224.2 ms`) against a local `next start` build.
- **Streaming `loading.tsx` Soft-404 Status (`[DEF-12]`):** `loading.tsx` boundaries covering parent `(app)` and `[id]` dynamic segments cause Next.js to stream `HTTP 200` headers before `notFound()` renders `"Page not found"` in DOM on invalid/missing document UUIDs.

*(Resolved Tier B from earlier rounds: `[DEF-08]` FastAPI `Depends(require_key)` fixed in `3727052`; `[DEF-10]` SQL `0002_rls_hardening.sql` committed in `1db160f`, pending SQL Editor.)*

## Architectural & Engine Limitations

- **Deterministic Fact Pattern Scope:** Regex fact matching (`approved_facts.match_pattern`) only catches facts phrased in structures the pattern expects; it is not open-ended general fact verification.
- **Broad Promotional Rule Patterns:** Seeded claim rules (e.g., matching `"best"` or `"guarantee"`) can trigger false positives on benign uses; human review remains required.
- **Unicode Offset Divergence:** Python string offsets (`start_offset`, `end_offset`) count Unicode code points, whereas JavaScript strings index UTF-16 code units. Both highlighting (`resolveHighlightSpan`) and final-text preview (`applyAcceptedEditsToDocument`) verify exact slice equality and fall back to `indexOf` on UTF-16 surrogate-pair drift (e.g. emojis), leaving unmatched spans unhighlighted rather than corrupting text.
- **Character Limit:** Submitted content is capped at 6,000 characters (`MAX_DOCUMENT_CONTENT_LENGTH = 6000`).
- **Model Nuance & Grounding Guardrail:** Best-effort LLM tone/claim findings (`origin: "llm"`) remain marked `unverified` unless linked to a supplied workspace `rule_id`, and hallucinated quotes not present in the document are discarded before persistence.
