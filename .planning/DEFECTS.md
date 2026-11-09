# BrandGuardian — Defect Log (QA-Fix Loop)

**Last Updated:** 2026-11-10T05:15:00+05:30  
**Severity Rules:**
- **P0:** Blocks core workflow or introduces security vulnerability
- **P1:** Breaks an existing feature or acceptance criterion / security hardening / WCAG violation
- **P2:** Polish, documentation honesty, non-blocking DX/UX issue

**Fix Tiers:**
- **Tier A:** Autonomous fix -> failing test/repro -> minimal fix -> re-test -> full suite -> commit `fix(<area>): <what>  [DEF-nn]`
- **Tier B:** Diagnose, document root cause & proposed diff, **STOP for `"APPROVED"`** (`supabase/`, middleware/auth logic, contract, `ai-service/main.py`, dependencies, deletions, git history)

---

## Defect Register

### Fixed (Tier A — Committed)

### `[DEF-01]` — Root `/` landing page displayed stale M0 copy and lacked an `<h1>` landmark
- **Severity:** `P1` | **Tier:** `Tier A` | **Layer:** L6, L7, L9 | **Status:** `FIXED (f6b890c)`
- **Before Evidence:** `GET http://127.0.0.1:3000/` rendered `"Evidence-backed brand compliance workspace scaffolded in M0; authentication, database integration, and review workflows arrive in M1 through M3."` and `h1Count: 0` (`<h2>BrandGuardian</h2>`).
- **Root Cause:** `web/app/page.tsx` retained M0 placeholder copy and used `<CardTitle>` (`<h2>`).
- **Fix Applied:** Updated copy in `web/app/page.tsx` to describe M1 features accurately (auth, RLS workspace knowledge, draft creation; M2/M3 review pending) and rendered `<h1>BrandGuardian</h1>`.
- **After Evidence (Round 2):** `has_stale_m0: false`, `h1Count: 1`, `h1Texts: ["BrandGuardian"]`, `title: "BrandGuardian — Brand Compliance Workspace"`, `overflow: false`.

### `[DEF-02]` — `/documents/[id]/history` accepted invalid UUIDs (`HTTP 200`), lacked auth/workspace doc validation, missed `<h1>`, and lacked navigation
- **Severity:** `P1` | **Tier:** `Tier A` | **Layer:** L3, L6, L7 | **Status:** `FIXED (9d0d94f)` *(note side effect logged separately as Tier B `[DEF-12]` after `[DEF-04]`)*
- **Before Evidence:** `GET /documents/not-a-uuid/history` returned `HTTP 200`, rendered `<h2>Document Audit History</h2>` (`h1Count: 0`), and had no Back navigation link.
- **Root Cause:** `web/app/(app)/documents/[id]/history/page.tsx` was an unvalidated M0 stub without `isUuid(id)`, `getWorkspaceContext()`, RLS `documents` lookup, `<h1>`, or navigation link.
- **Fix Applied:** Added `isUuid(id)` -> `notFound()`, `getWorkspaceContext()`, `createClient()` `.from('documents').select('id, title')...` (`notFound()` if missing), semantic `<h1>Document Audit History</h1>`, `"Back to document"` link, and honest M3 placeholder note.
- **After Evidence:** Commit `9d0d94f` verified true HTTP `404` on `/documents/not-a-uuid/history`; Round 2 verified `h1Count: 1` (`"Document Audit History"`), `has_back_link: true`, `has_m3_note: true`, and `<h1>Page not found</h1>` rendered for invalid/missing UUIDs (streaming `HTTP 200` status logged as Tier B `[DEF-12]`).

### `[DEF-03]` — `error.tsx` exposed raw `error.message` to clients and `error.tsx`/`not-found.tsx` missed `<h1>`
- **Severity:** `P1` | **Tier:** `Tier A` | **Layer:** L5(c), L7 | **Status:** `FIXED (eee77d0)`
- **Before Evidence:** `web/app/error.tsx` rendered `{error.message || ...}` in client DOM; both `error.tsx` and `not-found.tsx` used `<CardTitle>` (`<h2>`, `h1Count: 0`).
- **Root Cause:** Boundary UIs rendered raw exception message strings and `<CardTitle>` heading level 2.
- **Fix Applied:** Replaced raw `{error.message}` in `web/app/error.tsx` with fixed fallback copy plus optional opaque `error.digest`, added `<h1>` to both `error.tsx` and `not-found.tsx`, added `"Return to Dashboard"` link and focus-visible button styling.
- **After Evidence (Round 2):** `git grep "error.message" web` = 0 hits; `GET /nonexistent-route-qa` returns `HTTP 404` with `h1Count: 1` (`"Page not found"`).

