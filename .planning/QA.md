# BrandGuardian — QA Matrix (QA-Fix Loop)

**Started:** 2026-11-10T04:44:03+05:30  
**Last Updated:** 2026-11-10T05:15:00+05:30  
**Scope:** Full audit of currently implemented milestones (**M0 + M1**; M2 `/api/review` & M3 `/api/suggestions/[id]/decision`, `/documents/[id]/history` timeline remain unbuilt by design).  
**Status Legend:** `PASS` | `FAIL` | `N/A` (unbuilt future milestone feature) | `USER-RUN` (requires human action, secret, or external UI)

---

## Step 0: SENSE Baseline

- **Branch:** `main`
- **Baseline Commits:** `e94ee70 feat(m1): auth, workspace data, document persistence` on `1fc322b chore: project structure (M0)` (`chunks-tmp` `90295dc` untouched)
- **Tier A Fix Commits Applied:**
  - `f6b890c fix(web): update root page copy and render semantic h1  [DEF-01]`
  - `9d0d94f fix(documents): validate uuid and workspace doc on history route  [DEF-02]`
  - `eee77d0 fix(web): hide raw error details and add h1 to error pages  [DEF-03]`
  - `a665b88 fix(security): hide x-powered-by and enforce csp and permissions-policy  [DEF-05]`
  - `09367e8 fix(api): reject null bytes and validate payload before workspace lookup  [DEF-07]`
  - `3cf731c fix(ux): add route metadata titles and accessible loading skeletons  [DEF-04]`
  - `4f31de7 fix(docs): align readme, limitations, evidence, and state with verified m1 state  [DEF-06]`
- **Requested Skills Availability:** 36/37 installed; `security-and-hardening` is not installed (skipped cleanly without inventing content).

---

## Round 2 Final Gate Matrix & Empirical Evidence (After `[DEF-01]`–`[DEF-07]`)

### L1 — Static Analysis & Automated Unit Tests

| Check | Status | Exact Command & Observed Output |
| --- | --- | --- |
| AI Service Pytest Suite | **PASS** | `.\ai-service\.venv\Scripts\python.exe -m pytest -q ai-service` → `11 passed in 0.37s`, `PYTEST_EXIT:0` |
| TypeScript (`tsc --noEmit`) | **PASS** | `pnpm --dir web typecheck` → `TYPECHECK_EXIT:0` |
| TypeScript Strict Unused Check | **PASS** | `pnpm --dir web exec tsc --noEmit --noUnusedLocals --noUnusedParameters` → `TSC_UNUSED_EXIT:0` |
| ESLint (`lint` script) | **FAIL** | `web/package.json` defines `dev`, `build`, `start`, `test`, `typecheck`; no `"lint"` script or `eslint` package installed (`[DEF-09]`, Tier B — dependency addition) |
| Web Unit Tests (`m1.test.ts` + `security.test.mjs`) | **PASS** | `pnpm --dir web test` → `tests 6 / pass 6 / fail 0` (`168.7079ms`), `TEST_EXIT:0` |
| Next.js Production Build | **PASS** | `pnpm --dir web build` → `✓ Compiled successfully in 2.6s`, `✓ Generating static pages (7/7)`, First Load JS `102 kB`, Middleware `94.5 kB`, `BUILD_EXIT:0` |
| Leftover `console.*` / `TODO` Scan | **PASS** | `git grep -n -E "console\.(log\|warn\|error\|debug\|info)\|TODO\|FIXME\|XXX\|HACK" web ai-service` → `0` hits (`GREP_CONSOLE_TODO_EXIT:1`) |
| Dead Code Audit | **PASS** | Remaining unreferenced exports (`ai-status-banner`, `verification-badge`, `dialog`, `admin.ts`, `browser.ts`, `getServerEnv`) are documented M0 scaffolds for M2/M3; zero unreachable logic in active M1 files. (`skeleton.tsx` now used by `loading.tsx` boundaries.) |

---

### L2 — Contracts (TypeScript ↔ Python Pydantic ↔ Supabase Schema)

| Contract Boundary | Status | Observed Evidence |
| --- | --- | --- |
| `web/lib/types/finding.ts` ↔ `ai-service/main.py` | **PASS** | Exact 1:1 field & literal parity verified (`Category`, `Severity`, `VerificationStatus`, `FindingOrigin`, `AiStatus`, 12 `Finding` fields, 7 `ReviewResponse` fields). |
| `web/` DB queries ↔ `supabase/migrations/0001_schema.sql` | **PASS** | Every `.from()`/`.select()`/`.insert()` matches DDL columns and constraints; `\u0000` NUL bytes now rejected in `m1.ts` (`400`) before Postgres insert (`[DEF-07]` fixed). |

