# BrandGuardian — Remediation Verification & Test Evidence

**Date:** `2026-11-10` (IST)  
**Target State:** Local working tree on `main` (`HEAD = 03a9c96c32f067936c632c779a60681923a86afe` + uncommitted remediation changes)  
**Verification Rule:** Every **`PASS`** below cites an exact command and output observed directly after the corresponding code edits. Items requiring live DB execution (`0003`/`0004`/`decision_rls.sql`/`remediation_checks.sql`), Docker CLI, live Groq evaluation, saved-doc live UI viewports, or cloud deployment are strictly marked **`USER-RUN`**.

---

## 1. Automated Unit, Lint, Static & Clean-Env Build Checks (`Agent`)

| Check | Exact Command | Pre-Remediation Baseline (`HEAD 03a9c96`) | Post-Remediation Result | Exit Code |
| --- | --- | --- | --- | --- |
| **Python Unit & Auth Tests** | `.\ai-service\.venv\Scripts\python.exe -m pytest -v ai-service` | `12 passed, 1 warning in 0.40s` | **`19 passed, 1 warning`** (`7` new TDD remediation tests passing) | **`0` (`PASS`)** |
| **Web TypeScript Typecheck** | `pnpm --dir web typecheck` | `exit 0` | **`exit 0`** (`tsc --noEmit`) | **`0` (`PASS`)** |
| **Web TypeScript Strict Unused** | `pnpm --dir web exec tsc --noEmit --noUnusedLocals --noUnusedParameters` | `exit 0` | **`exit 0`** (`0` unused locals/params) | **`0` (`PASS`)** |
| **Web ESLint (`[DEF-09]`)** | `pnpm --dir web lint` | Missing script (`no config`) | **`✔ No ESLint warnings or errors`** (`eslint 9.39.5` + `eslint-config-next 15.5.29` + `web/.eslintrc.json`) | **`0` (`PASS`)** |
| **Web Unit, Workflow, Auth & A11y Tests** | `pnpm --dir web test` | `17 passed, 0 failed in 177.99ms` | **`tests 34 / pass 34 / fail 0`** (`decision-workflow` 3, `health-workflow` 2, `review-workflow` 3, `claims` 4, `accessibility` 2, `decision` 6, `m1` 5, `review` 8, `security` 1) | **`0` (`PASS`)** |
| **Web Dependency Security Audit (`[DEF-09]`)** | `pnpm --dir web audit --json` | `exit 1` (`4` transitive `postcss@8.4.31` advisories: `2 moderate`, `2 high`) | **`exit 0`, `0` advisories** (`info: 0, low: 0, moderate: 0, high: 0, critical: 0` via `web/pnpm-workspace.yaml`) | **`0` (`PASS`)** |
| **Web Local Production Build** | `pnpm --dir web build` | `exit 0` (`102 kB` shared JS) | **`exit 0`** (`102 kB` shared JS, Middleware `95.1 kB`, `0` lint warnings) | **`0` (`PASS`)** |
| **Isolated Clean-Env Checkout Build** | Clean copy of working `web/` into `%TEMP%\bg-clean-remediation` (zero `.env*`, zero `.next`, only 7 placeholder keys from `web/.env.example`), `pnpm install --frozen-lockfile --ignore-scripts` + `pnpm exec next build` | `exit 0` (at baseline `HEAD`) | **`exit 0` (`CLEAN_ISOLATED_BUILD_PASSED`)** (`✓ Compiled successfully in 16.5s`, resolved `postcss 8.5.32`, `eslint 9.39.5`, temp dir deleted) | **`0` (`PASS`)** |
| **Bundle Secrets, Localhost, `.env*` & Error Leak Scans** | `git ls-files ".env*" "**/.env*"`, `git grep -n -E "localhost\|127\.0\.0\.1" web/app web/components web/lib`, `git grep -n "error\.message" web/app web/components`, compiled `.next/static/**/*.js` scan | Clean (`0` leaks) | Only `.env.example` tracked; **`0`** prod `localhost` hits; **`0`** `error.message` UI leaks; **`0`** secrets in `35` compiled JS chunks | **`0` (`PASS`)** |
| **WCAG 1.4.11 Luminance Contrast Ratios (`[DEF-21]`)** | `accessibility.test.ts` + computed contrast formulas | `--border-subtle` `1.22:1`–`1.37:1` (`FAIL`) | Light `#888378`: **`3.20:1`** vs `#F7F5F0`, **`3.80:1`** vs `#FFFFFF`; Dark `#6C7482`: **`3.21:1`** vs `#141923` (`>= 3.0:1` `PASS`) | **`0` (`PASS`)** |
| **Static SQL Syntax Audit (`0004`, `remediation_checks.sql`)** | Dollar-quote & parenthesis balance checks | N/A | Balanced `$$` delimiters and parentheses; `remediation_checks.sql` wrapped in `begin`/`rollback` (`USER-RUN` execution pending) | **`0` (`PASS`)** |

