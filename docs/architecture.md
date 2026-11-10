# BrandGuardian System Architecture

BrandGuardian separates user interface rendering, workspace authorization, compliance inspection, and authoritative persistence across four explicit layers.

---

## 1. Component Topology

```text
Browser (Client)
  │  Supabase SSR auth cookies only (anon key + browser URL)
  ▼
Next.js 15 App Router & BFF Routes (`web/`)
  ├── Edge Middleware (`web/middleware.ts`) + Workspace Context (`web/lib/workspace.ts`)
  │     • `getCachedPublicJwks()` + `getVerifiedClaimsUser()` (`@supabase/auth-js` `getClaims()`)
  ├── User RLS Client (`createClient()` via `@supabase/ssr`)
  │     • Reads workspace knowledge (`guideline_rules` joined with approved `guidelines`,
  │       date-bounded `approved_facts`, `terminology`), `documents`, `review_runs`,
  │       `findings`, `suggestions`, `review_decisions`, `audit_events`
  │     • Calls `POST /api/documents` and transactional `record_review_decision(...)` RPC (`0004`)
  └── Service-Role Admin Client (`createAdminClient()` + `import 'server-only'`)
        • Inserts/updates `review_runs`, `findings`, `suggestions`, `documents.status`,
          `audit_events`, and profile display-name joins for `/documents/[id]` & `/history`
  │
  ├── POST /review  (x-api-key: AI_SERVICE_TOKEN, AbortSignal.timeout(50_000), maxDuration = 60)
  ▼
Stateless FastAPI Inspection Service (`ai-service/`)
  ├── Never connects to Supabase directly
  ├── 1. Deterministic Checkers (UTF-16 offsets): `check_terminology`, `check_facts`, `check_rules`
  ├── 2. Optional Structured LLM: Groq (`openai/gpt-oss-20b`) or local Ollama (`qwen2.5:3b`)
  │      Receives compact `RULES`, `APPROVED FACTS`, `APPROVED TERMINOLOGY` + `cursor_by_quote`
  └── 3. Evidence Verifier (`verify()`): UTF-16 span check + semantic source/category/severity check
```

---

## 2. Trust Boundaries & Security Isolation

