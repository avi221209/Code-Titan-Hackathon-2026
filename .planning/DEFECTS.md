# BrandGuardian — Defect Log (QA-Fix & Reliability Remediation Register)

**Last Updated:** 2026-11-10T09:40:00+05:30  
**Base Commit:** `03a9c96c32f067936c632c779a60681923a86afe` (`main`, `brandguardian/`, uncommitted working tree ready for review)  
**Strict Classification Legend:** **`FIXED`** · **`BLOCKED`** · **`USER-RUN`** · **`DEFERRED`** · **`OPEN`**

---

## Summary Status Table (`[DEF-01]` – `[DEF-23]`)

| ID | Severity | Title & Scope | Status | Primary Evidence / Artifact |
| --- | --- | --- | --- | --- |
| **`[DEF-01]`** | `P1` | Root `/` copy & `<h1>` landmark | **`FIXED`** | Committed `f6b890c` (updated again for M2–M3 copy in `[DEF-22]`) |
| **`[DEF-02]`** | `P1` | `/documents/[id]/history` auth, UUID check, `<h1>`, nav | **`FIXED`** | Committed `9d0d94f` (soft-404 side effect resolved in `[DEF-12]`) |
| **`[DEF-03]`** | `P1` | `error.tsx` raw `error.message` & missing `<h1>` | **`FIXED`** | Committed `eee77d0`; verified `0` `error.message` hits in UI/app |
| **`[DEF-04]`** | `P2` | Route loading states & `<title>` metadata | **`FIXED`** | Committed `3cf731c` (`loading.tsx` scoping fixed in `[DEF-12]`) |
| **`[DEF-05]`** | `P1` | Security headers & CSP (`next.config.mjs`) | **`FIXED`** | Committed `a665b88`; `security.test.mjs` & header probe pass |
| **`[DEF-06]`** | `P2` | Stale M0 documentation sync | **`FIXED`** | Committed `4f31de7` |
| **`[DEF-07]`** | `P2` | `POST /api/documents` pre-validation & NUL byte guard | **`FIXED`** | Committed `09367e8`; `400` in `254–319 ms` |
| **`[DEF-08]`** | `P2` | FastAPI `Depends(require_key)` `401` before `422` | **`FIXED`** | Committed `3727052`; `pytest` test 12 passes |
| **`[DEF-09]`** | `P2` | ESLint script/config & `pnpm audit` `postcss`/`minimatch` advisories | **`FIXED`** | `web/package.json`, `web/.eslintrc.json`, `web/pnpm-workspace.yaml`; `pnpm lint` (`0` warnings/errors), `pnpm audit --json` (`exit 0`, **`0` advisories**) |
| **`[DEF-10]`** | `P1` | Initial RLS hardening (`0002_rls_hardening.sql`) | **`FIXED`** | Committed `1db160f`; applied & verified `7/7` (`cases a–g`) by Project Owner (`USER-RUN`) |
| **`[DEF-11]`** | `P1` | Protected SSR double `auth.getUser()` latency | **`FIXED`** | `web/lib/supabase/claims.ts`, `middleware.ts`, `workspace.ts`, `login/page.tsx`; Playwright `:3106` initial redirect `6472.2 ms -> 1600.2 ms`, `/dashboard` median `2143.7 ms -> 1351.5 ms` |
| **`[DEF-12]`** | `P2` | Streaming `loading.tsx` `HTTP 200` soft-404 status | **`FIXED`** | Deleted `(app)/loading.tsx`, `(app)/documents/[id]/loading.tsx`, `(app)/documents/[id]/history/loading.tsx`; all 4 invalid/missing UUID probes return **`HTTP 404`** |
| **`[DEF-13]`** | `P2` | M1 docs lag after M2/M3 shipped | **`FIXED`** | Committed prior QA round (`docs/` synced further in `[DEF-22]`) |
| **`[DEF-14]`** | **`P1`** | Post-review `documents` immutability, `0003` audit lock, composite WS FKs, `PUBLIC`/`anon` revoke | **`USER-RUN`** | **Code & SQL complete in working tree:** `supabase/migrations/0003_audit_server_only.sql` & `0004_remediation_integrity_and_rpc.sql` + `remediation_checks.sql`; awaits manual Supabase SQL Editor execution |
| **`[DEF-15]`** | **`P1`** | Transactional `record_review_decision` RPC & `uq_review_runs_one_running` guard | **`USER-RUN`** | **App & SQL complete in working tree:** `web/lib/server/{decision,review}-workflow.ts` (unit-tested `3/3` & `3/3`), `0004_remediation_integrity_and_rpc.sql`; awaits manual `0004` SQL Editor apply before live M3 writes |
| **`[DEF-16]`** | **`P1`** | UTF-16 offset alignment, duplicate LLM quote cursor & ambiguity-safe preview edit | **`FIXED`** | `ai-service/main.py` (`build_utf16_index_map`, `cursor_by_quote`), `web/lib/validators/{review,decision}.ts`; `pytest 19/19`, `web test 34/34`, `verify_ai_trust_after.py` (`[[0, 9], [10, 19]]` distinct) |
| **`[DEF-17]`** | **`P1`** | Semantic `verify()` rule checks, date/status filters & active Facts/Terms LLM context | **`FIXED`** | `ai-service/main.py` (`verify()`, `build_user_prompt()`), `review-workflow.ts`; `verify_ai_trust_after.py` (`poisoned -> unverified`), `review-workflow.test.ts` *(live Groq accuracy remains `USER-RUN`)* |
| **`[DEF-18]`** | **`P1`** | Evidence gate on **Edit**, `edited` / `suggested_text === null` parity, bounded confidence, `dropped` truncation & DB `CHECK`s | **`FIXED`** | `canAcceptOrEditFinding()`, `document-review-workspace.tsx`, `validateDecisionInput()`, `ai-service/main.py` (`ge=0, le=1`, `dropped += max(0, len-5)`); SQL `CHECK`s included in `0004` (`USER-RUN` DB activation) |
| **`[DEF-19]`** | `P2` | Sanitized upstream Python errors, `/ready` (`200`/`503`), 5-key `/api/health?probe=1` | **`FIXED`** | `format_llm_unavailable_detail()`, `/ready`, `AiStatusBanner`, `health-workflow.ts`; `verify_phase6.py` (`6/6` mock-HTTP checks) & `:3106` `/api/health?probe=1` |
| **`[DEF-20]`** | `P2` | Structured redacting logs, rate limiters & cloud hosting timeout/warm-up readiness | **`USER-RUN`** | **App logging/rate-limits `FIXED` in code:** `logger.ts`, `rate-limit.ts` wired into `review`, `decision`, `documents`, `login/actions`. **Cloud Vercel `60s` Fluid Compute, Render/Railway warm-up & Docker build/run remain `USER-RUN`** |
| **`[DEF-21]`** | `P2` | WCAG 1.4.11 border contrast, `<SkipLink />`, non-nested card focus, `Textarea` invalid border, Reject validation | **`FIXED`** | `globals.css` (`#888378` light / `#6C7482` dark `>= 3.20:1`), `skip-link.tsx`, `app-shell.tsx`, `page.tsx`, `login/page.tsx`, `not-found.tsx`, `error.tsx`, `textarea.tsx`, `document-review-workspace.tsx`; `accessibility.test.ts` (`2/2`) & `24/24` Playwright checks (`#main-content` Tab) |
| **`[DEF-22]`** | `P2` | Stale M2–M3 UI/doc copy, `GROQ_URL` `.env.example`, `/knowledge` guideline status, `"best practices"` FP | **`FIXED`** | `page.tsx`, `new-document-form.tsx`, `ai-service/.env.example`, `knowledge/page.tsx`, `seed.sql` & `0004`, `README.md` & `docs/*`; `verify_ai_trust_after.py` (`100%` det precision, `best_practices_fp: false`) |
| **`[DEF-23]`** | `P3` | Dead UI code (`Dialog`, `toast`, `sonner`) & vestigial schema columns | **`FIXED`** | Removed `web/components/ui/{dialog,toast}.tsx`, `<Toaster />`, `sonner`; added composite FK `fk_comments_ws_doc` to `0004`; retained `comments` / `documents.version` / `.dark` tokens non-destructively |

