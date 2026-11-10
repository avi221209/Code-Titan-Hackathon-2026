# BrandGuardian Verification & Test Evidence

Every item below records the **exact command/check, observed outcome, execution date (`IST`), and who ran it (`Agent` vs `Project Owner (USER-RUN)`)**. No live database review/decision persistence, live Groq latency, or hosted URL check is claimed as passed until executed by the Project Owner.

---

## 1. Automated Unit, Type, Build, Contract & Audit Checks (`Agent`, `2026-11-09` to `2026-11-10`)

| Check | Date (IST) | Run By | Command / Scope | Observed Result |
| --- | --- | --- | --- | --- |
| **Python AI Service Unit & API Auth Tests** | `2026-11-10` | Agent | `.\ai-service\.venv\Scripts\python.exe -m pytest -q ai-service` | `12 passed, 1 warning in 0.55s` (`exit 0`, covers Asterra expected findings, UTF/offset verification, prompt-injection `< /document>` breakout, malformed LLM JSON handling, `401` before `422` via `Depends(require_key)`) |
| **TypeScript Typecheck (Project)** | `2026-11-10` | Agent | `pnpm --dir web typecheck` (`tsc --noEmit`) | `exit 0` |
| **TypeScript Strict Unused Check** | `2026-11-10` | Agent | `pnpm --dir web exec tsc --noEmit --noUnusedLocals --noUnusedParameters` | `exit 0` |
| **Web Validator & Security Unit Tests** | `2026-11-10` | Agent | `pnpm --dir web test` (`node --test lib/validators/*.test.*`) | `tests 17 / pass 17 / fail 0` (`193.025ms`: `decision.test.ts` `4`, `m1.test.ts` `5`, `review.test.ts` `7`, `security.test.mjs` `1`) |
| **Web Production Build (Local Repo)** | `2026-11-10` | Agent | `pnpm --dir web build` (`next build`) | `exit 0` (`✓ Compiled successfully in 4.1s`, `7/7` static routes, `102 kB` shared First Load JS) |
| **Web Clean-Env Isolated Checkout Build** | `2026-11-10` | Agent | Exported `HEAD:web` to `%TEMP%\bg-clean-build` (`CLEAN_ENV_LOCAL_EXISTS=False`), set only the 7 documented vars from `web/.env.example`, ran `pnpm install --frozen-lockfile --ignore-scripts` + `pnpm exec next build` | `CLEAN_INSTALL_EXIT=0 CLEAN_BUILD_EXIT=0` (`✓ Compiled successfully in 25.1s`, `7/7` static routes) |
| **Web Runtime Hardcoded Localhost & Env Scan** | `2026-11-10` | Agent | `git grep -n -E "localhost\|127\.0\.0\.1" web/` & `git grep -n "process\.env" web/` | Only `web/next.config.mjs:14` dev-only HMR CSP matches localhost; zero undocumented env variables; `web/app/api/review/route.ts:12` exports `maxDuration = 60` |
| **Schema & API Contract Verification** | `2026-11-10` | Agent | `check_contracts.py` (comparing `web/lib/types/finding.ts` vs `ai-service/main.py` & `web/` Supabase queries vs `0001_schema.sql`) | `Finding: match=True`, `ReviewResponse: match=True`, `checked_clauses=104`, `errors=[]` |
| **Secret & Client Audit-Write Isolation Scan** | `2026-11-10` | Agent | Tracked `.env*` scan, `.next/static/**/*.js` scan, `'use client'` source grep, `git grep -n "audit_events" web/` | `0` tracked non-example `.env*` files, `0` secret hits in client/static bundles, `0` user-client `audit_events` inserts (only `createAdminClient()` writes) |
| **Dependency Advisory Audit (`[DEF-09]`)** | `2026-11-10` | Agent | `pnpm --dir web audit --json` | `info: 0, low: 0, moderate: 2, high: 2, critical: 0` (4 transitive `next > postcss <= 8.5.22` advisories logged as deferred Tier B `[DEF-09]`) |

---

## 2. Production Server HTTP, Negative Auth & Chromium Layout Checks (`Agent`, `2026-11-09` to `2026-11-10`)

- **Local Production `next start` (`:3100` & `:3101`) Negative & UI Verification (`2026-11-10`, Agent):**
  - `GET http://127.0.0.1:3100/api/health` -> `HTTP 200` `{"status":"ok","service":"brandguardian-web","supabase_configured":true,"ai_service_configured":true}`
  - `GET /api/review` -> `405`; unauthenticated `POST /api/review` -> `401`
  - Authenticated `/api/review` malformed JSON -> `400`, bad UUID -> `400`, nonexistent UUID -> `404`
  - `GET /api/suggestions/<uuid>/decision` -> `405`; unauthenticated `POST` (valid & invalid UUID) -> `401` `{"error":"Unauthorized"}`
  - Authenticated `/api/suggestions/<uuid>/decision` invalid UUID / bad JSON / invalid enum `"auto_publish"` / blank `editedText` / blank `comment` / `501`-char comment -> all `400`; missing suggestion UUID -> `404` `{"error":"Suggestion not found."}`
  - Headless Chromium on `/documents/[id]` (`1440px` & `375px`): `overflow_1440: false`, `overflow_375: false`, `console_errors: []`, `page_errors: []`; clicking **Run review** when server secrets were unset rendered honest `HTTP 503` inline alert and re-enabled the button.
  - Headless Chromium on `/documents/[id]/history` (`1440px` & `375px`): `<h1>Document Audit History</h1>`, honest empty state, working `"Back to document"` link, `overflow_1440: false`, `overflow_375: false`, `console_errors: []`, `page_errors: []`.
