# BrandGuardian — Complete Reliability Remediation Baseline

**Generated:** `2026-11-10T09:05:00+05:30`  
**Repository:** `avi221209/Code-Titan-Hackathon-2026` (`E:\Plugins\Get Shit Done\Code Titan 2026\brandguardian`)  
**Branch / Starting HEAD:** `main` @ `03a9c96c32f067936c632c779a60681923a86afe`  
**Ports `3000` / `8000`:** Untouched (`Get-NetTCPConnection -LocalPort 3000,8000 -State Listen` empty at start of remediation).

---

## 1. Preserved Pre-Existing Working Tree Diffs

At the start of remediation, the working tree already contained audit/remediation prep changes that are preserved intact:
- **Modified (`M`):** `.planning/AUTONOMOUS_REPORT.md`, `.planning/AUTONOMOUS_REPORT_2.md`, `.planning/DECISIONS_NEEDED.md`, `.planning/PUSH_REPORT.md`, `.planning/STATE.md`, `ai-service/.dockerignore`, `docs/contributions.md`, `docs/round3-roadmap.md`, `docs/submission-checklist.md`, `supabase/migrations/0003_audit_server_only.sql`, `supabase/tests/decision_rls.sql`, `web/lib/profiles.ts`, `web/lib/validators/decision.test.ts`, `web/lib/validators/decision.ts`
- **Untracked (`??`):** `.planning/AI_TRUST_AUDIT.md`, `.planning/API_FAILURE_MATRIX.md`, `.planning/DEPLOYMENT_READINESS.md`, `.planning/RELIABILITY_AUDIT.md`, `.planning/SECURITY_AUDIT.md`

---

## 2. Installed Tooling & Skills Availability

- **GSD tooling:** Not installed locally (`C:\Users\AVADHUT\.claude\get-shit-done` = absent; no GSD skill under `~/.gemini/config/skills`). Remediation phase tracking and checkpoints are maintained manually under `.planning/`.
- **Superpowers / Addy Osmani skills (`agent-skills`):** Verified present locally (`security-and-hardening`, `frontend-ui-engineering`, `code-review-and-quality`, `performance-optimization`, `debugging-and-error-recovery`, `test-driven-development`, `browser-testing-with-devtools`, `observability-and-instrumentation`, `verification-before-completion`).
- **Local CLIs:** `node v24.14.0`, `pnpm`, Python `.venv` with `pytest` & `fastapi.testclient`, Chromium Playwright (`C:\Program Files (x86)` / Playwright browser). `docker` and `psql` binaries are **not** installed locally (`USER-RUN` for Docker container build & Supabase SQL Editor runs).

---

## 3. Baseline Verification Command Outputs (Prior to Any Remediation Edits)

| Check | Exact Command | Result | Exit Code |
| --- | --- | --- | --- |
| **Python suite** | `.\ai-service\.venv\Scripts\python.exe -m pytest -q ai-service` | `12 passed, 1 warning in 0.40s` | `0` |
| **Web TS typecheck** | `pnpm --dir web typecheck` | Clean `tsc --noEmit` | `0` |
| **Web TS unused check** | `pnpm --dir web exec tsc --noEmit --noUnusedLocals --noUnusedParameters` | Clean (`0` unused locals/params) | `0` |
| **Web unit tests** | `pnpm --dir web test` | `17 passed, 0 failed in 177.99ms` | `0` |
| **Web production build** | `pnpm --dir web build` | Clean (`102 kB` shared First Load JS, `7/7` static routes, `94.5 kB` middleware) | `0` |
| **Web dependency audit** | `pnpm --dir web audit --json` | `4` transitive `next@15.5.29 > postcss@8.4.31` advisories (`2 moderate`, `2 high`: GHSA-qx2v-qp2m-jg93, GHSA-6g55-p6wh-862q, GHSA-fxqj-rqcc-2cmp, GHSA-r28c-9q8g-f849) | `1` |

---

## 4. Target Defect Scope & Plan

