# BrandGuardian — Project State

**Last Updated:** 2026-11-10  
**Current Milestone:** M1 — Foundation (Auth, Workspace Data, Document Persistence, RLS Proof)  
**Milestone Status:** CODE + QA ROUND 2 COMPLETE (Tier A Fixed; Live SQL Editor Check `USER-RUN`; Tier B Defects Pending Approval)  
**Next Milestone:** M2 — Review Engine (Deterministic + AI Checks, Findings, Audit Trail) — *Do not start until Tier B decisions (if any) and `rls_checks.sql` SQL Editor output are confirmed.*

---

## Reality Check (Empirically Verified After Tier A Fixes)

- **Repository & Branch:** `E:/Plugins/Get Shit Done/Code Titan 2026/brandguardian` on `main` (`1fc322b` M0 -> `e94ee70` M1 -> Tier A fixes `[DEF-01]`, `[DEF-02]`, `[DEF-03]`, `[DEF-05]`, `[DEF-07]`, `[DEF-04]`, `[DEF-06]`; `chunks-tmp` untouched).
- **Web (`web/`):**
  - `pnpm --dir web typecheck` (`tsc --noEmit`) & `--noUnusedLocals --noUnusedParameters`: **exit 0**.
  - `pnpm --dir web test` (`lib/validators/*.test.*`): **6/6 passed**.
  - `pnpm --dir web build` (`next build`): **exit 0** (`102 kB` shared First Load JS, routes `103–118 kB`, Middleware `94.5 kB`).
  - Hardened security headers active (`poweredByHeader: false`, `Content-Security-Policy`, `Permissions-Policy`, `X-DNS-Prefetch-Control: off`, `nosniff`, `DENY`, `strict-origin-when-cross-origin`); `0` CSP violations across headless Chromium pass.
- **AI Service (`ai-service/`):**
  - `ai-service/.env.example` sets `LLM_PROVIDER=groq`; `[DEF-08]` moved `require_key` to `Depends(require_key)` on `POST /review` (`3727052`).
  - `.\ai-service\.venv\Scripts\python.exe -m pytest -q ai-service`: **12 passed in 0.40s**.
  - Live `GET http://127.0.0.1:8000/health` returns `200` (`provider: "groq"`, `llm_configured: true`, `model: "openai/gpt-oss-20b"`); unauthenticated `POST /review` with `{}` returns `HTTP 401`.
- **Secret Isolation Proof (`web/` source + `.next/static/*.js`):**
  - `STATIC_SECRET_HITS=0` in `.next/static/**/*.js`; `0` occurrences of `DEMO_PASSWORD`, `DEMO_EMAIL`, `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`, or `AI_SERVICE_TOKEN` in `'use client'` files or `NEXT_PUBLIC_*` variables.

## M1 Acceptance Matrix

| # | Criterion | Status | Evidence / Notes |
| --- | --- | --- | --- |
| 1 | `pnpm build` & `tsc --noEmit` pass; `ai-service` tests pass | **PASS** | `tsc --noEmit` (`0`), `pnpm test` (`6/6`), `next build` (`0`), `pytest` (`12/12` including `[DEF-08]`) |
| 2 | Incognito `/dashboard` -> `/login`, demo sign-in -> real `/dashboard` | **PASS** | Verified in headless Chromium: incognito `/dashboard` redirected to `/login`; `"Enter demo workspace"` landed on `/dashboard` showing `Asterra (demo)`, `Admin`, `5` rules / `5` facts / `2` terminology, and saved drafts |
| 3 | `/knowledge` renders Asterra Rules, Facts & Terminology from DB | **PASS** | Verified Rules (`5`), Facts (`5`), and Terminology (`2`) tabs via keyboard navigation and real Supabase RLS queries |
| 4 | Document created from Asterra sample persists across hard refresh | **PASS** | Verified `"Load Asterra sample"` (`163 / 6,000`) -> `POST /api/documents` (`201`) -> `/documents/e7e1021f-3e61-4d65-91e0-32a8d11b7b9c` + hard reload retaining title, content, `"Review engine arrives in M2"`, and `0` Run review buttons |
| 5 | `DEMO_PASSWORD` & `SUPABASE_SERVICE_ROLE_KEY` absent from client / `NEXT_PUBLIC_` | **PASS** | Verified across `web/` source, `NEXT_PUBLIC_*` grep, and `.next/static/**/*.js` (`0` hits) |
| 6 | `supabase/tests/rls_checks.sql` ready & verified | **USER-RUN** | `0002_rls_hardening.sql` & `rls_checks.sql` (`cases a–g` + `Block 2` `pg_policies`) committed (`1db160f`); awaiting user execution in Supabase SQL Editor |

## Tier B QA Findings Status

- `[DEF-08]` (`P2`): **FIXED (`3727052`)** — `Depends(require_key)` on `POST /review` (`12 passed`, `{} -> 401`).
- `[DEF-10]` (`P1`): **SQL COMMITTED (`1db160f`) / PENDING USER-RUN** — `supabase/migrations/0002_rls_hardening.sql` & `rls_checks.sql` cases `(f)`–`(g)` ready to run in Supabase SQL Editor.
- `[DEF-09]` (`P2`, **Deferred**): Missing ESLint/`lint` script in `web/package.json` and 4 transitive `next > postcss <= 8.5.22` audit advisories.
- `[DEF-11]` (`P1`, **Deferred**): Production `/dashboard` 5x latency re-measured `[4224.2, 1559.9, 1309.2, 1613.7, 1399.3]` ms (`median 1559.9 ms`, `max 4224.2 ms`) from repeated remote `auth.getUser()` RTT across `web/middleware.ts` and `web/lib/workspace.ts`.
- `[DEF-12]` (`P2`, **Deferred**): Route `loading.tsx` boundaries in `web/app/(app)/loading.tsx`, `documents/[id]/loading.tsx`, and `documents/[id]/history/loading.tsx` stream `HTTP 200` soft-404 status headers before `notFound()` renders `"Page not found"` in DOM.