1. **Browser <-> Next.js (`web/`):**
   - Browsers receive only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   - Server-only secrets (`DEMO_EMAIL`, `DEMO_PASSWORD`, `SUPABASE_SERVICE_ROLE_KEY`, `AI_SERVICE_TOKEN`) are isolated in [`web/lib/env.ts`](../web/lib/env.ts), [`web/lib/supabase/admin.ts`](../web/lib/supabase/admin.ts), [`web/lib/profiles.ts`](../web/lib/profiles.ts), and [`web/lib/workspace.ts`](../web/lib/workspace.ts) guarded by `import 'server-only'`.
   - [`web/next.config.mjs`](../web/next.config.mjs) enforces `poweredByHeader: false`, `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and `Permissions-Policy`.
   - Server workflow modules ([`web/lib/server/logger.ts`](../web/lib/server/logger.ts), [`web/lib/server/rate-limit.ts`](../web/lib/server/rate-limit.ts)) redact tokens/secrets/copy keys from structured JSON logs and rate-limit write/auth endpoints per isolate.
2. **Next.js Server <-> Supabase (`supabase/`):**
   - **USER RLS boundary:** Reads execute via `createClient()`; write/review API endpoints always verify identity via `supabase.auth.getUser()` while SSR navigation uses [`getVerifiedClaimsUser()`](../web/lib/supabase/claims.ts) (with `getClaims()` asymmetric JWKS cache & automatic `getUser()` fallback).
   - **Hardened DB Integrity (`0002` + `0003` + `0004`):** `0002` (applied) revokes `DELETE`, enforces `documents.workspace_id`/`created_by` immutability, and optimizes `(select auth.uid())`. Applying `0003` closes legacy client `audit_insert`, and applying `0004` revokes `PUBLIC`/`anon` helper RPC access, locks `documents.status` & post-review `title`/`content`, enforces composite workspace FKs and domain `CHECK` constraints, enforces single running review uniqueness (`uq_review_runs_one_running`), and provides transactional `record_review_decision(...)`.
   - **Audit isolation:** Zero client-side code inserts into `audit_events`.
3. **Next.js Server <-> FastAPI (`ai-service/`):**
   - [`executeReviewWorkflow()`](../web/lib/server/review-workflow.ts) loads active knowledge (`approved_facts` within `valid_from`/`valid_until` UTC dates and `guideline_rules` joined with `guidelines.status = 'approved'`) via USER RLS first, so FastAPI never holds Supabase credentials.
   - `POST /review` validates `x-api-key` via `dependencies=[Depends(require_key)]` using `hmac.compare_digest` **before** parsing the request JSON body (`401` before `422`).
4. **FastAPI <-> LLM Provider (Untrusted Input Boundary):**
   - Draft copy (`content`, max `6,000` chars) has `</document>` escaped (`< /document>` in `build_user_prompt`), is wrapped in `<document>...</document>`, and goes to a tool-free, non-streaming structured JSON call (`LlmOut`).
   - Upstream errors map through [`format_llm_unavailable_detail()`](../ai-service/main.py#L416-L430) to safe user messages without leaking Python exception class names.

---

## 3. Shared Data Contracts (`Finding` & `ReviewResponse`)

Pydantic models in [`ai-service/main.py`](../ai-service/main.py) mirror TypeScript interfaces in [`web/lib/types/finding.ts`](../web/lib/types/finding.ts) 1:1:

- **`Finding`:**
  - `category`: `'tone' | 'terminology' | 'fact' | 'unsupported_claim' | 'messaging'`
  - `severity`: `'critical' | 'high' | 'medium' | 'low'`
  - `matched_text`, `start_offset` (UTF-16 code units), `end_offset` (UTF-16 code units), `explanation`
  - `source_type`: `'terminology' | 'fact' | 'guideline_rule' | 'model' | null`
  - `source_id`: UUID string matching supplied workspace knowledge or `null`
  - `confidence`: bounded `0.0–1.0` (`ge=0.0, le=1.0`; `0.99` terminology, `0.95` fact, `0.90` regex rule, `0.60` LLM)
  - `verification_status`: `'verified' | 'unverified'`
  - `origin`: `'deterministic' | 'llm'`
  - `suggested_text`: string or `null`
- **`ReviewResponse`:** `document_id`, `model_name`, `ai_status` (`'ok' | 'unavailable' | 'invalid_output' | 'skipped'`), `ai_detail`, `findings`, `dropped` (includes both verifier drops and excess items truncated past top `5`), `elapsed_ms`.

*(Note: Every persisted finding always gets one `suggestions` row—even when `suggested_text` is `null`—so human decisions always reference a single `suggestion_id` target with a `unique` constraint blocking duplicate decisions.)*

---

## 4. Deterministic-First Pipeline & Semantic Evidence Verifier

Inside [`ai-service/main.py`](../ai-service/main.py):

1. **UTF-16 Mapping (`build_utf16_index_map`):** Precomputes Python code-point -> JavaScript UTF-16 code-unit offset tables so astral emojis/surrogate pairs never drift vs browser `String.prototype.slice()`.
2. **Deterministic checkers execute first:**
   - `check_terminology()`: case-insensitive word-boundary search preserving case (`match_case`).
   - `check_facts()`: single-capture regex (`match_pattern`, max length `300`) with whitespace/comma normalization (`norm()`).
   - `check_rules()`: approved regex rules (such as `"guarantee..."` or `"best(?!\s+practices\b)"`).
3. **LLM inspection runs second (only when `use_llm=True`):**
   - Tracks per-quote occurrences via `cursor_by_quote` so repeated identical quotes receive distinct spans.
   - Any items beyond the top `5` cap explicitly increment `dropped` (`truncated_count = max(0, len(data.findings) - 5)`).
   - Unfound quotes increment `dropped` and are discarded; LLM candidates overlapping any deterministic finding (`overlaps()`) are removed so workspace deterministic rules take precedence.
4. **Semantic Evidence Verifier (`verify()`):**
   - Verifies exact UTF-16 -> Python code-point round-trip `text[s_cp:e_cp] == matched_text`.
   - Verifies **semantic matching**: terminology links require `category == "terminology"`, fact links require `category == "fact"`, and guideline rule links require both matching `category` and non-escalated severity (`SEV_ORDER[f.severity] >= SEV_ORDER[rule.severity]`); mismatches downgrade cleanly to `verification_status = "unverified"`.
   - Final list is sorted deterministically by `(SEV_ORDER[severity], start_offset)` in both Python and [`validateReviewResponse()`](../web/lib/validators/review.ts).
5. **Ambiguity-Safe Frontend Highlighting & Preview:**
   - [`resolveHighlightSpan()`](../web/lib/validators/review.ts#L417-L474) and [`applyAcceptedEditsToDocument()`](../web/lib/validators/decision.ts#L144-L204) check exact UTF-16 slices first; only unambiguous surrogate-adjusted matches resolve, while ambiguous repeated legacy substrings are skipped (`skippedUnmatchedCount`) rather than rewriting the wrong occurrence.

---

## 5. Failure Modes & Concurrency Safety

| Failure Scenario | System Behavior | Observed / Coded Result |
| --- | --- | --- |
| **FastAPI unreachable / timeout / 5xx / malformed JSON** | [`executeReviewWorkflow()`](../web/lib/server/review-workflow.ts) logs structured error, calls cleanup-and-fail `markRunFailed()` (deletes any partial findings, marks `review_runs.status = 'failed'`, logs any cleanup warning), preserves existing `documents.status`, and returns `HTTP 502`. | UI displays `role="alert"` error message (`0` fake findings persisted). |
| **LLM unreachable / timeout / 401 / 429 / 5xx** | `run_llm()` catches `httpx.HTTPError`, `asyncio.TimeoutError`, or `OSError` and maps via `format_llm_unavailable_detail()` to clean user-safe copy (`401/403`, `429`, `5xx`, timeout, missing config, unreachable). Deterministic findings proceed cleanly. | Verified via `verify_phase6.py`; `AiStatusBanner` displays **`AI unavailable`** with clear non-technical copy (zero raw exception class names). |
| **LLM returns non-JSON or violates Pydantic schema** | `run_llm()` catches JSON/Validation errors and returns `([], "invalid_output", "Model returned output that failed schema validation", 0)`. | `0` corrupted LLM findings stored; `AiStatusBanner` displays **`AI output rejected`**. |
| **Concurrent double-click / stuck run** | Client locks with `inFlightReviewRef`; server marks running attempts older than `90s` (`timed out`) as `'failed'`, rejects active runs with `HTTP 409`, enforces DB partial unique index `uq_review_runs_one_running` (`23505` -> `409` in `0004`), and runs a post-insert tie-break fallback. | Prevents duplicate parallel reviews and permanently stuck `'running'` rows. |
| **Missing server secrets (`SUPABASE_SERVICE_ROLE_KEY`, `AI_SERVICE_TOKEN`, `AI_SERVICE_URL`)** | [`executeHealthCheck()`](../web/lib/server/health-workflow.ts) marks `ai_service_configured: false` (and `?probe=1` returns `503`); `ai-service /ready` returns `503` when `AI_SERVICE_TOKEN` or LLM readiness fails; `POST /api/review` returns `HTTP 503` before creating any run row. | Tested in `health-workflow.test.ts`, `verify_phase6.py`, and live `:3106` `/api/health?probe=1`. |
| **Role violation, missing `0004`, duplicate decision, or partial DB failure** | [`executeDecisionWorkflow()`](../web/lib/server/decision-workflow.ts) invokes PostgreSQL transactional `record_review_decision(...)` (`0004`), committing decision + suggestion status + audit events + document `'reviewed'` transition atomically in one transaction: `42501` -> `403`, `23505` -> `409`, `P0002` -> `404`, `22023` -> `400`, missing `0004` (`PGRST202`/`42883`) -> `503`, unexpected failure -> zero partial state committed (`500`). | Tested in `decision-workflow.test.ts` (`5/5`); DB trigger/RPC suite ready in [`remediation_checks.sql`](../supabase/tests/remediation_checks.sql) (`USER-RUN`). |
