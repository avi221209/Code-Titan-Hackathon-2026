# BrandGuardian — Remediation Working-Tree Diff Summary

**Generated:** `2026-11-10` (IST)  
**Repository:** `avi221209/Code-Titan-Hackathon-2026` (`E:\Plugins\Get Shit Done\Code Titan 2026\brandguardian`)  
**Base Commit (`HEAD`, Untouched):** `03a9c96c32f067936c632c779a60681923a86afe` (`main`)

All remediation edits remain uncommitted in the local working tree for Project Owner review. Zero `.env*` secret files were modified, staged, or inspected.

---

## 1. How to Inspect the Full Unified Patch Locally

```powershell
cd "E:\Plugins\Get Shit Done\Code Titan 2026\brandguardian"

# Summary status and line statistics relative to HEAD (03a9c96)
git status --short
git diff --stat

# Review code & SQL diffs (excluding web/pnpm-lock.yaml noise)
git diff -- ai-service/ supabase/ docs/ README.md web/app/ web/components/ web/lib/ web/middleware.ts web/package.json

# Read newly added untracked SQL, TypeScript modules, and tests
Get-Content supabase/migrations/0004_remediation_integrity_and_rpc.sql
Get-Content supabase/tests/remediation_checks.sql
Get-ChildItem web/lib/server, web/lib/supabase, web/components/skip-link.tsx, web/.eslintrc.json, web/pnpm-workspace.yaml
```

---

## 2. Pre-Existing Working-Tree Files Preserved (`Before Remediation`)

As captured in [`.planning/REMEDIATION_BASELINE.md`](REMEDIATION_BASELINE.md), these uncommitted files already existed on `03a9c96` before remediation edits began and were **not reverted**:
- **Preserved `1`-line EOF/newline diffs (`8` tracked files):**
  - [`.planning/AUTONOMOUS_REPORT.md`](AUTONOMOUS_REPORT.md) (`+1/-0`), [`.planning/AUTONOMOUS_REPORT_2.md`](AUTONOMOUS_REPORT_2.md) (`+1/-0`), [`.planning/PUSH_REPORT.md`](PUSH_REPORT.md) (`+1/-0`), [`ai-service/.dockerignore`](../ai-service/.dockerignore) (`+1/-0`), [`docs/contributions.md`](../docs/contributions.md) (`+1/-0`), [`supabase/migrations/0003_audit_server_only.sql`](../supabase/migrations/0003_audit_server_only.sql) (`+1/-0`), [`supabase/tests/decision_rls.sql`](../supabase/tests/decision_rls.sql) (`+1/-0`), [`web/lib/profiles.ts`](../web/lib/profiles.ts) (`+1/-0`).
- **Pre-existing uncommitted audit baselines (`5` untracked `.planning/` files preserved + topped with Post-Remediation Update banners):**
  - [`.planning/RELIABILITY_AUDIT.md`](RELIABILITY_AUDIT.md), [`.planning/AI_TRUST_AUDIT.md`](AI_TRUST_AUDIT.md), [`.planning/API_FAILURE_MATRIX.md`](API_FAILURE_MATRIX.md), [`.planning/SECURITY_AUDIT.md`](SECURITY_AUDIT.md), [`.planning/DEPLOYMENT_READINESS.md`](DEPLOYMENT_READINESS.md).

---

## 3. Remediation Code, SQL, Test & Config Inventory