---

## Detailed Remediation Notes (`[DEF-09]`, `[DEF-11]`, `[DEF-12]`, `[DEF-14]`–`[DEF-23]`)

### `[DEF-09]` — Missing ESLint script/config & transitive `postcss` / `minimatch` advisories
- **Status:** `FIXED`
- **Changes:** Added `"lint": "next lint"`, adjusted `"test"` glob to run `lib/validators/*.test.* lib/server/*.test.* lib/supabase/*.test.*`, added `eslint@9.39.5` & `eslint-config-next@15.5.29` in `web/package.json`, added `web/.eslintrc.json`, added `void _prevState;` in `web/app/(auth)/login/actions.ts`, and created `web/pnpm-workspace.yaml` with `overrides: { postcss: '>=8.5.23', 'minimatch@^10.0.0': '>=11.0.1' }`.
- **Verification:** `pnpm --dir web lint` -> `✔ No ESLint warnings or errors`; `pnpm --dir web audit --json` -> `exit 0`, `0` advisories across 419 packages; isolated clean-env build resolved `postcss 8.5.32`.

### `[DEF-11]` — Protected SSR latency from redundant `auth.getUser()` calls
- **Status:** `FIXED`
- **Changes:** Added [`web/lib/supabase/claims.ts`](../web/lib/supabase/claims.ts) (`getCachedPublicJwks` with 10-minute bounded in-memory cache + `inFlight` dedupe, `getVerifiedClaimsUser` via `@supabase/auth-js` `getClaims(undefined, { jwks })` with automatic HS256 `getUser()` fallback). Switched [`web/middleware.ts`](../web/middleware.ts), [`web/lib/workspace.ts`](../web/lib/workspace.ts), and [`web/app/(auth)/login/page.tsx`](../web/app/%28auth%29/login/page.tsx) to `getVerifiedClaimsUser()` while retaining strict `auth.getUser()` on API routes (`api/documents/route.ts`, `review-workflow.ts`, `decision-workflow.ts`).
- **Verification:** `claims.test.ts` (`4/4` pass); Playwright `:3106` BEFORE (`6472.2 ms` login redirect, `/dashboard` `5x` median `2143.7 ms`, max `5046.5 ms`) -> AFTER (`1600.2 ms` login redirect, `/dashboard` `5x` median `1351.5 ms`, max `1790.3 ms`).