### `[DEF-04]` — Missing loading states across `(app)` routes & duplicate route `<title>` metadata
- **Severity:** `P2` | **Tier:** `Tier A` | **Layer:** L6, L7, L8 | **Status:** `FIXED (3cf731c)` *(parent/`[id]` `loading.tsx` soft-404 status logged as Tier B `[DEF-12]`)*
- **Before Evidence:** SSR navigations took `1.86–4.13s` without `loading.tsx` skeletons, and all pages shared `<title>BrandGuardian</title>`.
- **Root Cause:** Route-segment `loading.tsx` boundaries and per-page `metadata.title` exports were omitted in M1.
- **Fix Applied:** Added `title: { default: 'BrandGuardian', template: '%s | BrandGuardian' }` in `web/app/layout.tsx`, unique `metadata.title` on every route, and accessible `loading.tsx` skeletons (`role="status"`, `aria-busy="true"`, `<Skeleton />`).
- **After Evidence (Round 2):** Unique titles verified on every route (`"BrandGuardian — Brand Compliance Workspace"`, `"Sign In | BrandGuardian"`, `"Dashboard | BrandGuardian"`, `"Knowledge Base | BrandGuardian"`, `"New Document | BrandGuardian"`, `"Document Draft | BrandGuardian"`, `"Document History | BrandGuardian"`).

### `[DEF-05]` — `next.config.mjs` exposed `X-Powered-By: Next.js` and lacked `Content-Security-Policy` & `Permissions-Policy`
- **Severity:** `P1` | **Tier:** `Tier A` | **Layer:** L5(d) | **Status:** `FIXED (a665b88)`
- **Before Evidence:** Header probe returned `x-powered-by: "Next.js"`, `content-security-policy: null`, `permissions-policy: null`.
- **Root Cause:** `web/next.config.mjs` omitted `poweredByHeader: false` and `Content-Security-Policy` / `Permissions-Policy` / `X-DNS-Prefetch-Control` headers.
- **Fix Applied:** Added `poweredByHeader: false`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `X-DNS-Prefetch-Control: off`, and environment-aware `Content-Security-Policy` (`buildCsp()`). Added unit test `web/lib/validators/security.test.mjs` (RED -> GREEN).
- **After Evidence (Round 2):** `x-powered-by: null`, CSP & Permissions-Policy present on `/`, `/login`, and `/api/health`, `6/6` tests passing, and `csp_violations: []` in Chromium across all flows.

### `[DEF-06]` — Stale M0 descriptions across `README.md`, `docs/limitations.md`, `docs/test-evidence.md`, and `.planning/STATE.md`
- **Severity:** `P2` | **Tier:** `Tier A` | **Layer:** L9 | **Status:** `FIXED (4f31de7)`
- **Before Evidence:** Docs still claimed M0-only scaffold / `/api/documents` returning `501` / `supabase_configured: false`.
- **Root Cause:** Markdown documentation was not updated after M1 commit `e94ee70` and QA verification.
- **Fix Applied:** Updated all 4 files to match verified M0+M1 reality, M2/M3 stubs (`501`), exact measured timings, and open Tier B / `USER-RUN` items honestly.
- **After Evidence:** All internal file links verified (`True`), accurate M1 status and `USER-RUN` requirements recorded cleanly.

