# BrandGuardian Verification & Test Evidence

Every item below records the **exact command/check, observed outcome, execution date (`IST`), and who ran it (`Agent` vs `Project Owner (USER-RUN)`)**. No unapplied SQL script (`0003`, `0004`, `decision_rls.sql`, `remediation_checks.sql`), live Groq latency/precision check, Docker container run, or hosted URL check is claimed as passed until executed by the Project Owner.

---

## 1. Automated Unit, Lint, Build, Security & Hygiene Checks (`Agent`, `2026-11-10`)

| Check | Date (IST) | Run By | Command / Scope | Observed Result |
| --- | --- | --- | --- | --- |
| **Python AI Service Unit & API Auth Tests** | `2026-11-10` | Agent | `.\ai-service\.venv\Scripts\python.exe -m pytest -v ai-service` | **`19 passed, 1 warning in 0.52s`** (`exit 0`, covers Asterra checks, UTF-16 astral emoji offsets, duplicate LLM quote `cursor_by_quote`, semantic `verify()` category/severity enforcement, active `APPROVED FACTS` & `TERMINOLOGY` prompt context with `< /document>` escape, `dropped` count on top-5 truncation, bounded `[0..1]` confidence, `best(?!\s+practices\b)`, `/ready`, sanitized upstream errors, and `401` before `422` via `Depends(require_key)`) |
| **TypeScript Typecheck (Project & Strict Unused)** | `2026-11-10` | Agent | `pnpm --dir web typecheck` & `pnpm --dir web exec tsc --noEmit --noUnusedLocals --noUnusedParameters` | **`exit 0`** |
| **ESLint (`[DEF-09]`)** | `2026-11-10` | Agent | `pnpm --dir web lint` (`eslint 9.39.5`, `eslint-config-next 15.5.29`, `web/.eslintrc.json`) | **`✔ No ESLint warnings or errors`** (`exit 0`) |
| **Web Unit, Workflow, Auth & Accessibility Tests** | `2026-11-10` | Agent | `pnpm --dir web test` (`node --test lib/validators/*.test.* lib/server/*.test.* lib/supabase/*.test.*`) | **`tests 34 / pass 34 / fail 0`** (`367.28ms`: `decision-workflow.test.ts` `3`, `health-workflow.test.ts` `2`, `review-workflow.test.ts` `3`, `claims.test.ts` `4`, `accessibility.test.ts` `2`, `decision.test.ts` `6`, `m1.test.ts` `5`, `review.test.ts` `8`, `security.test.mjs` `1`) |
| **Dependency Advisory Audit (`[DEF-09]`)** | `2026-11-10` | Agent | `pnpm --dir web audit --json` (with `web/pnpm-workspace.yaml` overrides `postcss: >=8.5.23`, `minimatch@^10.0.0: >=11.0.1`) | **`exit 0`, `0` advisories** (`info: 0, low: 0, moderate: 0, high: 0, critical: 0`) |
| **Web Production Build (Local Repo)** | `2026-11-10` | Agent | `pnpm --dir web build` (`next build`) | **`exit 0`** (`✓ Compiled successfully in 4.3s`, zero lint warnings, `102 kB` shared First Load JS, Middleware `95.1 kB`) |
| **Web Clean-Env Isolated Checkout Build** | `2026-11-10` | Agent | Copied working `web/` (excluding `.env*`, `.next`, `node_modules`, preserving `pnpm-workspace.yaml` & `.eslintrc.json`) to `%TEMP%\bg-clean-remediation`, set only the 7 placeholder vars from `web/.env.example`, ran `pnpm install --frozen-lockfile --ignore-scripts` + `pnpm exec next build` | **`exit 0` (`CLEAN_ISOLATED_BUILD_PASSED`)** (`✓ Compiled successfully in 16.5s`, `0` warnings, `postcss 8.5.32`) |
| **Web Runtime Localhost, `error.message` & Env Scan** | `2026-11-10` | Agent | `git grep -n -E "localhost\|127\.0\.0\.1" web/app web/components web/lib` & `git grep -n "error\.message" web/app web/components` & `git ls-files ".env*" "**/.env*"` | **`0`** runtime localhost hits in app/components/lib (only `next.config.mjs` `isDev` HMR WS), **`0`** `error.message` hits in UI/app, only `.env.example` tracked, **`0`** secrets in `35` compiled `.next/static/**/*.js` files |