### `[DEF-12]` — Streaming `loading.tsx` flushes `HTTP 200` soft-404 status
- **Status:** `FIXED`
- **Changes:** Deleted `web/app/(app)/loading.tsx`, `web/app/(app)/documents/[id]/loading.tsx`, and `web/app/(app)/documents/[id]/history/loading.tsx`; kept leaf `loading.tsx` skeletons on `/dashboard`, `/knowledge`, and `/documents/new`.
- **Verification:** `claims.test.ts` (`3rd` assertion) + Playwright `:3106` BEFORE (`200` across all 4 bad/missing UUIDs) -> AFTER (**`HTTP 404`** across `/documents/not-a-uuid`, `/documents/not-a-uuid/history`, `/documents/00000000-0000-0000-0000-000000000000`, and `.../history`).

### `[DEF-14]` — Post-review `documents` immutability, `0003` audit lock, composite FKs & helper RPC ACLs
- **Status:** `USER-RUN` *(Code & SQL Complete — Awaiting Manual Execution in Supabase SQL Editor)*
- **Changes:** Created idempotent [`supabase/migrations/0004_remediation_integrity_and_rpc.sql`](../supabase/migrations/0004_remediation_integrity_and_rpc.sql) revoking `EXECUTE` on `is_member` & `has_role` from `PUBLIC, anon`, tightening `documents_insert` (`status = 'draft'`), extending `enforce_documents_immutable_columns()` to block non-`service_role` mutations of `documents.status` and post-review `title`/`content`, adding composite workspace FKs (`fk_guideline_rules_ws_guideline`, `fk_review_runs_ws_doc`, `fk_comments_ws_doc`), and adding `remediation_checks.sql` (`cases h–o`). `0003_audit_server_only.sql` & `decision_rls.sql` remain ready.
- **Verification:** Static SQL check clean (`dollars=8, parens_diff=0`); live DB verification awaits Project Owner SQL Editor run (`USER-RUN`).