---

## 2. Live Mock-HTTP, AI Trust & Chromium Benchmark Evidence (`Agent`)

### 2A. FastAPI Upstream Resilience & Readiness (`verify_phase6.py`, Temp Ephemeral `uvicorn`)
Tested cleanly using ephemeral `uvicorn` + local `MockGroqHandler` without disturbing user processes on port `8000`:
- `GET /ready` (when `AI_SERVICE_TOKEN` + `GROQ_API_KEY` configured): **`HTTP 200`** `{"status": "ready", "provider": "groq", "token_configured": true, "llm_configured": true, "model": "openai/gpt-oss-20b"}` (`READY_200_OK`).
- `GET /ready` (when `AI_SERVICE_TOKEN=""`, `GROQ_API_KEY=""`): **`HTTP 503`** `{"status": "not_ready", "provider": "groq", "token_configured": false, "llm_configured": false, "model": "openai/gpt-oss-20b"}` (`READY_503_OK`).
- `POST /review` upstream fault tolerance (`LLM_TIMEOUT=1.5`):
  - Upstream **`401`**: `HTTP 200`, `ai_status: "unavailable"`, `ai_detail: "AI provider authentication failed. Deterministic findings remain valid."` (`UPSTREAM_401_SAFE`)
  - Upstream **`429`**: `HTTP 200`, `ai_status: "unavailable"`, `ai_detail: "AI provider rate limit reached. Deterministic findings remain valid."` (`UPSTREAM_429_SAFE`)
  - Upstream **`500`**: `HTTP 200`, `ai_status: "unavailable"`, `ai_detail: "AI provider returned a temporary upstream error. Deterministic findings remain valid."` (`UPSTREAM_500_SAFE`)
  - Upstream **Timeout (`2.2s > 1.5s`)**: `HTTP 200`, `ai_status: "unavailable"`, `ai_detail: "AI provider request timed out. Deterministic findings remain valid."` (`UPSTREAM_TIMEOUT_SAFE`)
  - **Raw exception leak count (`HTTPStatusError`, `OSError`, `ReadTimeout`, `ConnectError`, `Traceback`):** **`0`**.

### 2B. AI Trust & Grounding Post-Remediation Harness (`verify_ai_trust_after.py`)
- **Synthetic Asterra deterministic precision:** `100.0%` (**`5/5` true positives**, **`det_fp: 0`**, `best_practices_fp: false`, `det_dropped: 0`).
- **Poisoned category/severity rule citation (`tone`/`critical` citing `unsupported_claim`/`high` rule):** **`verification_status: "unverified"`** (`PASS`, downgraded cleanly).
- **Duplicate LLM quote cursor (`"Wait now."` x2) & `>5` truncation (`6` items sent):**
  - `duplicate_llm_offsets: [[0, 9], [10, 19]]`, `duplicate_distinct: true`
  - `truncation_dropped_count: 1`, `llm_status: "ok"` (`PASS`).