- **Earlier Round 2 Security/Perf Benchmarks (`2026-11-09` to `2026-11-10`, Agent):**
  - Security headers (`a665b88`): `x-powered-by: null`, CSP, `X-Frame-Options: DENY`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `csp_violations: []`.
  - Pre-validation optimization (`[DEF-07]`, `09367e8`): malformed `/api/documents` payloads rejected `HTTP 400` in `254.2–319.3 ms` (down from `710–1324 ms`).
  - `/dashboard` protected SSR timing (`next start -p 3000`, `2026-11-10`): `[4224.2, 1559.9, 1309.2, 1613.7, 1399.3] ms` (`median 1559.9 ms`, `cold max 4224.2 ms` — logged open as Tier B `[DEF-11]`).

---

## 3. Supabase RLS & Hardening Execution (`Project Owner (USER-RUN)`, `2026-11-10`)

Executed manually by the **Project Owner (`USER-RUN`)** in the **Supabase SQL Editor** after applying [`supabase/migrations/0002_rls_hardening.sql`](../supabase/migrations/0002_rls_hardening.sql):

1. **Workspace Isolation & Column Immutability (`supabase/tests/rls_checks.sql`, Cases `a`–`g`):**
   - **Observed Outcome:** **`7 of 7` cases PASS (`true`)**:
     - `(a)` `judge@brandguardian.demo` reads Asterra knowledge (`rules=5, facts=5, terminology=2`).
     - `(b)` `judge@brandguardian.demo` reads `0` Northwind workspaces/facts.
     - `(c)` `outsider@brandguardian.demo` reads `0` Asterra workspaces, rules, facts, terminology, or documents.
     - `(d)` `creator`-role member insert into `approved_facts` denied (`SQLSTATE 42501`).
     - `(e)` Spoofing another user's `created_by` on `documents` insert denied (`SQLSTATE 42501`).
     - `(f)` Updating `documents.workspace_id` denied (`SQLSTATE 42501` via `trg_documents_immutable_columns`).
     - `(g)` Updating `documents.created_by` denied (`SQLSTATE 42501` via `trg_documents_immutable_columns`).
2. **`pg_policies` Summary (`rls_checks.sql` Block 2):**
   - **Observed Outcome:** RLS enabled and policies active across **all `14` public tables**.
3. **Privilege Audit After `0002_rls_hardening.sql`:**
   - **Observed Outcome:** **`0` `DELETE` grants** remain on `public` tables for the `authenticated` role.

---

## 4. `PENDING (USER-RUN)` Live Cloud, AI, Decision & SQL Checks

All checks below remain **`PENDING`** until executed by the Project Owner with live secrets / Docker / cloud hosts:

| Pending Test | Execution Owner | Expected Verification & Output Placeholder |
| --- | --- | --- |
| **Container Build (`ai-service/Dockerfile`)** | `USER-RUN` *(Docker CLI not installed in agent environment)* | `PENDING`: run `docker build -t brandguardian-ai ai-service`, start container with `--env-file .env`, verify `GET /health` `200` and `POST /review` `{}` `401` |
| **Live M2 Asterra Compliance Review + Latency** | `USER-RUN` | `PENDING`: click **Run review** on `"Asterra Flow Launch Draft"` -> verify 4 findings (`consumers`, `founded in 2019` -> `2021`, `cheapest and best`, `guarantee ...`), `Verified`/`Unverified`, refresh persistence, concurrent double-submit `409`, and record measured Groq latency (`[median ms / max ms]`) |
| **Live M2 Degraded Modes & Prompt Injection** | `USER-RUN` | `PENDING`: test FastAPI unreachable (`HTTP 502`, `'failed'` run, `0` findings), temporary invalid Groq key (`ai_status: "unavailable"`, `"AI unavailable"` banner + deterministic findings saved), and live `< /document>` prompt-injection draft |
| **Live M3 Human Decision Workflow & Audit History** | `USER-RUN` | `PENDING`: verify High/Critical **Evidence** starts collapsed & **Accept** locked until **Inspect evidence**, blank **Reject** inline `400`, persist **Accept`/`Edit`/`Reject`/`Dismiss** across hard refresh, repeat decision `409`, **"Preview final text"** + **Copy**, automatic `documents.status = 'reviewed'`, and `/documents/[id]/history` timeline |
| **Decision RLS Isolation SQL (`supabase/tests/decision_rls.sql`)** | `USER-RUN` | `PENDING`: run `cases a–d` (`approver` allow, `creator` `42501`, duplicate `23505`, outsider cross-workspace `42501`) in Supabase SQL Editor (`begin`/`rollback`) |
| **Server-Only Audit Lock (`0003_audit_server_only.sql`)** | `USER-RUN` *(post-test ONLY)* | `PENDING`: apply in Supabase SQL Editor **only after** a live M3 decision test succeeds cleanly |
| **Deployed Cloud Incognito Verification (`<AI_URL>`, `<WEB_URL>`)** | `USER-RUN` | `PENDING`: verify `GET <AI_URL>/health`, `GET <WEB_URL>/api/health`, and 1 full incognito review run from clean browser session (`docs/deployment.md` Section 6) |
