# BrandGuardian Feature Inventory

Claims below distinguish strictly between **verified implemented capabilities**, **partial / `USER-RUN`-blocked verifications**, and **features NOT built** in Round 2.

---

## 1. Completed Features (Code + Verified Evidence)

| Area | Implemented Capability | Verification Evidence |
| --- | --- | --- |
| **Authentication & Demo Entry (`M1`)** | `/login` renders `"Enter demo workspace"` server-side demo action (reads `DEMO_EMAIL`/`DEMO_PASSWORD` strictly server-side via `getDemoCredentials()`) plus email/password sign-in, session refresh middleware, and sign-out | Verified in `web/app/(auth)/login/`, `web/middleware.ts`, `m1.test.ts` (`5/5`), production Playwright sign-in & redirect flows |
| **Workspace Dashboard & Knowledge Ledger (`M1`)** | `/dashboard` displays active workspace name, member role badge, knowledge counts (`Guideline rules`, `Approved facts`, `Terminology`), and `Recent Documents` scoped by RLS; `/knowledge` renders read-only **Rules**, **Facts**, and **Terminology** tabs | Verified against Asterra workspace seed, Playwright desktop (`1440px`) & mobile (`375px`) zero horizontal overflow & zero console errors |
| **Draft Persistence (`M1`)** | `/documents/new` (`<= 6,000` chars, `"Load Asterra sample"`, char counter, client & server NUL-byte/array validation) persists drafts via `POST /api/documents` | Verified in `web/lib/validators/m1.ts`, `m1.test.ts`, HTTP `400`/`401`/`403` benchmarks (`[DEF-07]`, `09367e8`) |
| **PostgreSQL RLS & Hardening (`M1` / `M3`)** | `14` public tables with RLS enabled (`0001_schema.sql`), `0002_rls_hardening.sql` (`(select auth.uid())`, `documents.workspace_id`/`created_by` immutability trigger, `REVOKE DELETE` from `authenticated`, 4 lookup indexes), plus `decision_rls.sql` & post-test `0003_audit_server_only.sql` | `0002` + `rls_checks.sql` **executed by Project Owner (`USER-RUN`)**: `7 of 7` cases (`a`–`g`) passed, `14` tables covered by `pg_policies`, `0` `DELETE` grants for `authenticated` |
| **Deterministic Compliance Engine (`M2`)** | FastAPI `ai-service/main.py` runs `check_terminology`, `check_facts` (single-capture regex), and `check_rules` (pattern matching), followed by `verify()` span & `source_id` validation; `POST /review` enforces `Depends(require_key)` auth before Pydantic parsing (`[DEF-08]`) | Verified in `ai-service/test_checks.py` (`12/12 passed in 0.55s` on `2026-11-10`, including `401` on `{}` without `x-api-key`) |
| **Prompt-Guarded LLM Inspection (`M2`)** | Optional structured JSON extraction via Groq (`openai/gpt-oss-20b`, hosted demo) or Ollama (`qwen2.5:3b`, local only) with `<document>` breakout sanitization, quote-location grounding, hallucinated-quote dropping, overlap suppression, and honest `ai_status` (`ok`/`unavailable`/`invalid_output`/`skipped`) | Verified by unit/pytest suites (`12/12` pytest including tag-breakout, bad-JSON, and `uvicorn`/FastAPI tests) and `verify()` / `validateReviewResponse` (`7/7` `review.test.ts` tests) |
| **Review BFF Route (`M2`)** | `POST /api/review` (`maxDuration = 60`, `AbortSignal.timeout(50_000)`) enforces auth, UUID/body validation, `90s` stale running-run cleanup, concurrent winner tie-break (`409`), USER RLS knowledge loading, and ADMIN persistence + atomic `markRunFailed` rollback (`502`) | Route compiled dynamically in `next build`; negative matrix (`405`/`401`/`400`/`404`) and missing-secret `503` UI alert verified against `:3100`; live DB write pass awaits `USER-RUN` |
| **Two-Pane Findings & Evidence UI (`M2` / `M3`)** | `/documents/[id]` renders interactive copy highlights (`slice` + UTF-16 `indexOf` fallback), keyboard navigation (`j` / `k`), severity + category + `Verified`/`Unverified` + `AI-generated` badges, confidence `"estimate"`, collapsed Evidence gate on High/Critical findings, `AiStatusBanner`, and read-only `"Preview final text"` + **Copy** | Unit-verified in `review.test.ts` (`7/7`) & `decision.test.ts` (`4/4`); UI structure, `1440px`/`375px` layout, zero console errors verified on `:3100` |
| **Human Decisions & Audit History (`M3`)** | `POST /api/suggestions/[id]/decision` inserts `review_decisions` under **USER RLS** (`42501` -> `403`, `23505` -> `409`), updates `suggestions.status`, logs `decision.recorded` & `document.reviewed` via ADMIN client; `/documents/[id]/history` renders chronological `audit_events` with resolved actor display names | Negative/validation suite (`405`/`401`/`400`/`404`) & `/history` empty state verified on `:3100`; unit logic (`decision.test.ts` `4/4`) passed; live decision DB write awaits `USER-RUN` |
| **Security Headers & Deployment Prep** | `poweredByHeader: false`, CSP, `Permissions-Policy`, `server-only` guards, non-root `ai-service/Dockerfile`, zero undocumented env vars, clean checkout build with no `.env.local` | Verified in `security.test.mjs` (`1/1`), `git grep` secret/localhost scans (`0` hits), `CLEAN_BUILD_EXIT=0`, [`docs/deployment.md`](deployment.md) |