| Defect ID | Severity | Area | Planned Remediation |
| --- | --- | --- | --- |
| **`[DEF-10]`** | `P1` | `supabase/`, `.planning/DEFECTS.md` | Sync `.planning/DEFECTS.md` register accuracy (committed in `1db160f`, owner-applied `7/7` `rls_checks.sql`). |
| **`[DEF-14]`** | `P1` | `supabase/migrations/0004_*`, `supabase/tests/remediation_checks.sql` | Write unapplied idempotent `0004_remediation_integrity_and_rpc.sql`: lock `documents.status` & post-review `title`/`content` via `BEFORE UPDATE` trigger (using `current_user in ('service_role','postgres','supabase_admin')` OR session-local `app.internal_workflow` GUC so `SECURITY DEFINER` RPCs succeed while PostgREST `authenticated` updates fail with `42501`), lock initial `documents.status = 'draft'` on client insert, add composite `(workspace_id, ...)` FKs (`guideline_rules`, `review_runs`, `comments`), `REVOKE ALL ON FUNCTION is_member/has_role FROM PUBLIC, anon`, domain `CHECK`s. Application to live Supabase remains `USER-RUN`. |
| **`[DEF-15]`** | `P1` | `0004_*`, `web/app/api/suggestions/[id]/decision/route.ts`, `web/app/api/review/route.ts` | Add `SECURITY DEFINER` RPC `record_review_decision(...)` for atomic single-transaction decision/suggestion/audit/doc completion; add partial unique index `uq_review_runs_one_running` (`WHERE status = 'running'`); update `decision/route.ts` to call RPC & map SQLSTATE (`23505->409`, `42501->403`, `P0002->404`, `22023/22001/23514->400`); handle `23505 -> 409` + check DB write errors (`markRunFailed`, stale cleanup, `documents.update`) in `review/route.ts` + add TDD mocked route tests. |
| **`[DEF-16]`** | `P1` | `ai-service/main.py`, `web/lib/validators/{review,decision}.ts`, `web/components/document-review-workspace.tsx` | Standardize `Finding.start_offset`/`end_offset` to UTF-16 code units across Python -> DB -> TS -> DOM, add per-quote cursor in `run_llm()`, refuse ambiguous multi-occurrence `indexOf` fallback (`return null` / `skippedUnmatchedCount += 1`), track highlightability accurately for duplicate spans, and add TDD suites for 7 Unicode/emoji/RTL/CJK/duplicate edge cases. |
| **`[DEF-17]`** | `P1` | `ai-service/main.py`, `web/app/api/review/route.ts`, `web/app/(app)/knowledge/page.tsx` | Enforce semantic category & severity-escalation checks on `guideline_rule` inside `verify()`, filter `approved_facts` by `valid_from`/`valid_until` UTC date window & inner-join `guidelines!inner(status = 'approved')` in `POST /api/review`, reflect parent `guidelines.status` in `/knowledge/page.tsx`, include compact active facts/terms context in `build_user_prompt()`, bound `Finding.confidence` `[0, 1]`, and increment `dropped` when slicing `data.findings[:5]`. |
| **`[DEF-18]`** | `P1/P2` | `web/components/document-review-workspace.tsx`, `decision/route.ts`, `0004_*`, `ai-service/main.py` | Apply `isHighOrCritical && !evidenceWasOpened` gate to **Edit** button, update helper copy, reject `decision === 'edited'` when `suggested_text === null` in API & RPC, add DB `CHECK`s (`0004`), and verify client/API/RPC alignment. |
| **`[DEF-19]`** | `P2` | `ai-service/main.py`, `web/app/api/health/route.ts` | Map `ai-service` upstream exceptions cleanly to safe human copy (zero `HTTPStatusError`/`OSError`/`ReadTimeout`), add lightweight `GET /ready` endpoint on `ai-service`, upgrade `GET /api/health` to report honest readiness (without leaking env var details or falsely claiming `ai_service_configured: true` when `AI_SERVICE_TOKEN`/`SUPABASE_SERVICE_ROLE_KEY` are absent), and test full failure matrix via local mock HTTP servers. |
| **`[DEF-20]`** | `P2` | `web/app/api/{review,suggestions/[id]/decision,documents}/route.ts`, `docs/deployment.md`, `web/lib/*` | Add safe structured JSON error logging (route, runId/suggestionId, error/SQLSTATE code — zero secrets, zero document body), lightweight in-memory per-user review rate-limit protection cleanly documented (`serverless-local`), and preserve explicit `USER-RUN` runtime/hosting checks (`maxDuration`, `60s` Fluid Compute, warm `/health`). |
| **`[DEF-21]`** | `P2` | `web/app/globals.css`, `web/components/{app-shell,document-review-workspace}.tsx`, `web/app/{page,(auth)/login/page}.tsx`, `web/components/ui/textarea.tsx` | Darken `--border-subtle` (light & dark mode >= `3.0:1` WCAG 1.4.11 against both canvas and card surface), add skip-to-main links (`#main-content`), replace nested `<article tabIndex={0}>` interactive wrapper, add `aria-[invalid=true]:border-destructive` + `motion-reduce:transition-none` on `Textarea`, fix collapsed Medium/Low hint, and validate blank Edit/Reject input client-side before submit. |
| **`[DEF-22]`** | `P2` | `web/app/page.tsx`, `web/components/new-document-form.tsx`, `docs/features.md`, `ai-service/.env.example`, `web/app/(app)/knowledge/page.tsx`, `supabase/seed.sql` | Fix stale M2–M3 copy, replace `"atomic"` inaccuracy in `docs/features.md`, add `GROQ_URL=` to `ai-service/.env.example`, fix `/knowledge` guideline status labeling, tighten seed regex `\b(?:cheapest|best(?!\s+practices\b)|number one)...` (with `USER-RUN` live-DB rule update SQL in `0004`/docs). |
| **`[DEF-23]`** | `P3` | `web/components/ui/{dialog,toast}.tsx`, `web/app/layout.tsx`, `.planning/` | Audit unused exports cleanly: remove dead unused `dialog.tsx` / simplify unused `toast` export safely without breaking `Toaster` / styles; document vestigial schema columns (`documents.version`, `comments`) cleanly (`0001` untouched). |
| **`[DEF-09]`** | `P2` | `web/package.json`, `web/pnpm-lock.yaml`, ESLint config | Add ESLint (`eslint` + `eslint-config-next` + flat/eslintrc config matching Next 15), add `"lint": "next lint"` script, add `pnpm.overrides.postcss >= 8.5.23`, achieve `0` `pnpm lint` errors and `0` moderate/high/critical advisories in `pnpm audit --json`. |
| **`[DEF-11]`** | `P1` | `web/middleware.ts`, `web/lib/workspace.ts` | Use cryptographically verified `supabase.auth.getClaims()` in `middleware.ts` & `getWorkspaceContext()` (preserving `getUser()` in mutating API routes; never trusting unsigned cookies) and measure before/after SSR timing on temp production server (`next start`). |
| **`[DEF-12]`** | `P2` | `web/app/(app)/loading.tsx`, `documents/[id]/loading.tsx`, `documents/[id]/history/loading.tsx` | Remove the 3 streaming `loading.tsx` boundaries covering `[id]`/`(app)` while keeping leaf `loading.tsx` on `/dashboard`, `/knowledge`, `/documents/new`; verify real `HTTP 404` on invalid/missing UUIDs. |