### `[DEF-07]` — `POST /api/documents` queried `workspace_members` before validating JSON payload & failed `500` on NUL `\u0000` bytes
- **Severity:** `P2` | **Tier:** `Tier A` | **Layer:** L2, L3, L8 | **Status:** `FIXED (09367e8)`
- **Before Evidence:** Invalid JSON / array payloads incurred a remote Supabase `workspace_members` lookup (`710–1324 ms`), and `\u0000` NUL bytes in `title`/`content` passed validator validation (rejected by PostgreSQL `text` at insert time).
- **Root Cause:** JSON parsing/validation executed after `getWorkspaceContext()`, and `validateDocumentInput` lacked a `\u0000` guard.
- **Fix Applied:** Added RED->GREEN unit tests in `web/lib/validators/m1.test.ts` for array payloads and NUL bytes, added `\u0000` check in `web/lib/validators/m1.ts`, and moved JSON parsing + `validateDocumentInput` before `getWorkspaceContext()` in `web/app/api/documents/route.ts`.
- **After Evidence (Round 2):** `{bad json`, `[]`, `\u0000` NUL byte, and `6001` chars all return `HTTP 400` in `254.2–319.3 ms` (down from `710–1324 ms` due to eliminated pre-validation DB query).

---

### Tier B — Approved (`[DEF-08]`, `[DEF-10]`) & Deferred (`[DEF-09]`, `[DEF-11]`, `[DEF-12]`)

### `[DEF-08]` — `ai-service` `POST /review` returns HTTP `422` schema error before HTTP `401` auth when payload is invalid
- **Severity:** `P2` | **Tier:** `Tier B` *(APPROVED — touches `ai-service/main.py`)* | **Layer:** L3, L4, L5 | **Status:** `FIXED (3727052)`
- **Before Evidence:** Unauthenticated `POST http://127.0.0.1:8000/review` with `{}` returned `HTTP 422` revealing Pydantic schema requirements (`document_id`, `workspace_id`, etc.) before auth validation.
- **Root Cause:** `ai-service/main.py:375-377` validated `x_api_key` inside the route handler after FastAPI parsed `ReviewRequest`.
- **Fix Applied (`3727052`):** Added RED->GREEN test `test_review_rejects_unauthenticated_empty_body_with_401` in `ai-service/test_checks.py` and moved `require_key` to `dependencies=[Depends(require_key)]` on `@app.post("/review")` in `ai-service/main.py`.
- **After Evidence:** `.\ai-service\.venv\Scripts\python.exe -m pytest -q ai-service` → `12 passed`; live `POST http://127.0.0.1:8000/review` with `{}` and no `x-api-key` returns `HTTP 401 {"detail":"unauthorized"}`.

### `[DEF-09]` — Missing ESLint script/config & 4 transitive `postcss` advisories in `pnpm audit`
- **Severity:** `P2` | **Tier:** `Tier B` *(DEFERRED — dependency changes in `web/package.json` / `pnpm-lock.yaml`)* | **Layer:** L1, L5(e) | **Status:** `OPEN / DEFERRED (Tier B)`
- **Evidence (Round 1 & Round 2):** `web/package.json:5-11` has no `"lint"` script or ESLint devDependencies; `pnpm --dir web audit --json` reports `{'info': 0, 'low': 0, 'moderate': 2, 'high': 2, 'critical': 0}` (4 transitive `next > postcss <= 8.5.22` advisories).
- **Root Cause:** ESLint was omitted in M0 and transitive `postcss` inside Next `15.5.29` resolves below `8.5.23`.
- **Proposed Diff (awaiting `APPROVED`):**
```diff
 // web/package.json
   "scripts": {
     "dev": "next dev",
     "build": "next build",
     "start": "next start",
+    "lint": "next lint",
     "test": "node --test lib/validators/*.test.*",
     "typecheck": "tsc --noEmit"
   },
   "devDependencies": {
+    "eslint": "^9.x",
+    "eslint-config-next": "^15.5.29",
...
+  },
+  "pnpm": {
+    "overrides": {
+      "postcss": ">=8.5.23"
+    }
   }
```