---

## 2. Live Mock-HTTP, AI Trust & Production Chromium Benchmarks (`Agent`, `2026-11-10`)

- **Mock-HTTP FastAPI Upstream Resilience Verification (`verify_phase6.py`, `2026-11-10`, Agent):**
  - Ephemeral `uvicorn` + local `MockGroqHandler` verified:
    - `/ready` returns **`200` `"ready"`** (`token_configured: true`, `llm_configured: true`) when configured and **`503` `"not_ready"`** (`token_configured: false`) when missing env vars.
    - Upstream Groq `HTTP 401`, `HTTP 429`, `HTTP 500`, and simulated timeout (`LLM_TIMEOUT=1.5s`, `delay=2.2s`) all return `HTTP 200` on `POST /review` with `ai_status: "unavailable"`, preserved deterministic findings, clean user-safe `ai_detail` copy (`AI provider authentication failed...`, `AI provider rate limit reached...`, `AI provider returned a temporary upstream error...`, `AI provider request timed out...`), and zero raw Python exception class names (`HTTPStatusError`, `ReadTimeout`, `ConnectError`, `Traceback`).
- **Post-Remediation AI Trust Harness (`verify_ai_trust_after.py`, `2026-11-10`, Agent):**
  - Synthetic Asterra copy (`"We are the cheapest and best automation platform following best practices. We guarantee 300% revenue growth in just 7 days."`): **`100.0%` deterministic precision (`5/5` matched, `det_fp: 0`, `best_practices_fp: false`, `det_dropped: 0`)**.
  - Poisoned `rule_id` with mismatched category (`tone`/`critical` citing `r1` `unsupported_claim`/`high`): downgraded to **`verification_status: "unverified"`**.
  - Duplicate LLM quotes (`"Wait now."` repeated): resolved distinct UTF-16 offsets **`[[0, 9], [10, 19]]`** (`duplicate_distinct: true`); `6` findings truncated to `5` reported **`truncation_dropped_count: 1`**.
- **Playwright BEFORE vs AFTER Comparison (`probe_before_after.py` + `verify_playwright_4vp_after.py` on `:3106`, `2026-11-10`, Agent):**
  - **SSR & Auth Performance (`[DEF-11]`):** First `/login -> /dashboard` sign-in redirect dropped from **`6472.2 ms` -> `1600.2 ms`**; 5-run warm `/dashboard` benchmark improved from `[5046.5, 2011.8, 2143.7, 1650.5, 2357.9] ms` (`median 2143.7 ms`, `max 5046.5 ms`) to **`[1790.3, 1139.4, 1351.5, 1123.7, 1432.6] ms` (`median 1351.5 ms`, `max 1790.3 ms`)**.
  - **True HTTP 404 on Invalid/Missing Document UUIDs (`[DEF-12]`):** `/documents/not-a-uuid`, `/documents/not-a-uuid/history`, `/documents/00000000-0000-0000-0000-000000000000`, and `.../history` changed from HTTP `200` (soft-404) -> **`HTTP 404` across all 4 checks**.
  - **4-Viewport Layout, Keyboard, Motion & Health Probe (`verify_playwright_4vp_after.py`):** **`24/24`** route×viewport combinations (`1440×900`, `1024×768`, `768×1024`, `375×812` across `/`, `/login`, `/dashboard`, `/knowledge`, `/documents/new`, `/404`) passed with `overflow: false`, `h1Count: 1`, `mainId: true`, `hasSkipLink: true`, `imgsNoAlt: 0`, `page_errors: []`, `console_errors_count: 0`, first `Tab` lands on `#main-content`, `prefers-reduced-motion` yields `1e-05s`, security headers clean (`x-powered-by: null`, CSP, `X-Frame-Options: DENY`, `Permissions-Policy`, `nosniff`), and `/api/health?probe=1` accurately reports `HTTP 503` when server review secrets/upstream `/ready` are unconfigured. *(Note: `doc_route_tested: null` because the live seeded workspace currently has `0` saved documents; rendered `/documents/[id]` and `/documents/[id]/history` viewports are queued for `USER-RUN` during live E2E verification.)*