### `[DEF-15]` — Transactional `record_review_decision` RPC & `review_runs` partial unique concurrency guard
- **Status:** `USER-RUN` *(App & SQL Complete — Awaiting Manual `0004` Execution in Supabase SQL Editor)*
- **Changes:** Added `uq_review_runs_one_running` (`WHERE status = 'running'`) and transactional `SECURITY DEFINER` `public.record_review_decision(...)` RPC in `0004`; extracted pure testable workflows [`web/lib/server/decision-workflow.ts`](../web/lib/server/decision-workflow.ts) (`503` guidance if `0004` unapplied, `42501`/`23505`/`P0002`/`22023` mapping) and [`web/lib/server/review-workflow.ts`](../web/lib/server/review-workflow.ts) (handles `23505` -> `409`, checks cleanup/status/audit errors explicitly).
- **Verification:** `decision-workflow.test.ts` (`3/3`), `review-workflow.test.ts` (`3/3`); live RPC execution awaits `0004` apply (`USER-RUN`).

### `[DEF-16]` — UTF-16 offset alignment, duplicate LLM quote cursor & ambiguity-safe preview replacements
- **Status:** `FIXED`
- **Changes:** `ai-service/main.py` computes UTF-16 code-unit offsets (`build_utf16_index_map` + `utf16_index_to_cp_map`) and tracks per-quote occurrences via `cursor_by_quote`; `resolveHighlightSpan()` in [`web/lib/validators/review.ts`](../web/lib/validators/review.ts) and [`applyAcceptedEditsToDocument()`](../web/lib/validators/decision.ts) use surrogate-pair-bounded disambiguation and refuse ambiguous fallback edits (`skippedUnmatchedCount`).
- **Verification:** `pytest` (`test_utf16_offsets_match_js_across_unicode_and_emojis`, `test_llm_duplicate_quotes_map_to_distinct_occurrences`), `review.test.ts`, `decision.test.ts`, and `verify_ai_trust_after.py` (`duplicate_llm_offsets: [[0, 9], [10, 19]]`).

### `[DEF-17]` — Semantic `verify()` rule checks, date/status filters & active Facts/Terms LLM context
- **Status:** `FIXED` *(Code & Synthetic Harness `FIXED`; Live Groq evaluation `USER-RUN`)*
- **Changes:** `verify()` enforces matching `category` (`terminology`, `fact`, `guideline_rule`) and non-escalated severity (`SEV_ORDER[f.severity] >= SEV_ORDER[rule.severity]`); `review-workflow.ts` filters `approved_facts` by today's UTC `valid_from`/`valid_until` window and joins `guidelines!inner(status)` on `'approved'`; `build_user_prompt()` supplies compact `APPROVED FACTS` & `APPROVED TERMINOLOGY`.
- **Verification:** `pytest` (`test_verify_enforces_rule_category_and_severity_semantics`, `test_prompt_includes_active_facts_and_terminology_without_breaking_escape`), `review-workflow.test.ts`, and `verify_ai_trust_after.py` (`poisoned_rule_verification_status: "unverified"`).

### `[DEF-18]` — Evidence gate on **Edit**, `edited` / `suggested_text === null` parity, bounded confidence & DB `CHECK`s
- **Status:** `FIXED` *(UI/App/Python `FIXED`; `0004` SQL `CHECK`s await `USER-RUN` apply)*
- **Changes:** [`canAcceptOrEditFinding()`](../web/lib/validators/decision.ts) enforces `isHighOrCritical && !evidenceWasOpened` and `suggestedText !== null` on both **Accept** and **Edit** in [`document-review-workspace.tsx`](../web/components/document-review-workspace.tsx); `0004` + `record_review_decision` enforce `suggested_text IS NOT NULL`, `documents.title` length, non-blank content, `findings` offsets/confidence, and conditional `review_decisions` columns; `ai-service/main.py` enforces `Field(default=0.5, ge=0.0, le=1.0)` and adds excess truncated LLM items past top 5 into `dropped`.
- **Verification:** `decision.test.ts` (`6/6`), `pytest` (`test_run_llm_truncation_increments_dropped_and_confidence_bounded`), `verify_ai_trust_after.py` (`truncation_dropped_count: 1`).

