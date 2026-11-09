# BrandGuardian — Project State

**Last Updated:** 2026-11-09  
**Current Milestone:** M1 — Foundation (Auth, Workspace Data, Document Persistence, RLS Proof)  
**Milestone Status:** CODE COMPLETE (Pending Live Browser Incognito & Supabase SQL Editor Verification)  
**Next Milestone:** M2 — Review Engine (Deterministic + AI Checks, Findings, Audit Trail) — *Do not start until M1 acceptance is signed off.*

---

## Reality Check (Empirically Verified)

- **Repository & Branch:** `E:/Plugins/Get Shit Done/Code Titan 2026/brandguardian` on `main` (M0 baseline `1fc322b` at HEAD before M1 commit; `chunks-tmp` preserved untouched; parent repo untouched).
- **Web (`web/`):**
  - `pnpm --dir web test`: **5/5 passed** (`lib/validators/m1.test.ts` — route guards, UUID guard, login validation, document 6,000-char limit + `\r\n` normalization).
  - `pnpm --dir web typecheck` (`tsc --noEmit`): **exit 0**.
  - `pnpm --dir web build` (`next build`): **exit 0** (Next.js `15.5.29`, React `19.3.1`, TypeScript `5.9.3`, `@supabase/ssr` `0.5.2`).
- **AI Service (`ai-service/`):**
  - `ai-service/.env.example` sets `LLM_PROVIDER=groq`.
  - `git diff ai-service/main.py` is **empty** (`main.py` untouched).
  - `pytest -v ai-service/test_checks.py`: **11/11 passed**.
- **Secret Isolation Proof (`web/` source + `.next/static/*.js`):**
  - Zero occurrences of `DEMO_PASSWORD`, `DEMO_EMAIL`, `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`, or `AI_SERVICE_TOKEN` in any `'use client'` file, any `NEXT_PUBLIC_*` variable name, or `.next/static/*.js`.
  - `DEMO_EMAIL` / `DEMO_PASSWORD` are isolated exclusively inside `getDemoCredentials()` in server-only `web/lib/env.ts` and `signInWithDemoAction()` in `web/app/(auth)/login/actions.ts`. Admin client (`SUPABASE_SERVICE_ROLE_KEY`) is unused in M1.
- **Production Server Probe (`next start -p 3100`, `web/.env.local` absent on disk):**
  - `GET /`: `HTTP 200`
  - `GET /login`: `HTTP 200` (renders demo + email/password forms with unconfigured env warning)
  - `GET /dashboard`, `GET /knowledge`, `GET /documents/new`, `GET /documents/11111111-1111-4111-8111-111111111111`: `HTTP 307 -> /login`
  - `GET /api/health`: `HTTP 200` (`"supabase_configured":false,"ai_service_configured":false`)
  - `GET /api/documents` & `POST /api/documents`: `HTTP 503` (`"Supabase environment variables are not configured."` — clean guard without uncaught 500)
  - `POST /api/review` & `POST /api/suggestions/test-id/decision`: `HTTP 501` (`{"error":"not_implemented"}`)

## M1 Acceptance Matrix

| # | Criterion | Status | Evidence / Notes |
| --- | --- | --- | --- |
| 1 | `pnpm build` & `tsc --noEmit` pass; `ai-service` untouched | **PASS** | `pnpm test` (`5/5`), `tsc --noEmit` (`0`), `next build` (`0`), `pytest` (`11/11`), empty diff on `ai-service/main.py` |
| 2 | Incognito `/dashboard` -> `/login`, demo sign-in -> real `/dashboard` | **PARTIAL (Pending Live `.env.local`)** | Redirect (`307 -> /login`) verified against built server; live Supabase sign-in & counts await user populating `web/.env.local` |
| 3 | `/knowledge` renders Asterra Rules, Facts & Terminology from DB | **PENDING Live `.env.local`** | Implemented via USER client + RLS (`KnowledgeTabs`); awaits live session check |
| 4 | Document created from Asterra sample persists across hard refresh | **PENDING Live `.env.local`** | `NewDocumentForm` (`"Load Asterra sample"`), `POST /api/documents`, and `/documents/[id]` implemented; awaits live session check |
| 5 | `DEMO_PASSWORD` & `SUPABASE_SERVICE_ROLE_KEY` absent from client / `NEXT_PUBLIC_` | **PASS** | Verified across `web/` source and `.next/static/*.js` (`0` hits) |
| 6 | `supabase/tests/rls_checks.sql` ready & verified | **SCRIPT READY (Pending SQL Editor Run)** | Script written with temp `results` table, impersonation cases `(a)`–`(e)`, `rollback`, and separate `pg_policies` summary block |

## Locked Architectural Decisions (M0 + M1)

1. **1:1 Finding & ReviewResponse Contract:** `web/lib/types/finding.ts` mirrors `ai-service/main.py` fields identically (`category`, `severity`, `matched_text`, `start_offset`, `end_offset`, `explanation`, `source_type`, `source_id`, `confidence`, `verification_status`, `origin`, `suggested_text`; `document_id`, `model_name`, `ai_status`, `ai_detail`, `findings`, `dropped`, `elapsed_ms`).
2. **Design Tokens:** Editorial SaaS tokens in `web/app/globals.css` and `web/tailwind.config.ts` (`#F7F5F0` warm paper, `#14171C` ink, `#0F6B6B` deep teal, severity palette, `Fraunces`/`Inter`/`JetBrains Mono`).
3. **Credential & M1 Env Isolation:** `getDemoCredentials()` and `getServerEnv()` live in server-only `web/lib/env.ts` without coupling M1 runtime to M2 variables (`SUPABASE_SERVICE_ROLE_KEY`, `AI_SERVICE_URL`, `AI_SERVICE_TOKEN`). All M1 DB access runs exclusively through the cookie-backed USER client (`createClient()`) so PostgreSQL RLS policies remain the authority.
4. **Per-Request Workspace Caching:** `getWorkspaceContext()` in `web/lib/workspace.ts` is wrapped in `React.cache()` so `(app)` layout and nested pages share a single `auth.getUser()` + `workspace_members` round-trip per request.
5. **Graceful Unconfigured Env Behaviour:** Until `web/.env.local` is populated, `/login` renders HTTP `200` with a configuration banner, protected routes redirect cleanly (`307 -> /login`), and `/api/documents` returns HTTP `503` instead of throwing an unhandled `500`.
6. **Honest Terminology Metadata:** `public.terminology` defines `(id, workspace_id, term, preferred_term, notes)` with no `source_name`/`status` column in `0001_schema.sql`; UI labels entries as `Workspace glossary` + `Active` without altering schema.

## Pending User Verification Before M2

1. Populate `web/.env.local` locally (never committed) with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DEMO_EMAIL=judge@brandguardian.demo`, and `DEMO_PASSWORD=<your demo user password>`.
2. Run Block 1 (cases `(a)`–`(e)`) and Block 2 (`pg_policies` summary) of `supabase/tests/rls_checks.sql` in Supabase SQL Editor and inspect results.
3. Run `pnpm --dir web dev`, test incognito `/dashboard` -> `/login`, click `"Enter demo workspace"`, inspect `/dashboard` and `/knowledge`, create `"Asterra Flow Launch Draft"` via `/documents/new` -> `"Load Asterra sample"` -> `"Save document"`, verify `/documents/[id]` persists across hard refresh, and confirm M1 sign-off before planning M2.