- **Pre-Remediation API Negative Checks & Header Checks (`2026-11-10`, Agent on `:3100`/`:3105`):**
  - Negative matrices (`405` GET `/api/review` & `/decision`, `401` unauth POST, `400` invalid payloads/enums/blank reject/501-char comments, `404` missing UUIDs), `/api/documents` NUL-byte pre-validation `400` in `254–319 ms`, and client bundle `0` CSP violations verified cleanly.

---

## 3. Supabase RLS & Hardening Execution (`Project Owner (USER-RUN)`, `2026-11-10`)

Executed manually by the **Project Owner (`USER-RUN`)** in the **Supabase SQL Editor** after applying [`supabase/migrations/0002_rls_hardening.sql`](../supabase/migrations/0002_rls_hardening.sql):

1. **Workspace Isolation & Column Immutability (`supabase/tests/rls_checks.sql`, Cases `a`–`g`):** **`7 of 7` cases PASS (`true`)** (`(a)` Asterra reads, `(b)` Northwind blocked for Judge, `(c)` Asterra blocked for Outsider, `(d)` `creator` blocked on `approved_facts` `42501`, `(e)` `created_by` spoof `42501`, `(f)` `documents.workspace_id` update `42501`, `(g)` `documents.created_by` update `42501`).
2. **`pg_policies` & Privilege Audit:** RLS active across **all `14` public tables**; **`0` `DELETE` grants** for `authenticated`.

---

## 4. `PENDING (USER-RUN)` Live Cloud, AI, Decision & SQL Checks

All checks below remain **`PENDING (USER-RUN)`** and **MUST NOT** be claimed passed until executed by the Project Owner (detailed copy-paste instructions live in [`.planning/REMAINING_USER_RUN.md`](../.planning/REMAINING_USER_RUN.md)):

| Pending Test | Execution Owner | Expected Verification & Action Required |
| --- | --- | --- |
| **1. `decision_rls.sql`, `0003`, `0004` & `remediation_checks.sql`** | `USER-RUN` | Execute `supabase/tests/decision_rls.sql` (`begin`/`rollback`, `4/4`), apply `0003_audit_server_only.sql`, apply **`0004_remediation_integrity_and_rpc.sql`** *(mandatory for `record_review_decision` RPC on `POST /api/suggestions/[id]/decision`)*, and execute `supabase/tests/remediation_checks.sql` (`begin`/`rollback`, `8/8` cases `h`–`o`) in Supabase SQL Editor. |
| **2. Container Build (`ai-service/Dockerfile`)** | `USER-RUN` *(Docker CLI not installed locally)* | Run `docker build -t brandguardian-ai ai-service`, start with `--env-file .env`, verify `GET /health` `200`, `GET /ready` `200`, and `POST /review` `{}` `401`. |
| **3. Live M2 Review + M3 Decision + Prompt-Injection & Degraded E2E** | `USER-RUN` | Verify saved Asterra review (4 expected findings, `"best practices"` not flagged), High/Critical Evidence gate locking both **Accept** & **Edit**, transactional **Accept/Edit/Reject/Dismiss**, **"Preview final text"** + **Copy**, automatic `documents.status = 'reviewed'`, `/documents/[id]` & `/history` 4-viewport render, concurrent double-click `409`, FastAPI unreachable `502` rollback, temporary bad Groq key (`"AI unavailable"` banner without raw Python class names), `< /document>` live prompt-injection draft, and record real Groq latency (`[median ms / max ms]`). |
| **4. Cloud Deployment, Key Rotation, Fluid Compute `60s` & Incognito Smoke** | `USER-RUN` | Deploy `ai-service` (Render/Railway) -> `<AI_URL>`, deploy `web` (Vercel root `web`, verify `60s` timeout via Fluid Compute/Pro) -> `<WEB_URL>`, rotate `AI_SERVICE_TOKEN` / `GROQ_API_KEY` / `DEMO_PASSWORD`, update Supabase Auth Site/Redirect URLs, fill `<WEB_URL>`/`<AI_URL>`/`[Placeholder]` docs, warm `<AI_URL>/ready` & `<WEB_URL>/api/health?probe=1`, and run full incognito review walkthrough. |