---

## 2. Partial / Pending `USER-RUN` Items

- **Live End-to-End M2 Review & M3 Decision Persistence Against Real Supabase & Groq:** All M2/M3 route handlers, validators, and UI components are implemented and tested statically and on negative/empty paths; live DB writes (`review_runs`, `findings`, `suggestions`, `review_decisions`, `documents.status = 'reviewed'`, `audit_events`) require server-side secrets configured locally or on Vercel/Render and executed end-to-end by the Project Owner (`USER-RUN`).
- **Live Degraded-Mode E2E Tests:** FastAPI-unreachable rollback (`HTTP 502`, `'failed'` run, `0` findings), wrong-`GROQ_API_KEY` (`"AI unavailable"` banner + deterministic findings saved), and live prompt-injection DB run are **`PENDING (USER-RUN)`**.
- **Manual SQL Scripts Remaining (`USER-RUN`):** `supabase/tests/decision_rls.sql` (`cases a–d`) and post-test `supabase/migrations/0003_audit_server_only.sql` are committed and awaiting execution in Supabase SQL Editor.
- **Docker Container Build & Hosted Cloud Smoke Tests (`USER-RUN`):** Docker CLI is not installed on the local build machine; building `ai-service/Dockerfile` and verifying live `<AI_URL>` & `<WEB_URL>` endpoints are **`USER-RUN`**.
- **Deferred Tier B Defects (`.planning/DECISIONS_NEEDED.md`):**
  - `[DEF-09]` Missing ESLint script + 4 transitive `postcss` advisories
  - `[DEF-11]` Cold `/dashboard` SSR load latency (`4.22s` cold / `1.56s` median)
  - `[DEF-12]` Streaming `loading.tsx` returning HTTP `200` headers before `notFound()` renders `"Page not found"` in DOM

---

## 3. Explicitly NOT Built (Out of Scope / Not Implemented)

The following capabilities do **not** exist in BrandGuardian today:

- **PDF / DOCX ingestion:** Only plain UTF-8 text up to `6,000` characters pasted or loaded into `/documents/new` is supported. No file upload, PDF parser, or DOCX parser exists.
- **Image or logo checks:** No image upload, OCR, brand-color extraction, or visual/logo compliance checking exists.
- **Analytics UI:** Although `review_decisions` (`accepted`/`edited`/`rejected`/`dismissed`) and `audit_events` capture raw rows, no charts, override/rejection analytics views, or rule-health dashboards exist.
- **Comments UI / API:** A `public.comments` table (`id`, `workspace_id`, `document_id`, `user_id`, `body`, `created_at`) and basic `select`/`insert` RLS policies exist in `0001_schema.sql`, **but no API routes or UI components exist** to create, list, or view comments.
- **Reviewer assignment:** There is no user assignment schema (`assigned_to`), assignment selector, queue filter, or notification workflow. Any `approver`, `manager`, or `admin` member of the workspace can review and decide suggestions.
- **Additional unbuilt surfaces:** No `/documents` list index route (only **Recent Documents** on `/dashboard`), no workspace knowledge editor UI (knowledge is read-only under `/knowledge` and managed in Supabase), and no document deletion or draft editing workflow.