### 3A. Database Migrations, Seeds & SQL Tests (`supabase/`)
| State | File | Diff / Purpose (`[DEF-ID]`) |
| --- | --- | --- |
| **Added** | [`supabase/migrations/0004_remediation_integrity_and_rpc.sql`](../supabase/migrations/0004_remediation_integrity_and_rpc.sql) | Idempotent migration (`391` lines, unapplied / `USER-RUN`): `REVOKE` on `is_member`/`has_role`/`record_review_decision`, `documents_insert` requires `status='draft'`, `enforce_documents_immutable_columns()` locks `status` & post-review `title`/`content`, composite workspace FKs (`guideline_rules`, `review_runs`, `comments`), `NOT VALID` `CHECK`s, `uq_review_runs_one_running`, transactional `record_review_decision(...)` RPC, `"best practices"` pattern fix, rollback footer (`[DEF-14]`, `[DEF-15]`, `[DEF-18]`, `[DEF-22]`). |
| **Added** | [`supabase/tests/remediation_checks.sql`](../supabase/tests/remediation_checks.sql) | `begin`/`rollback` impersonation test suite (`428` lines, `cases h–o`, unapplied / `USER-RUN`) covering `documents.status` lock, post-review `content` lock, insert `status='draft'` policy, cross-WS composite FK `23503`, concurrent `review_runs` `23505`, `record_review_decision` role/null/`23505`/atomic transitions, and `anon` RPC privilege checks (`[DEF-14]`, `[DEF-15]`). |
| **Modified** | [`supabase/seed.sql`](../supabase/seed.sql) | `+1/-1` — Tightened seeded superlative regex with negative lookahead `best(?!\s+practices\b)` (`[DEF-22]`). |

### 3B. Python AI Microservice (`ai-service/`)
| State | File | Diff / Purpose (`[DEF-ID]`) |
| --- | --- | --- |
| **Modified** | [`ai-service/main.py`](../ai-service/main.py) | `+242/-57` — UTF-16 code-unit index map (`build_utf16_index_map`, `utf16_index_to_cp_map`), `Finding.confidence` `Field(ge=0.0, le=1.0)`, `cursor_by_quote` duplicate LLM quote tracking, `truncated_count` counted in `dropped`, semantic `verify()` (`category` + non-escalated `SEV_ORDER`), `APPROVED FACTS` + `APPROVED TERMINOLOGY` in `build_user_prompt()`, `GET /ready` (`200`/`503`) + `token_configured` in `/health`, sanitized `format_llm_unavailable_detail()` (`[DEF-16]`–`[DEF-19]`). |
| **Modified** | [`ai-service/test_checks.py`](../ai-service/test_checks.py) | `+221/-0` — Added 7 pytest tests (`12 -> 19`) for UTF-16 emojis/surrogates, duplicate LLM quotes, semantic `verify()`, prompt context + escaping, truncation `dropped` & `confidence` validation, `best practices` regex, `/ready`, and upstream error sanitization (`[DEF-16]`–`[DEF-19]`, `[DEF-22]`). |
| **Modified** | [`ai-service/.env.example`](../ai-service/.env.example) | `+1/-0` — Documented `GROQ_URL=https://api.groq.com/openai/v1/chat/completions` (`[DEF-22]`). |

