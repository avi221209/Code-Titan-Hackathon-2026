# BrandGuardian — Security, RLS & Isolation Audit (Phase 4)

> [!IMPORTANT]
> **Post-Remediation Update (`2026-11-10`, Uncommitted Working Tree Ready for Review):**  
> Sections 1–6 below preserve the **Pre-Remediation Baseline (`HEAD 03a9c96`)**. Working-tree fixes (`[DEF-09]`, `[DEF-14]`, `[DEF-15]`, `[DEF-20]`, `[DEF-23]`) addressed all audited code & DDL gaps:
> - **SQL Hardening Migration Complete (`[DEF-14]`/`[DEF-15]` — `USER-RUN` Apply):** Authored idempotent [`supabase/migrations/0004_remediation_integrity_and_rpc.sql`](../supabase/migrations/0004_remediation_integrity_and_rpc.sql) + [`supabase/tests/remediation_checks.sql`](../supabase/tests/remediation_checks.sql) (`cases h–o`) revoking `PUBLIC`/`anon` `EXECUTE` on `is_member`/`has_role`/`record_review_decision`, enforcing `documents_insert` (`status = 'draft'`), locking `documents.status` & post-review `title`/`content`, adding composite workspace FKs (`guideline_rules`, `review_runs`, `comments`), adding domain `CHECK`s, adding `uq_review_runs_one_running`, and providing transactional `record_review_decision(...)`. Executing `decision_rls.sql`, `0003`, `0004`, and `remediation_checks.sql` in Supabase SQL Editor remains **`USER-RUN`**.
> - **Dependency Advisories & App Rate Limits (`[DEF-09]`, `[DEF-20]`):** `web/pnpm-workspace.yaml` overrides resolved all `postcss`/`minimatch` advisories (`pnpm audit --json` **`exit 0`, `0` advisories**); `FixedWindowRateLimiter` & redacting [`logger.ts`](../web/lib/server/logger.ts) added to `review`, `decision`, `documents`, and `login/actions`.
> - **Auth SSR (`[DEF-11]`):** [`claims.ts`](../web/lib/supabase/claims.ts) uses verified `auth.getClaims()` + JWKS cache for SSR navigation while all API mutations retain live `auth.getUser()` (`claims.test.ts` `4/4` pass).  
> - **See:** [`.planning/REMEDIATION_REPORT.md`](REMEDIATION_REPORT.md) · [`.planning/REMAINING_USER_RUN.md`](REMAINING_USER_RUN.md)

**Original Baseline Audit Date:** `2026-11-10` (IST)  
**Baseline Target Commit:** `03a9c96` (`main`, pre-remediation)  
**Verification Scope:** Static audit of all SQL DDL/migrations/tests (`0001_schema.sql`, `0002_rls_hardening.sql`, `0003_audit_server_only.sql`, `rls_checks.sql`, `decision_rls.sql`), client/server bundle & grep scans (`39` compiled `.next/static/**/*.js` files + full `web/` source), HTTP security header & CORS inspection on production `next start -p 3105`, and manual owner SQL execution ledger (`0002` + `rls_checks.sql` `7/7` PASS).

---

## 1. All 14 PostgreSQL Tables: RLS, Policies, Grants & Gaps

Migration `0001_schema.sql` creates `14` public tables; `0002_rls_hardening.sql` (applied by Project Owner in Supabase SQL Editor) updated helper functions, `documents_update`, `REVOKE DELETE ... FROM authenticated`, and `4` indexes; **`0003_audit_server_only.sql` remains NOT APPLIED (`USER-RUN`)**.