---

### L3 — API & Route Matrix (`next start -p 3000`, Round 2)

| Method & Route | Auth / Input Case | Status | Observed Output |
| --- | --- | --- | --- |
| `GET /` | Anonymous | **PASS** | `HTTP 200` (`40.4 ms`), `h1Count=1`, `has_stale_m0=false`, unique `<title>` |
| `GET /login` | Anonymous / Signed-in | **PASS** | `HTTP 200` anonymous; redirects to `/dashboard` when signed in |
| `GET /dashboard`, `/knowledge`, `/documents/new`, `/documents/<uuid>`, `/documents/<uuid>/history` | Anonymous | **PASS** | All return `HTTP 307`, `Location: /login` (`4.7–123.4 ms`) |
| `GET /nonexistent-route-qa` | Authenticated | **PASS** | `HTTP 404`, `<h1>Page not found</h1>` |
| `GET /documents/not-a-uuid`, `GET /documents/not-a-uuid/history`, `GET /documents/00000000-.../history` | Authenticated | **FAIL** *(soft-404 status)* | Renders `<h1>Page not found</h1>` in DOM via `notFound()`, **but** returns HTTP `200` stream headers due to parent/`[id]` `loading.tsx` boundaries (`[DEF-12]`, Tier B — deleting 3 tracked `loading.tsx` files) |
| `GET /api/health` / `POST /api/health` | Public | **PASS** | `GET` `HTTP 200` (`supabase_configured: true`, `ai_service_configured: false`, `6.2 ms`); `POST` `HTTP 405` |
| `GET/POST /api/documents` / `PUT /api/documents` | Anonymous | **PASS** | `GET`/`POST` `HTTP 401` `{"error":"Unauthorized"}`; `PUT` `HTTP 405` |
| `GET /api/documents` | Authenticated | **PASS** | `HTTP 200` (`count=3`, `902.1 ms`) |
| `POST /api/documents` | Auth + `{bad json`, `[]`, NUL byte `\u0000`, `6001` chars | **PASS** | All 4 return `HTTP 400` in `254.2–319.3 ms` (validated before `workspace_members` lookup, `[DEF-07]` fixed) |
| `POST /api/documents` | Auth + Asterra sample | **PASS** | Redirected to `/documents/e7e1021f-3e61-4d65-91e0-32a8d11b7b9c` (`3454.2 ms`), persisted across reload |
| `POST /api/review`, `POST /api/suggestions/<uuid>/decision` | Auth & Unauth | **PASS** (stub) | Intentional M0/M1 `HTTP 501` `{"error":"not_implemented"}` |

---

### L4 — AI Service (`http://127.0.0.1:8000`)

| Check | Status | Observed Output |
| --- | --- | --- |
| `GET /health` | **PASS** | `HTTP 200` `{"status":"ok","provider":"groq","llm_configured":true,"model":"openai/gpt-oss-20b"}` (`1.7 ms`) |
| `GET /` | **PASS** | `HTTP 404` `{"detail":"Not Found"}` |
| `POST /review` (valid body, missing or wrong `x-api-key`) | **PASS** | `HTTP 401` `{"detail":"unauthorized"}` |
| `POST /review` (`{}` empty body, no `x-api-key`) | **FAIL** | Returned `HTTP 422` Pydantic validation error BEFORE `HTTP 401` auth check (`[DEF-08]`, Tier B — `ai-service/main.py`) |
| `git diff e94ee70..HEAD -- ai-service/main.py` | **PASS** | Empty diff (`ai-service/main.py` untouched during M1 & Tier A fixes) |
| Live Groq `POST http://127.0.0.1:8000/review` with server `.env` token | **USER-RUN** | Requires user-held `AI_SERVICE_TOKEN` inside `ai-service/.env` (agent never reads `.env` files). |

---

### L5 — Security Audit (Round 2)