### 3C. Web Auth, SSR Performance & Server Workflows (`web/`)
| State | File | Diff / Purpose (`[DEF-ID]`) |
| --- | --- | --- |
| **Added** | [`web/lib/supabase/claims.ts`](../web/lib/supabase/claims.ts) | `getCachedPublicJwks()` (`10 min` bounded TTL + in-flight dedupe) and `getVerifiedClaimsUser()` via `@supabase/auth-js` `getClaims()` (`[DEF-11]`). |
| **Added** | [`web/lib/supabase/claims.test.ts`](../web/lib/supabase/claims.test.ts) | `4` tests covering `getClaims()` verification, JWKS caching/degradation, `loading.tsx` removals (`[DEF-12]`), and SSR vs mutating-API auth boundaries (`[DEF-11]`). |
| **Modified** | [`web/middleware.ts`](../web/middleware.ts), [`web/lib/workspace.ts`](../web/lib/workspace.ts), [`web/app/(auth)/login/page.tsx`](../web/app/%28auth%29/login/page.tsx) | Switched SSR auth checks to `getCachedPublicJwks()` + `getVerifiedClaimsUser()` (`login/page.tsx` also added `<SkipLink />` + `#main-content`) (`[DEF-11]`, `[DEF-21]`). |
| **Deleted** | `web/app/(app)/loading.tsx`, `web/app/(app)/documents/[id]/loading.tsx`, `web/app/(app)/documents/[id]/history/loading.tsx` | Removed `-81` lines across the 3 streaming boundaries covering dynamic `[id]` routes so `notFound()` returns true `HTTP 404` (`[DEF-12]`). |
| **Added** | [`web/lib/server/logger.ts`](../web/lib/server/logger.ts), [`web/lib/server/rate-limit.ts`](../web/lib/server/rate-limit.ts) | Structured redacting JSON logger (`SENSITIVE_KEY_PATTERN`) and bounded in-memory `FixedWindowRateLimiter` (`[DEF-20]`). |
| **Added** | [`web/lib/server/decision-workflow.ts`](../web/lib/server/decision-workflow.ts), [`decision-workflow.test.ts`](../web/lib/server/decision-workflow.test.ts) | Atomic `record_review_decision` RPC orchestration, `42501`/`23505`/`P0002`/`22023`/`503` mapping, rate limit `429`, structured logs + `3` unit tests (`[DEF-15]`, `[DEF-18]`, `[DEF-20]`). |
| **Added** | [`web/lib/server/review-workflow.ts`](../web/lib/server/review-workflow.ts), [`review-workflow.test.ts`](../web/lib/server/review-workflow.test.ts) | UTC date-bounded `approved_facts`, `guidelines!inner(status='approved')`, `23505 -> 409` concurrent guard, explicit cleanup/status/audit error checks, rate limit `429`, structured logs + `3` unit tests (`[DEF-15]`, `[DEF-17]`, `[DEF-20]`). |
| **Added** | [`web/lib/server/health-workflow.ts`](../web/lib/server/health-workflow.ts), [`health-workflow.test.ts`](../web/lib/server/health-workflow.test.ts) | Strict `AI_SERVICE_URL` + `AI_SERVICE_TOKEN` + `SUPABASE_SERVICE_ROLE_KEY` check + optional `?probe=1` upstream `/ready` probe (`200`/`503`) + `2` unit tests (`[DEF-19]`). |
| **Modified** | [`web/app/api/health/route.ts`](../web/app/api/health/route.ts), [`review/route.ts`](../web/app/api/review/route.ts), [`suggestions/[id]/decision/route.ts`](../web/app/api/suggestions/%5Bid%5D/decision/route.ts), [`documents/route.ts`](../web/app/api/documents/route.ts), [`login/actions.ts`](../web/app/%28auth%29/login/actions.ts) | Thin route delegation to `executeHealthCheck`, `executeReviewWorkflow`, `executeDecisionWorkflow`; added `documentWriteRateLimiter` + `authRateLimiter` + structured logging; fixed `void _prevState;` (`[DEF-09]`, `[DEF-15]`, `[DEF-19]`, `[DEF-20]`). |
| **Modified** | [`web/lib/validators/review.ts`](../web/lib/validators/review.ts), [`review.test.ts`](../web/lib/validators/review.test.ts), [`decision.ts`](../web/lib/validators/decision.ts), [`decision.test.ts`](../web/lib/validators/decision.test.ts) | Surrogate-aware disambiguation refusing ambiguous duplicate `indexOf` fallback (`resolveHighlightSpan`, `applyAcceptedEditsToDocument` + `skippedUnmatchedCount`), `canAcceptOrEditFinding()`, `suggested_text === null` contract + unit tests (`[DEF-16]`, `[DEF-18]`). |