| # | Table | RLS Enabled (`pg_tables`) | `authenticated` SELECT | `authenticated` INSERT | `authenticated` UPDATE | `authenticated` DELETE | Audited Vulnerabilities / Gaps |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `1` | `public.profiles` | `true` (`0001:176`) | `id = auth.uid()` | `id = auth.uid()` | `id = auth.uid()` | **REVOKED** (`0002:96`) | Safe self-access (`auth.uid()` in `0001:181` lacks `(select auth.uid())` initplan). Cross-user names resolved server-side via `loadProfileNamesMap()` (`admin` / fallback). |
| `2` | `public.workspaces` | `true` (`0001:177`) | `is_member(id)` | *Denied* (no policy) | *Denied* (no policy) | **REVOKED** | Safe. |
| `3` | `public.workspace_members` | `true` (`0001:178`) | `is_member(workspace_id)` | *Denied* | *Denied* | **REVOKED** | Safe against privilege escalation via PostgREST (membership/roles write-locked from clients). |
| `4` | `public.guidelines` | `true` (`0001:193`) | `is_member(workspace_id)` | `has_role(..., ['manager','admin'])` | `has_role(..., ['manager','admin'])` | **REVOKED** | Safe (`approver`/`creator` blocked). Missing `(select auth.uid())` optimization only affects helper calls (fixed in `0002`). |
| `5` | `public.guideline_rules` | `true` (`0001:193`) | `is_member(workspace_id)` | `has_role(..., ['manager','admin'])` | `has_role(..., ['manager','admin'])` | **REVOKED** | **Cross-workspace FK Gap (`[DEF-14]`):** `guideline_id references public.guidelines(id)` lacks composite FK `(workspace_id, guideline_id)` — a manager of WS-A could link a rule's `guideline_id` to a WS-B guideline UUID if guessed (mitigated slightly because `guidelines_select` hides WS-B title, still dirty FK). Also `category` mismatch fallback noted in Phase 1. |
| `6` | `public.approved_facts` | `true` (`0001:193`) | `is_member(workspace_id)` | `has_role(..., ['manager','admin'])` | `has_role(..., ['manager','admin'])` | **REVOKED** | **Gap:** Allows ReDoS-prone regex in `match_pattern` (`ai-service` only checks `len <= 300`, not catastrophic backtracking, though trusted to `manager`/`admin`). |
| `7` | `public.terminology` | `true` (`0001:193`) | `is_member(workspace_id)` | `has_role(..., ['manager','admin'])` | `has_role(..., ['manager','admin'])` | **REVOKED** | Safe (`re.escape` used in Python). |
| `8` | `public.documents` | `true` (`0001:193`) | `is_member(workspace_id)` | `created_by = auth.uid()` & member role | `created_by = (select auth.uid())` OR `manager`/`admin` + trigger locking `workspace_id`, `created_by` | **REVOKED** | **P1 Immutability Bypass (`[DEF-14]`):** `0002` locks ONLY `workspace_id` and `created_by`. Any `creator` (author) can issue a direct PostgREST `PATCH /rest/v1/documents` to flip `status` from `'draft'`/`'in_review'` to **`'reviewed'`** (bypassing `approver` authority!) OR mutate **`content`** after findings are persisted, silently invalidating every finding's `start_offset`/`end_offset`! Also missing `char_length(btrim(title)) <= 200` DB CHECK. |
| `9` | `public.review_runs` | `true` (`0001:193`) | `is_member(workspace_id)` | *Denied* (service-role only) | *Denied* | **REVOKED** | **Missing Partial Unique Index (`[DEF-15]`):** Allows concurrent `'running'` rows under race conditions without `UNIQUE (document_id) WHERE status = 'running'`. Also lacks `(workspace_id, document_id)` composite FK. |
| `10` | `public.findings` | `true` (`0001:193`) | `is_member(workspace_id)` | *Denied* (service-role only) | *Denied* | **REVOKED** | Missing DB CHECKs (`start_offset >= 0 AND end_offset > start_offset`, `confidence >= 0 AND confidence <= 1`). `ai_detail` not stored on table (stored in `audit_events.metadata` instead). |
| `11` | `public.suggestions` | `true` (`0001:193`) | `is_member(workspace_id)` | *Denied* (service-role only) | *Denied* | **REVOKED** | Client cannot directly `UPDATE suggestions.status` (good), updated server-side by `admin` in `decision/route.ts` — creating the **P1 desync window** (`[DEF-15]`). |
| `12` | `public.review_decisions` | `true` (`0001:193`) | `is_member(workspace_id)` | `reviewer_id = auth.uid()`, `has_role(['approver','manager','admin'])`, `s.workspace_id = workspace_id`, `suggestion_id UNIQUE` | *Denied* (immutable) | **REVOKED** | Role & duplicate enforcement is strong in DB! **Gaps:** No DB CHECK enforcing non-blank `edited_text` when `decision = 'edited'` or non-blank `comment` when `decision = 'rejected'`; **`decision_rls.sql` not yet executed (`USER-RUN`)**; `review_decisions_select` still works cleanly under `is_member`. |
| `13` | `public.comments` | `true` (`0001:193`) | `is_member(workspace_id)` | `user_id = auth.uid()` & `is_member(workspace_id)` | *Denied* | **REVOKED** | **Dead Surface + Cross-WS FK Gap (`[DEF-14]` / `[DEF-23]`):** Zero UI/API uses this table, yet `authenticated` users can PostgREST-`INSERT` rows referencing any `document_id` (lacks composite FK `(workspace_id, document_id)`). |
| `14` | `public.audit_events` | `true` (`0001:193`) | `is_member(workspace_id)` | **`audit_insert` STILL ACTIVE (`0001:235`)** until `0003` applied! | *Denied* | **REVOKED** | **Open Audit Integrity Gap (`[DEF-14]` / `USER-RUN`):** Any workspace member (including `creator`) can currently forge arbitrary `audit_events` rows (`action: 'document.reviewed'`) via direct PostgREST `INSERT` using the browser anon key + JWT until `supabase/migrations/0003_audit_server_only.sql` is applied post-test. |