### `[DEF-19]` — Sanitized upstream errors, `/ready` (`200`/`503`) & 5-key `/api/health?probe=1`
- **Status:** `FIXED`
- **Changes:** Added `format_llm_unavailable_detail()` & `/ready` (`200`/`503`) + `token_configured` in `/health` (`ai-service/main.py`), defensive `RAW_PYTHON_EXCEPTION_NAMES` fallback in `AiStatusBanner`, and `executeHealthCheck()` (`web/lib/server/health-workflow.ts` + `web/app/api/health/route.ts`) validating all 5 required keys and optional `?probe=1` upstream check.
- **Verification:** `verify_phase6.py` (`6/6` mock-HTTP assertions), `health-workflow.test.ts` (`2/2`), `:3106` `/api/health` & `/api/health?probe=1` (`503`).

### `[DEF-20]` — Structured logs, rate limiters & cloud hosting timeout/warm-up readiness
- **Status:** `USER-RUN` *(Logging & Rate Limiting `FIXED` in Code; Cloud Timeout, Render/Railway Warm-Up & Docker Build `USER-RUN`)*
- **Changes:** Added redacting structured JSON logger (`web/lib/server/logger.ts`) and in-memory fixed-window rate limiters (`web/lib/server/rate-limit.ts`) in `review-workflow.ts`, `decision-workflow.ts`, `api/documents/route.ts`, and `login/actions.ts`.
- **Remaining:** Verify Vercel `60s` Fluid Compute/Pro timeout, build `ai-service/Dockerfile`, warm `<AI_URL>/ready`, and test `<WEB_URL>` incognito (`USER-RUN`).

### `[DEF-21]` — UI contrast, `<SkipLink />`, non-nested focus, `Textarea` border, collapsed copy & Reject validation
- **Status:** `FIXED`
- **Changes:** Updated `--border-subtle` (`#888378` light `>= 3.20:1`, `#6C7482` dark `>= 3.21:1`) in `globals.css`; added `<SkipLink />` + `<main id="main-content" tabIndex={-1}>` across `app-shell.tsx`, `page.tsx`, `login/page.tsx`, `not-found.tsx`, `error.tsx`; replaced nested `<article tabIndex={0}>` with `#N` `<button>` + `onFocusCapture`; added `aria-[invalid=true]:border-destructive` in `textarea.tsx`; corrected collapsed text for Medium/Low; validated non-blank Reject input locally before `fetch`.
- **Verification:** `accessibility.test.ts` (`2/2`), `verify_playwright_4vp_after.py` (`24/24` viewport checks pass, `skip_link_first_tab_href: "#main-content"`, `reduced_motion_duration: "1e-05s"`).

### `[DEF-22]` — Copy/doc drift, `GROQ_URL`, `/knowledge` parent status & `"best practices"` FP
- **Status:** `FIXED`
- **Changes:** Removed stale M2–M3 text from `page.tsx` & `new-document-form.tsx`; added `GROQ_URL` to `ai-service/.env.example`; joined `guidelines.status` in `/knowledge`; updated `seed.sql` & `0004` with `best(?!\s+practices\b)`; updated `README.md` & `docs/*`.
- **Verification:** `verify_ai_trust_after.py` (`100%` det precision, `best_practices_fp: false`), `pytest` (`test_best_practices_pattern_ignores_benign_phrase`), Playwright stale-copy scan `false` across all routes.

### `[DEF-23]` — Dead UI code & vestigial DB columns
- **Status:** `FIXED`
- **Changes:** Deleted unused `web/components/ui/dialog.tsx` & `toast.tsx`, removed `<Toaster />` from `web/app/layout.tsx`, removed unused `sonner` dependency; retained `public.comments` (added `fk_comments_ws_doc` in `0004`), `documents.version`, and WCAG-fixed `.dark` tokens non-destructively.
- **Verification:** `git grep` confirms `0` imports of deleted components or `sonner`; `pnpm lint` & `next build` exit `0`.