### 3D. UI, Accessibility, Lint & Dependencies (`web/`)
| State | File | Diff / Purpose (`[DEF-ID]`) |
| --- | --- | --- |
| **Added** | [`web/components/skip-link.tsx`](../web/components/skip-link.tsx), [`web/lib/validators/accessibility.test.ts`](../web/lib/validators/accessibility.test.ts) | Accessible `<SkipLink />` component + automated contrast ratio & skip-link landmark verification (`2` tests) (`[DEF-21]`). |
| **Modified** | [`web/app/globals.css`](../web/app/globals.css) | `+2/-2` — `--border-subtle` updated to `#888378` (light >= 3.20:1) and `#6C7482` (dark >= 3.21:1) for WCAG 1.4.11 (`[DEF-21]`). |
| **Modified** | [`web/components/app-shell.tsx`](../web/components/app-shell.tsx), [`web/app/page.tsx`](../web/app/page.tsx), [`web/app/error.tsx`](../web/app/error.tsx), [`web/app/not-found.tsx`](../web/app/not-found.tsx) | Added `<SkipLink />` & `<main id="main-content" tabIndex={-1}>`; removed stale M2–M3 text from `page.tsx` (`[DEF-21]`, `[DEF-22]`). |
| **Modified** | [`web/components/document-review-workspace.tsx`](../web/components/document-review-workspace.tsx) | `+89/-32` — Client `validateDecisionInput()` blank guard, `skippedUnmatchedCount` preview notice, segment-derived `hasHighlight`, unified `acceptOrEditDisabled` (Evidence gate on **Accept** & **Edit**), `#N` `<button>` replacing `<article tabIndex={0}>`, corrected collapsed Medium/Low text, `aria-invalid`/`aria-describedby` (`[DEF-16]`, `[DEF-18]`, `[DEF-21]`). |
| **Modified** | [`web/components/ai-status-banner.tsx`](../web/components/ai-status-banner.tsx), [`new-document-form.tsx`](../web/components/new-document-form.tsx), [`ui/textarea.tsx`](../web/components/ui/textarea.tsx), [`knowledge/page.tsx`](../web/app/%28app%29/knowledge/page.tsx), [`layout.tsx`](../web/app/layout.tsx) | Raw Python exception fallback filter (`[DEF-19]`), stale M2 copy removal (`[DEF-22]`), `aria-[invalid=true]:border-destructive` + `motion-reduce:transition-none` (`[DEF-21]`), parent `guidelines.status` pill (`[DEF-22]`), removed `<Toaster />` (`[DEF-23]`). |
| **Deleted** | `web/components/ui/dialog.tsx`, `web/components/ui/toast.tsx` | Removed `-137` lines of unused UI modules (`[DEF-23]`). |
| **Modified / Added** | [`web/package.json`](../web/package.json), [`web/.eslintrc.json`](../web/.eslintrc.json), [`web/pnpm-workspace.yaml`](../web/pnpm-workspace.yaml), [`web/pnpm-lock.yaml`](../web/pnpm-lock.yaml) | Added `"lint": "next lint"`, expanded test glob, added `eslint@9.39.5` + `eslint-config-next@15.5.29`, removed `sonner`, added `pnpm-workspace.yaml` `postcss >= 8.5.23` & `minimatch@^10.0.0 >= 11.0.1` overrides updating `pnpm-lock.yaml` (`+2729/-151`) (`[DEF-09]`, `[DEF-23]`). |

### 3E. Documentation & Planning Files (`README.md`, `docs/`, `.planning/`)
- **Modified product docs (`9` files):** [`README.md`](../README.md), [`docs/features.md`](../docs/features.md), [`docs/architecture.md`](../docs/architecture.md), [`docs/deployment.md`](../docs/deployment.md), [`docs/limitations.md`](../docs/limitations.md), [`docs/ai-disclosure.md`](../docs/ai-disclosure.md), [`docs/test-evidence.md`](../docs/test-evidence.md), [`docs/submission-checklist.md`](../docs/submission-checklist.md), [`docs/round3-roadmap.md`](../docs/round3-roadmap.md).
- **Updated & new planning files (`.planning/`):** [`DEFECTS.md`](DEFECTS.md), [`STATE.md`](STATE.md), [`DECISIONS_NEEDED.md`](DECISIONS_NEEDED.md), plus `RELIABILITY_AUDIT.md`, `AI_TRUST_AUDIT.md`, `API_FAILURE_MATRIX.md`, `SECURITY_AUDIT.md`, `DEPLOYMENT_READINESS.md` banners, [`REMEDIATION_BASELINE.md`](REMEDIATION_BASELINE.md), [`REMEDIATION_REPORT.md`](REMEDIATION_REPORT.md), [`REMEDIATION_DIFF_SUMMARY.md`](REMEDIATION_DIFF_SUMMARY.md), [`REMEDIATION_TEST_EVIDENCE.md`](REMEDIATION_TEST_EVIDENCE.md), and [`REMAINING_USER_RUN.md`](REMAINING_USER_RUN.md).