---

## 2. SECURITY DEFINER Functions & Search Path Audit

- `public.is_member(ws uuid)` (`0002_rls_hardening.sql:18-30`): `LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public`, uses `(select auth.uid())`, granted to `authenticated, service_role`. Wait — notice `anon` was **not** explicitly revoked on `EXECUTE` (Supabase default schema ACL often grants `EXECUTE` on new public functions to `PUBLIC`, though `anon` cannot run table SELECT policies granted `TO authenticated` and `auth.uid()` is `NULL` for `anon`). **Hardening recommendation:** add `REVOKE ALL ON FUNCTION public.is_member(uuid), public.has_role(uuid, text[]) FROM PUBLIC;` so unauthenticated `anon` cannot probe `is_member(uuid)` directly via RPC.
- `public.has_role(ws uuid, roles text[])` (`0002_rls_hardening.sql:32-45`): `SECURITY DEFINER SET search_path = public`, uses `(select auth.uid())`. Same `PUBLIC` RPC execute note applies.
- `public.enforce_documents_immutable_columns()` (`0002_rls_hardening.sql:50-74`): `SET search_path = public`, `BEFORE UPDATE` trigger raises `42501` if `workspace_id` or `created_by` changes. Needs extension to lock `status` and `content` against non-`service_role` modifications (`[DEF-14]`).

---

## 3. Client / Browser Secret Exposure & Auth Isolation Checks