| Sub-check | Status | Observed Evidence |
| --- | --- | --- |
| L5(a) Secrets in `'use client'` / `.next/static/*.js` / `NEXT_PUBLIC_` | **PASS** | `STATIC_SECRET_HITS:0`; `0` occurrences in `'use client'` files or `NEXT_PUBLIC_*` vars |
| L5(b) `server-only` & admin isolation | **PASS** | `import 'server-only'` active in `web/lib/env.ts`, `web/lib/supabase/admin.ts`, `web/lib/workspace.ts`; `admin.ts` unused in M1 |
| L5(c) Error boundary info leakage | **PASS** | `git grep "error.message" web` = 0; `error.tsx` prints fixed safe fallback + opaque optional `error.digest` (`[DEF-03]` fixed) |
| L5(d) Security headers (`/` & `/api/health`) | **PASS** | `x-powered-by: null`, strict `Content-Security-Policy`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `X-DNS-Prefetch-Control: off`, `nosniff`, `DENY`, `strict-origin-when-cross-origin` (`[DEF-05]` fixed); `csp_violations: []` |
| L5(e) `pnpm audit` dependencies | **FAIL** | `VULN_COUNTS: {'info': 0, 'low': 0, 'moderate': 2, 'high': 2, 'critical': 0}` (4 transitive `next > postcss <= 8.5.22` advisories, `[DEF-09]`, Tier B) |
| L5(f) Auth/Middleware isolation | **PASS** | `git diff e94ee70..HEAD -- web/middleware.ts "web/app/(auth)/login/actions.ts"` is empty; protected routes redirect to `/login`; signed-in `/login` redirects to `/dashboard` |
| L5(g) `supabase/migrations/0001_schema.sql` DDL hardening | **FAIL** | `documents_update` `with check` allows changing `workspace_id`/`created_by`/`status`; broad `GRANT DELETE`; unwrapped `auth.uid()` & missing RLS indexes (`[DEF-10]`, Tier B) |
| L5(g-live) `supabase/tests/rls_checks.sql` | **USER-RUN** | Block 1 (`cases a–e`) & Block 2 (`pg_policies` summary) ready for Supabase SQL Editor |

---

### L6 — E2E Browser UI & Viewports (Chromium Headless Round 2, `1440px` & `375px`)

| Screen / Journey | Status | Observed Evidence (`qa_round2_output.json` + screenshots `r2_01`–`r2_12`) |
| --- | --- | --- |
| `/` Landing (`1440px`) | **PASS** | `h1Count=1`, `has_stale_m0=false`, `overflow=false`, visually inspected `r2_01_root_1440.png` (`[DEF-01]` fixed) |
| Unauth `/dashboard` → `/login` (`1440px` & `375px`) | **PASS** | Redirected to `/login`, `login_invalid_email_error="Enter a valid email address."`, `overflow=false` (`r2_02`, `r2_03`) |
| One-click `"Enter demo workspace"` → `/dashboard` | **PASS** | Landed on `/dashboard` showing `Asterra (demo)`, `Admin` role, `5` rules / `5` facts / `2` terminology, saved drafts (`r2_04`) |
| `/knowledge` Keyboard Tabs (`ArrowRight`, `Home`) | **PASS** | Verified Rules (`5`), Facts (`5`, `2021`), Terminology (`2`, `customers`), ARIA `aria-selected` & `Home` reset (`r2_05`–`r2_07`) |
| `/documents/new` → Sample → `/documents/[id]` + Reload | **PASS** | Client blank error `"Document title is required."` -> sample (`163 / 6,000`) -> `/documents/e7e1021f-3e61-4d65-91e0-32a8d11b7b9c` + hard reload retaining content & `"Review engine arrives in M2"` (`0` Run review buttons, `1440px` & `375px`, `r2_09`, `r2_10`) |
| `/documents/[id]/history` | **PASS** | `<h1>Document Audit History</h1>`, `"Back to document"` link (`has_back_link: true`), `has_m3_note: true`, unique title (`r2_11`) |
| Sign out → `/login` → `/dashboard` redirect | **PASS** | Signed out to `/login`, subsequent `/dashboard` redirected to `/login`; `happy_console_errors: []`, `happy_page_errors: []`, `csp_violations: []` |

---

### L7 — Accessibility & UX (Round 2)