### `[DEF-10]` — `documents_update` RLS `with check` allows changing `workspace_id`/`created_by`/`status`; broad `GRANT DELETE` & missing RLS indexes
- **Severity:** `P1` *(database defense-in-depth; M1 exposes no document `UPDATE` route/UI)* | **Tier:** `Tier B` *(APPROVED — touches `supabase/`)* | **Layer:** L5(g) | **Status:** `SQL COMMITTED (1db160f) — NOT APPLIED, PENDING USER-RUN`
- **Before Evidence:** `supabase/migrations/0001_schema.sql:163-173` called `auth.uid()` directly rather than `(select auth.uid())`; lines `158-160` omitted RLS indexes on `workspace_members`, `guideline_rules`, `approved_facts`, and `terminology`; `documents_update` `with check (public.is_member(workspace_id))` allowed altering `workspace_id`/`created_by` on update; line `240` granted `delete` on all public tables to `authenticated`.
- **Root Cause:** Compact M0 DDL prioritized brevity over column immutability checks, least-privilege grants, and RLS index coverage.
- **Fix Applied (`1db160f`):** Added idempotent `supabase/migrations/0002_rls_hardening.sql` (not applied anywhere) containing `(select auth.uid())` in `is_member`/`has_role` (`SECURITY DEFINER`, `SET search_path = public`), `BEFORE UPDATE` immutability trigger on `public.documents` (`workspace_id`, `created_by`), tightened `documents_update`, `REVOKE DELETE` from `authenticated` on all 14 public tables, the 4 indexes, and rollback note; extended `supabase/tests/rls_checks.sql` with cases `(f)` and `(g)`. Pending manual execution in Supabase SQL Editor.

### `[DEF-11]` — Protected `/dashboard` SSR navigations show `4.22s` cold first-load latency (`1.31–1.61s` warm) due to repeated remote `auth.getUser()` RTT
- **Severity:** `P1` | **Tier:** `Tier B` *(DEFERRED — touches `web/middleware.ts` & auth validation flow)* | **Layer:** L8 | **Status:** `OPEN / DEFERRED (Tier B)`
- **Evidence:**
  - Initial Round 2 (`next start`): `[3372.1, 3568.5, 2861.4, 3249.1, 4144.7]` ms (`median 3372.1 ms`, `worst 4144.7 ms`).
  - Re-measurement against fresh production build (`pnpm build` + `next start -p 3000`): `[4224.2, 1559.9, 1309.2, 1613.7, 1399.3]` ms (`min 1309.2 ms`, **`median 1559.9 ms`**, `max 4224.2 ms`).
- **Root Cause:** Every protected SSR page executes `supabase.auth.getUser()` remotely in `web/middleware.ts:48` and again in `web/lib/workspace.ts:47` before running page queries against remote Supabase over TLS.
- **Proposed Fix (deferred):** Evaluate switching to Supabase asymmetric JWT signing keys with `supabase.auth.getClaims()` in `web/middleware.ts` (avoiding duplicate remote Auth RTT while keeping server signature verification), or passing verified session context cleanly without trusting unverified cookies.

### `[DEF-12]` — Streaming `loading.tsx` on parent `(app)` and `[id]` dynamic routes flushes `HTTP 200` soft-404 status before `notFound()` renders
- **Severity:** `P2` | **Tier:** `Tier B` *(DEFERRED — requires deleting 3 tracked `loading.tsx` files)* | **Layer:** L3, L6 | **Status:** `OPEN / DEFERRED (Tier B)`
- **Evidence (Round 2):** Before `3cf731c`, `GET /documents/not-a-uuid/history` returned true `HTTP 404` (`9d0d94f`). After `3cf731c` added `loading.tsx` across all `(app)` routes, `GET /documents/not-a-uuid`, `GET /documents/not-a-uuid/history`, and `GET /documents/00000000-0000-0000-0000-000000000000` render `<h1>Page not found</h1>` in DOM via streamed `NEXT_NOT_FOUND`, **but flush HTTP `200` status headers** (`history_negative_checks: { bad_uuid_status: 200, missing_uuid_status: 200 }`).
- **Root Cause:** Next.js wraps every route segment (and child segments) beneath `loading.tsx` inside React `<Suspense>`, sending HTTP `200` streaming headers immediately before async `notFound()` runs in `documents/[id]/page.tsx` or `documents/[id]/history/page.tsx`.
- **Proposed Diff (deferred):** Remove the 3 `loading.tsx` boundaries covering parent/`[id]` segments while retaining `loading.tsx` on `/dashboard`, `/knowledge`, and `/documents/new`:
```diff
- delete web/app/(app)/loading.tsx
- delete web/app/(app)/documents/[id]/loading.tsx
- delete web/app/(app)/documents/[id]/history/loading.tsx
```