| Security Control | Method / Evidence | Empirical Result | Status |
| --- | --- | --- | --- |
| **Tracked `.env*` secrets in Git** | `git ls-files ".env*" "**/.env*"` | Returns `ai-service/.env.example`, `web/.env.example` ONLY (`.gitignore` excludes `.env*`). | **PASS** |
| **Compiled Next.js Client Bundle Secret Scan** | `audit_wcag_and_contracts.py` (`SUPABASE_SERVICE_ROLE_KEY`, `AI_SERVICE_TOKEN`, `DEMO_PASSWORD`, `GROQ_API_KEY`, `AI_SERVICE_URL`, `gsk_*`, `service_role`) | **`39` JS files scanned under `web/.next/static/**/*.js` -> `0` hits**. | **PASS** |
| **`server-only` Boundary Enforcement** | `web/lib/env.ts:1`, `web/lib/supabase/admin.ts:1`, `web/lib/workspace.ts:1`, `web/lib/profiles.ts:1` | All import `'server-only'`; client components never import `admin.ts` or `env.ts`. | **PASS** |
| **Internal AI Service Token Verification** | `ai-service/main.py:356-360, 375` + `audit_phase3.py` | `Depends(require_key)` runs `hmac.compare_digest` **before** FastAPI parses JSON (`401` on `{}` & invalid key). | **PASS** |
| **Client Audit Log Isolation in `web/`** | `git grep -n "audit_events" web/` | Only server pages read `audit_events`; all `3` inserts (`review/route.ts:365`, `decision/route.ts:207, 303`) use `createAdminClient()`. | **PASS** (DB lock awaits `0003` **`USER-RUN`**) |
| **XSS / URL Scheme Hygiene** | `knowledge-tabs.tsx:45-55` + React text rendering | `isSafeHttpUrl()` rejects `javascript:` URLs in `approved_facts.source_url`; zero `dangerouslySetInnerHTML` in codebase. | **PASS** |

---

## 4. HTTP Security Headers & CORS Inspection (`:3105` & FastAPI)

Verified directly on local production build (`task-2158`) and FastAPI (`audit_phase3.py`):
- **`x-powered-by`:** `null` (`poweredByHeader: false` verified).
- **`Content-Security-Policy`:** `default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co` (**Note:** production CSP removes `'unsafe-eval'` and localhost WS; retains `'unsafe-inline'` for Next.js inline hydration/Tailwind).
- **`X-Frame-Options`:** `DENY`
- **`X-Content-Type-Options`:** `nosniff`
- **`Referrer-Policy`:** `strict-origin-when-cross-origin`
- **`Permissions-Policy`:** `camera=(), microphone=(), geolocation=()`
- **`Strict-Transport-Security`:** `null` on local HTTP `:3105` (Vercel terminates TLS and adds HSTS on HTTPS edge; not configured in `next.config.mjs`).
- **CORS Preflight (`OPTIONS`):**
  - `OPTIONS http://127.0.0.1:3105/api/review` -> `HTTP 204`, `access-control-allow-origin: null` (default same-origin Next.js behavior — safe).
  - `OPTIONS /review` on FastAPI (`audit_phase3.py`) -> `HTTP 405`, `access-control-allow-origin: null` (intended: FastAPI is strictly server-to-server behind `x-api-key`, never browser-called).

---

## 5. Dependency Advisories (`[DEF-09]`) & Rate-Limit Posture

- **`pnpm --dir web audit --json`:** `exit 1` — `4` advisories (`2 moderate`, `2 high`, `0 critical`) on `next@15.5.29 > postcss@8.4.31` (`<= 8.5.22`, CWE-22/CWE-79/CWE-200). Build/server exposure is minimal in a statically bundled PostCSS CSS build step, but should be patched via `pnpm.overrides` or Next upgrade cleanly under Tier B `[DEF-09]`.
- **Application Rate Limiting:** None on `POST /api/review` (triggers paid/rate-limited Groq calls), `POST /api/documents`, `POST /api/suggestions/[id]/decision`, or `signInWithDemoAction`. Mitigated partially by authenticated cookie requirement on API routes (exception: `signInWithDemoAction` on `/login` relies on Supabase Auth IP rate limiting).

---

## 6. Verdict (Phase 4)

- **Secret Isolation, Security Headers, Service-Role Boundary & Existing Cross-Workspace `SELECT` RLS (`rls_checks.sql` `7/7`):** **`PASS`**.
- **Document Post-Review Immutability, Audit Forge Lock (`0003`), Decision RLS Proof (`decision_rls.sql`), & Cross-WS FK Integrity:** **`FAIL` / `USER-RUN`** (`[DEF-14]` must be resolved or mitigated by applying `0003_audit_server_only.sql` + running `decision_rls.sql` + approving post-review `documents` lock before treating the DB as production-hardened).