| Check | Status | Observed Evidence |
| --- | --- | --- |
| `<html lang="en">`, `<main>`, unique `<title>`, accessible names | **PASS** | Every route (`/` to `/documents/[id]/history` & `/nonexistent-route-qa`) verified: `lang="en"`, `mainCount=1`, `h1Count=1`, `unlabeledVisibleInputs=0`, `buttonsWithoutName=0`, `linksWithoutName=0`, `targetBlankUnsafe=0` |
| Keyboard Navigation & Reduced Motion | **PASS** | `/knowledge` arrow/Home tab keyboard navigation + `:focus-visible` ring + `prefers-reduced-motion` |
| WCAG AA Color Contrast (`>= 4.5:1`) | **PASS** | All 13 light tokens (`4.84:1`–`17.96:1`) and 11 dark tokens (`5.50:1`–`15.76:1`) exceed `4.5:1` |
| Route Loading Skeletons | **PASS** | Accessible `role="status"` + `aria-busy="true"` `<Skeleton />` files added (`[DEF-04]`) |

---

### L8 — Performance Measurements (Round 2)

| Metric | Target | Status | Observed Measurement |
| --- | --- | --- | --- |
| Web First Load JS shared | — | **PASS** | `102 kB` shared; route bundles `103–118 kB` (`next build`) |
| `/api/health` & AI `/health` | `< 1s` | **PASS** | Web `6.2 ms`, AI `1.7 ms` |
| `POST /api/documents` invalid payloads | `< 1s` | **PASS** | `254.2–319.3 ms` (down from `710–1324 ms` after `[DEF-07]`) |
| `GET /api/documents` (auth) | `< 3s` | **PASS** | `902.1 ms` |
| `/dashboard` full navigation (`5x` prod server) | `< 3s` | **FAIL** | `[3372.1, 3568.5, 2861.4, 3249.1, 4144.7]` ms → **median `3372.1 ms`, worst `4144.7 ms`** (`[DEF-11]`, Tier B remote `auth.getUser()` RTT) |

---

### L9 — Documentation Honesty (Round 2)

| Document | Status | Evidence |
| --- | --- | --- |
| `README.md`, `docs/limitations.md`, `docs/test-evidence.md`, `.planning/STATE.md` | **PASS** | Updated in `4f31de7` (`[DEF-06]`) to match M1 reality, `501` M2/M3 stubs, `USER-RUN` checks, and open Tier B defects honestly. |
| `docs/architecture.md`, `docs/ai-disclosure.md` | **PASS** | Accurately describe three-tier architecture & AI constraints. |

---

### L10 — Git Hygiene & Tier B Isolation (Round 2)

| Check | Status | Evidence |
| --- | --- | --- |
| Repo isolation & `.gitignore` | **PASS** | `.env*` gitignored (`git check-ignore -v` verified); `main` builds cleanly on `1fc322b` -> `e94ee70` -> Tier A fixes; `chunks-tmp` (`90295dc`) preserved |
| Tier B untouched diff check | **PASS** | `git diff e94ee70..HEAD -- ai-service/main.py supabase/ web/middleware.ts "web/app/(auth)/login/actions.ts" web/lib/types/finding.ts` → empty (`TIER_B_DIFF_EXIT:0`) |

---

## Roadmap P0 Matrix (Per `_pack/02_RESOURCES_AND_ANTIGRAVITY_LOOP.md`)

| Milestone | P0 Capability | Implementation & Verification Status |
| --- | --- | --- |
| **M0** | Next.js + TS + Tailwind + tokens + Supabase client boundaries + `ai-service/` verbatim + gitignored `.env` | **PASS** (`1fc322b`) |
| **M1** | `0001_schema.sql` + `seed.sql` + `@supabase/ssr` demo & email login + middleware redirects + RLS workspace & knowledge UI + `/documents/new` (`<= 6000`) + `/documents/[id]` read-only + `rls_checks.sql` | **PASS (Web E2E + Build + Static)** / **USER-RUN (SQL Editor `rls_checks.sql`)** — Tier A `[DEF-01]`..`[DEF-07]` fixed; Tier B `[DEF-08]`..`[DEF-12]` diagnosed awaiting `APPROVED` |
| **M2** | Core Review Engine (`POST /api/review`, findings/suggestions persistence, review UI pane, AI banner) | **N/A** (Not started; `/api/review` returns `501`) |
| **M3** | Human workflow (`POST /api/suggestions/[id]/decision`, diff & Accept/Edit/Reject/Dismiss, `/documents/[id]/history` audit timeline) | **N/A** (Not started; `/api/suggestions/[id]/decision` returns `501`) |
| **M4–M6** | Deployment, analytics, final pre-demo gate | **N/A** (Not started) |
