# Decisions & Remaining Actions From Project Owner

> **Status After Complete Reliability Remediation (`2026-11-10`):**  
> Prior Tier B (`[DEF-09]`, `[DEF-11]`, `[DEF-12]`) and audit Tier B/A (`[DEF-14]`–`[DEF-23]`) implementations have been completed in the local working tree and verified statically / locally without committing, pushing, deploying, applying live SQL, inspecting `.env*`, or touching ports `3000` / `8000`.  
> **Companion Reports:** [`.planning/REMEDIATION_REPORT.md`](REMEDIATION_REPORT.md) · [`.planning/REMEDIATION_DIFF_SUMMARY.md`](REMEDIATION_DIFF_SUMMARY.md) · [`.planning/REMEDIATION_TEST_EVIDENCE.md`](REMEDIATION_TEST_EVIDENCE.md) · [`.planning/REMAINING_USER_RUN.md`](REMAINING_USER_RUN.md)

---

## 1. Defect Disposition Summary

- **Code-Verified `FIXED` in Working Tree (`10` Remediated Items + `9` Prior Fixed Items):**
  - Prior resolved: `[DEF-01]`–`[DEF-08]`, `[DEF-10]` (`0002` applied by owner), `[DEF-13]`.
  - Newly `FIXED` & verified: `[DEF-09]` (ESLint + `0`-advisory audit), `[DEF-11]` (JWKS-cached `getClaims()` SSR auth), `[DEF-12]` (true `HTTP 404` on invalid/missing doc UUIDs), `[DEF-16]` (UTF-16 offsets + duplicate quote cursor + safe preview), `[DEF-17]` (semantic `verify()` + UTC/status filtering + Facts/Terms LLM prompt context), `[DEF-18]` (Evidence gate on **Accept** & **Edit** + `suggested_text` contract + bounded confidence + truncated `dropped`), `[DEF-19]` (sanitized upstream error copy + `/ready` + 5-key `/api/health?probe=1`), `[DEF-21]` (WCAG `>= 3.2:1` borders + `<SkipLink />` + non-nested finding focus + client Reject validation), `[DEF-22]` (UI/doc copy sync, `GROQ_URL`, `/knowledge` guideline status, `"best practices"` regex), `[DEF-23]` (removed unused `Dialog`, `Toast`, `sonner`; kept schema compat).
- **Remaining **`USER-RUN`** Items (Application/SQL Ready — Awaiting Live Execution / Hosting):**
  - **`[DEF-14]` & `[DEF-15]`:** App workflows (`decision-workflow.ts`, `review-workflow.ts`) & SQL (`0003_audit_server_only.sql`, `0004_remediation_integrity_and_rpc.sql`, `decision_rls.sql`, `remediation_checks.sql`) are complete and unit/static-tested. **Must apply `0004` in Supabase SQL Editor before live `POST /api/suggestions/[id]/decision` calls will execute `record_review_decision(...)` (otherwise the route returns honest `HTTP 503`).**
  - **`[DEF-20]`:** Structured redacting logging and in-memory rate limiting are `FIXED` in code; verifying Vercel `60s` Fluid Compute/Pro timeout, warming Render/Railway `/ready`, running Docker image build/smoke tests, and running live Groq + DB E2E tests are **`USER-RUN`**.

---

## 2. Two Deferred Policy Choices (No Action Required Unless Desired)

1. **Supabase Asymmetric JWT Signing Keys (`[DEF-11]` Optimization Ceiling):**
   - `getVerifiedClaimsUser()` uses `@supabase/auth-js` `getClaims(undefined, { jwks })` with an in-memory JWKS cache (`10 min` TTL). It automatically verifies asymmetric JWTs with `0` Auth network calls and falls back cleanly on HS256 projects. After judging, migrating your Supabase project signing key from legacy HS256 to RS256/ES256 unlocks full zero-RTT local edge JWT validation without any code changes.
2. **Vestigial Schema Columns & `.github/workflows/ci.yml` (`[DEF-23]` / Round 3):**
   - `public.comments` (now protected by composite FK `fk_comments_ws_doc` in `0004`) and `documents.version` (`v1`) remain preserved non-destructively for Round 2 stability. `.github/workflows/ci.yml` remains proposed specification only ([`.planning/RELIABILITY_AUDIT.md`](RELIABILITY_AUDIT.md)) and was not created unless explicitly desired.

---

## 3. Ordered `USER-RUN` Execution Checkpoints

Follow [`.planning/REMAINING_USER_RUN.md`](REMAINING_USER_RUN.md) **in exact order**:
1. Review working tree diff (`git diff`) and confirm zero unintended edits or secrets.
2. Ensure local/cloud env vars are configured (`SUPABASE_SERVICE_ROLE_KEY`, matching `AI_SERVICE_TOKEN`, `GROQ_API_KEY`, etc.).
3. In **Supabase SQL Editor**: run `decision_rls.sql` (`4/4` -> `rollback`) -> apply `0003_audit_server_only.sql` -> apply **`0004_remediation_integrity_and_rpc.sql`** -> run `remediation_checks.sql` (`8/8` cases `h–o` -> `rollback`).
4. Commit working tree fixes on `main` explicitly by path and push to `origin/main` (you handle git commit/push).
5. Build/verify `ai-service/Dockerfile` (on a machine with Docker), deploy `ai-service` (health `/ready`) & `web` (verify **`60s` Fluid Compute / Pro**), rotate production keys, update Supabase Auth Site/Redirect URLs.
6. Replace `<WEB_URL>`, `<AI_URL>`, live Groq latencies, and `docs/contributions.md` `[Placeholder]`s, run T-15 min `/ready` + `/api/health?probe=1` warm-up, and execute full live Asterra review/decision/degraded E2E walkthrough in an **Incognito browser** (covering `/documents/[id]` and `/history` viewports too).