### 2C. BEFORE vs AFTER Production Playwright Probes (`next start -p 3106`, Headless Chromium)
| Probe | Pre-Remediation BEFORE (`probe_before_after.py`) | Post-Remediation AFTER (`probe_before_after.py` & `verify_playwright_4vp_after.py`) | Delta / Outcome |
| --- | --- | --- | --- |
| **First `/login -> /dashboard` redirect** | **`6472.2 ms`** | **`1600.2 ms`** | **`-75.3%`** (`-4872.0 ms`, `PASS`) |
| **Warm `/dashboard` 5-run benchmark** | `[5046.5, 2011.8, 2143.7, 1650.5, 2357.9] ms` (`median 2143.7 ms`, `max 5046.5 ms`) | **`[1790.3, 1139.4, 1351.5, 1123.7, 1432.6] ms`** (`median 1351.5 ms`, `max 1790.3 ms`) | **`-37.0%` median / `-64.5%` max** (`PASS`) |
| **Invalid UUID `/documents/not-a-uuid`** | `HTTP 200` *(soft-404 bug `[DEF-12]`)* | **`HTTP 404`** | Fixed (`PASS`) |
| **Invalid UUID `/documents/not-a-uuid/history`** | `HTTP 200` *(soft-404 bug `[DEF-12]`)* | **`HTTP 404`** | Fixed (`PASS`) |
| **Missing UUID `/documents/0000...0000`** | `HTTP 200` *(soft-404 bug `[DEF-12]`)* | **`HTTP 404`** | Fixed (`PASS`) |
| **Missing UUID `.../0000...0000/history`** | `HTTP 200` *(soft-404 bug `[DEF-12]`)* | **`HTTP 404`** | Fixed (`PASS`) |
| **4-Viewport Layout & A11y Matrix (`1440×900`, `1024×768`, `768×1024`, `375×812`)** | Tested earlier with WCAG border & skip-link failures | **`24/24` PASS** (`/`, `/login`, `/dashboard`, `/knowledge`, `/documents/new`, `/404`): `overflow: false`, `h1Count: 1`, `mainId: true`, `hasSkipLink: true`, `imgsNoAlt: 0`, `stale: false`, `page_errors: []`, `console_errors_count: 0` | All tested views pass *(rendered saved doc `/documents/[id]` & `/history` viewports remain `USER-RUN`)* |
| **First `Tab` Keyboard Target & Reduced Motion** | `hasSkipLink: false` | `skip_link_first_tab_href: "#main-content"`, `reduced_motion_duration: "1e-05s"` | Fixed (`PASS`) |
| **Health Liveness vs Readiness Probe (`/api/health?probe=1`)** | Returned `200 ai_service_configured: true` regardless of token/role | Plain `/api/health` + `/api/health?probe=1` returns honest **`503`** `"degraded"` when server tokens or upstream `/ready` are unavailable | Fixed (`PASS`) |
| **Security Headers** | Clean | `x-powered-by: null`, `has_csp: true`, `x-frame-options: DENY`, `permissions-policy: camera=(), microphone=(), geolocation=()`, `x-content-type-options: nosniff` | Verified (`PASS`) |

---

## 3. Supabase Initial Hardening (`USER-RUN`, Completed Previously)

Executed manually by the Project Owner in the Supabase SQL Editor for `[DEF-10]`:
- `supabase/migrations/0002_rls_hardening.sql` applied cleanly.
- `supabase/tests/rls_checks.sql` **`7 of 7`** cases (`a`–`g`) returned `pass = true`.
- `pg_policies` active on all `14` public tables; `0` `DELETE` grants for `authenticated`.

---

## 4. Checks Remaining **`USER-RUN`** (Not Claimed Passed Yet)

Do **not** mark any item below as `PASS` until manually executed (copy-paste instructions in [`.planning/REMAINING_USER_RUN.md`](REMAINING_USER_RUN.md)):
1. **Supabase SQL Editor Runs (`[DEF-14]`, `[DEF-15]`, `[DEF-18]` DB layer):** `decision_rls.sql` (`4/4` -> `rollback`), `0003_audit_server_only.sql`, **`0004_remediation_integrity_and_rpc.sql`**, and `remediation_checks.sql` (`cases h–o` -> `rollback`).
2. **Docker Image Build & Smoke Test (`[DEF-20]`):** `docker build` + `docker run` check on `ai-service/Dockerfile` (Docker CLI is not installed on this machine).
3. **Live M2 + M3 End-to-End Against Real Groq + Remote Supabase:** Saving Asterra draft -> live Groq run (recording actual `[median ms / max ms]` and real `openai/gpt-oss-20b` output), High/Critical Evidence lock on **Accept** & **Edit**, atomic **Accept/Edit/Reject/Dismiss**, **Preview final text**, automatic `documents.status = 'reviewed'`, `/documents/[id]` & `/documents/[id]/history` layout inspection across desktop/mobile, concurrent double-click `409`, FastAPI unreachable `502` cleanup, bad Groq key degraded banner, and live prompt-injection copy check.
4. **Cloud Deploy & Pre-Judging Incognito Walkthrough (`[DEF-20]`):** Render/Railway deploy (`/ready`), Vercel deploy (`60s` Fluid Compute/Pro verified), production secret rotation, Supabase Auth Site/Redirect URLs, filling `<WEB_URL>` / `<AI_URL>` / `[Placeholder]`s in `README.md` / `docs/test-evidence.md` / `docs/contributions.md`, and incognito T-15 min walkthrough.

