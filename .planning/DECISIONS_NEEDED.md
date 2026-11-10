# Decisions & Actions Needed From Project Owner

No secret values were read or printed anywhere in preparing this document. Every Tier B code/infrastructure change below was left unapplied in accordance with workspace rules.

---

## 1. Missing Environment Variable Names (Required for Live M2/M3 DB & AI End-to-End Runs)

Boolean presence checks (no values inspected or printed) identified the following missing server-side variables:

| File | Missing Variable Name(s) | Effect / Action Needed |
| --- | --- | --- |
| `web/.env.local` | `SUPABASE_SERVICE_ROLE_KEY`, `AI_SERVICE_TOKEN` | Paste your Supabase Project Settings → API `service_role` key into `SUPABASE_SERVICE_ROLE_KEY`, and set a shared random secret for `AI_SERVICE_TOKEN`. |
| `ai-service/.env` | `AI_SERVICE_TOKEN` | Set `AI_SERVICE_TOKEN` to the **exact same value** as `web/.env.local` so `x-api-key` verification on `POST /review` succeeds (`Depends(require_key)`). |

*(Verified present as booleans: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DEMO_EMAIL`, `DEMO_PASSWORD`, `AI_SERVICE_URL=http://127.0.0.1:8000` in `web/.env.local`, and `GROQ_API_KEY` in `ai-service/.env`. Until the missing secrets above are set and servers restarted, `POST /api/review` honestly returns `HTTP 503` without writing fake findings.)*

**Exact action after adding the variables:** Restart `ai-service` (`:8000`) and `web` (`:3000`) — see `.planning/AUTONOMOUS_REPORT.md` for exact commands and `USER-RUN` E2E verification steps.

---

## 2. Open Tier B Defects (Awaiting Your Explicit `"APPROVED"` Reply)

### `[DEF-09]` — Missing ESLint script/config & 4 transitive `postcss` advisories
- **Severity:** `P2` | **Rule:** Adding dependencies / modifying `web/package.json` & `pnpm-lock.yaml` is Tier B.
- **Root Cause:** `web/package.json` omits a `"lint"` script and `eslint` / `eslint-config-next`, and transitive `next > postcss <= 8.5.22` triggers `2 high, 2 moderate` advisories in `pnpm audit --json`.
- **Proposed Diff (`web/package.json` + regenerated `pnpm-lock.yaml`):**
```diff
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
     "@types/node": "^22.13.0",
...
+  },
+  "pnpm": {
+    "overrides": {
+      "postcss": ">=8.5.23"
+    }
   }
```
- **Reply to approve:** `APPROVED [DEF-09]`

---

### `[DEF-11]` — Protected `/dashboard` SSR navigation shows `4.22s` cold latency (`1.56s` median)
- **Severity:** `P1` | **Rule:** Modifying `web/middleware.ts` or auth verification flow is Tier B.
- **Root Cause:** Every protected SSR request performs two sequential remote round-trips over TLS to Supabase Auth (`supabase.auth.getUser()` inside `web/middleware.ts:48` and again inside `web/lib/workspace.ts:47`) before executing workspace queries.
- **Proposed Diff (`web/middleware.ts` — requires Supabase asymmetric JWT signing keys enabled, or keeping single verified `getUser()` call in server loaders only):**
```diff
-  // Always verify session integrity via getUser() rather than trusting cookie claims alone.
-  const {
-    data: { user },
-  } = await supabase.auth.getUser();
+  // Verify JWT signature locally when asymmetric keys are active, keeping full getUser()
+  // checks inside server actions, API routes, and page data loaders.
+  const { data: claimsData } = await supabase.auth.getClaims();
+  const user = claimsData?.claims ?? null;
```
- **Reply to approve:** `APPROVED [DEF-11]`

---

### `[DEF-12]` — Streaming `loading.tsx` flushes `HTTP 200` soft-404 status on invalid/missing document UUIDs
- **Severity:** `P2` | **Rule:** Deleting tracked files is Tier B.
- **Root Cause:** `loading.tsx` inside `web/app/(app)/`, `web/app/(app)/documents/[id]/`, and `web/app/(app)/documents/[id]/history/` wraps dynamic routes in React `<Suspense>`, causing Next.js to send `HTTP 200` streaming headers before async `notFound()` throws (`<h1>Page not found</h1>` still renders in DOM, but crawlers/HTTP probes observe status `200` instead of `404`).
- **Proposed Diff:** Delete those 3 `loading.tsx` files while keeping `loading.tsx` on `/dashboard`, `/knowledge`, and `/documents/new`:
```diff
- delete file web/app/(app)/loading.tsx
- delete file web/app/(app)/documents/[id]/loading.tsx
- delete file web/app/(app)/documents/[id]/history/loading.tsx
```
- **Reply to approve:** `APPROVED [DEF-12]`

---

## 3. Committed SQL Scripts Status (`USER-RUN`)

All SQL scripts remain **NOT applied by the agent**:
1. **Completed by Project Owner (`USER-RUN`):** Applied `supabase/migrations/0002_rls_hardening.sql` (`[DEF-10]`) and ran `supabase/tests/rls_checks.sql` in Supabase SQL Editor — observed `7 of 7` isolation cases (`a–g`) pass, RLS policies active across all `14` public tables, and `0` `DELETE` grants for `authenticated`.
2. **Pending (`USER-RUN`):** Run `supabase/tests/decision_rls.sql` (`cases a–d`: approver/admin allow, creator `42501`, duplicate `23505`, outsider cross-workspace `42501`, wrapped in `begin`/`rollback`).
3. **Pending (`USER-RUN`, post-test only):** **Apply `supabase/migrations/0003_audit_server_only.sql` ONLY AFTER a live M3 decision test passes cleanly** (drops client `audit_insert` policy so only `service_role` inserts `audit_events`).

---

## 4. Deferred UI / Feature-Freeze Decisions

### Dashboard `"service status"` line (Not present — left unadded)
- **Observed (`web/app/(app)/dashboard/page.tsx`):** Verified directly that `/dashboard` renders workspace name/role, **Knowledge Ledger**, and **Recent Documents**, with no `"service status"` line or widget. Runtime config booleans live on `GET /api/health` (`supabase_configured`, `ai_service_configured`), `/login` displays a missing-Supabase config warning when unset, and `/documents/[id]` displays `AiStatusBanner` (`AI review completed` / `AI unavailable` / `AI output rejected` / `AI check skipped`) on review runs.
- **Action Taken:** Did **not** add a dashboard service-status line (feature freeze; no unapproved UI additions).
- **Decision Needed:** Confirm keeping `/dashboard` without a service-status line for submission, or explicitly request adding one if desired after freeze.
