# Known Limitations

## Current Milestone State (M0 + M1 Complete; M2–M3 Pending)

- **Review & Decision Workflows Not Yet Connected (`M2` / `M3`):** `POST /api/review` and `POST /api/suggestions/[id]/decision` intentionally return `HTTP 501 {"error":"not_implemented"}`. `/documents/[id]` renders persisted draft copy in read-only mode with `"Review engine arrives in M2"`, and `/documents/[id]/history` renders `"Coming in M3"`.
- **SQL & Live Groq Verification Are Human-Executed (`USER-RUN`):** `supabase/tests/rls_checks.sql` (cases `a`–`e` + `pg_policies` summary) must be run directly in the user's Supabase SQL Editor, and live Groq end-to-end inference via `POST http://127.0.0.1:8000/review` requires the user-held `AI_SERVICE_TOKEN` inside `ai-service/.env`.
- **No `/documents` Index Route:** M1 exposes `/dashboard`, `/knowledge`, `/documents/new`, `/documents/[id]`, and `/documents/[id]/history`; no `/documents` index page exists (`GET /documents` returns `404` when authenticated, `307 -> /login` when unauthenticated).

## Open QA Findings (Tier B — Awaiting Explicit Approval)

- **SSR Route Latency Over Remote Supabase Auth (`[DEF-11]`):** Protected SSR navigations to `/dashboard` currently perform remote `supabase.auth.getUser()` validation in both `web/middleware.ts` and `web/lib/workspace.ts`, yielding `2861–4145 ms` full-page loads in local production tests (`median 3372.1 ms`) vs `466–902 ms` on `GET /api/documents`.
- **Streaming `loading.tsx` Soft-404 Status (`[DEF-12]`):** Adding `loading.tsx` boundaries on parent `(app)` and `[id]` dynamic routes causes Next.js to stream `HTTP 200` headers before `notFound()` renders `"Page not found"` in DOM on `/documents/not-a-uuid` and `/documents/not-a-uuid/history`.
- **`documents_update` RLS & Indexes (`[DEF-10]`):** While M1 exposes no document `UPDATE` endpoint/UI, `supabase/migrations/0001_schema.sql` `documents_update` `with check` does not lock immutable columns (`workspace_id`, `created_by`), grants broad `DELETE` privileges, and leaves several RLS predicate columns unindexed.
- **FastAPI Schema Validation Before Auth (`[DEF-08]`):** `ai-service/main.py` checks `x-api-key` inside the `POST /review` handler body rather than `Depends()`, returning `422` instead of `401` when `{}` is sent without a key.
- **ESLint & Transitive `postcss` Advisories (`[DEF-09]`):** No `eslint` script is configured in `web/package.json`, and `pnpm audit` reports 4 transitive advisories (`2 high`, `2 moderate`) in `next > postcss <= 8.5.22`.

## Architectural & Engine Limitations (From Pack Design)

- **Deterministic Fact Pattern Scope:** Regex fact matching (`approved_facts.match_pattern`) only catches facts phrased in structures the pattern expects; it is not open-ended general fact verification.
- **Broad Promotional Rule Patterns:** Seeded claim rules (e.g., matching `"best"` or `"guarantee"`) can trigger false positives on benign uses; human review remains required.
- **Unicode Offset Divergence:** Python string offsets (`start_offset`, `end_offset`) count Unicode code points, whereas JavaScript strings index UTF-16 code units. Frontend highlighting (M2) must verify `text.slice(start, end) === matched_text` and fall back to `indexOf` if needed.
- **Character Limit:** Submitted content is capped at 6,000 characters (`MAX_DOCUMENT_CONTENT_LENGTH = 6000`).
- **Small Model Tone Limitations:** Best-effort tone checks via local 3B models (`qwen2.5:3b`) can miss nuance; findings from LLM origin remain marked `unverified` unless linked to a valid supplied `source_id`.
