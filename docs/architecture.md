# BrandGuardian System Architecture

BrandGuardian separates user interface rendering, workspace authorization, compliance inspection, and authoritative persistence across four explicit layers.

---

## 1. Component Topology

```text
Browser (Client)
  │  Supabase SSR auth cookies only (anon key + browser URL)
  ▼
Next.js 15 App Router & BFF Routes (`web/`)
  ├── User RLS Client (`createClient()` via `@supabase/ssr`)
  │     • Reads workspace knowledge (`guideline_rules`, `approved_facts`, `terminology`),
  │       `documents`, `review_runs`, `findings`, `suggestions`, `review_decisions`, `audit_events`
  │     • Inserts `documents` and `review_decisions` (RLS enforces member/role & uniqueness)
  └── Service-Role Admin Client (`createAdminClient()` + `import 'server-only'`)
        • Inserts/updates `review_runs`, `findings`, `suggestions`, `documents.status`,
          `audit_events`, and profile display-name joins for `/documents/[id]` & `/history`
  │
  ├── POST /review  (x-api-key: AI_SERVICE_TOKEN, AbortSignal.timeout(50_000), maxDuration = 60)
  ▼
Stateless FastAPI Inspection Service (`ai-service/`)
  ├── Never connects to Supabase directly
  ├── 1. Deterministic Checkers: `check_terminology`, `check_facts`, `check_rules`
  ├── 2. Optional Structured LLM: Groq (`openai/gpt-oss-20b`) or local Ollama (`qwen2.5:3b`)
  └── 3. Evidence Verifier (`verify()`): verifies exact text span + workspace `source_id` membership
```

---

## 2. Trust Boundaries & Security Isolation

1. **Browser <-> Next.js (`web/`):**
   - Browsers receive only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   - Server-only secrets (`DEMO_EMAIL`, `DEMO_PASSWORD`, `SUPABASE_SERVICE_ROLE_KEY`, `AI_SERVICE_TOKEN`) are isolated in `web/lib/env.ts`, `web/lib/supabase/admin.ts`, `web/lib/profiles.ts`, and `web/lib/workspace.ts` guarded by `import 'server-only'`.
   - `web/next.config.mjs` enforces `poweredByHeader: false`, `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and `Permissions-Policy`.
2. **Next.js Server <-> Supabase (`supabase/`):**
   - **USER RLS boundary:** All reads of workspace knowledge, documents, review results, decisions, and audit history execute with the authenticated user's session cookie (`createClient()`). Role gating (`creator` vs `approver`/`manager`/`admin`) is enforced inside PostgreSQL (`public.is_member`, `public.has_role` in `0001_schema.sql` / `0002_rls_hardening.sql`), not merely in React UI.
   - **No client writes to AI outputs:** `review_runs`, `findings`, and `suggestions` have **no** authenticated `INSERT`/`UPDATE`/`DELETE` policies; only the Next.js server (`createAdminClient()`) writes them.
   - **Audit isolation:** Zero client-side code inserts into `audit_events`. Applying `supabase/migrations/0003_audit_server_only.sql` after live decision verification drops the legacy `audit_insert` authenticated policy cleanly.
3. **Next.js Server <-> FastAPI (`ai-service/`):**
   - `POST /api/review` loads approved workspace knowledge via the USER RLS client first, then sends `{ document_id, workspace_id, content, knowledge, use_llm }` to FastAPI. Thus FastAPI inherits RLS tenant scoping without ever holding Supabase credentials.
   - `POST /review` checks `x-api-key` via `dependencies=[Depends(require_key)]` using `hmac.compare_digest` **before** validating the request JSON body (`401` before `422`).
4. **FastAPI <-> LLM Provider (Untrusted Input Boundary):**
   - Draft copy (`content`, max `6,000` chars) is treated as untrusted data, stripped of closing `</document>` tags (`< /document>` breakout escape in `build_user_prompt`), wrapped inside `<document>...</document>`, and passed to a tool-free, non-streaming structured JSON extraction call (`LlmOut` Pydantic schema).

---

## 3. Shared Data Contracts (`Finding` & `ReviewResponse`)

Pydantic models in `ai-service/main.py` mirror TypeScript interfaces in [`web/lib/types/finding.ts`](../web/lib/types/finding.ts) 1:1 (verified across `104` Supabase column clauses and `Finding`/`ReviewResponse` field checks):

- **`Finding`:**
  - `category`: `'tone' | 'terminology' | 'fact' | 'unsupported_claim' | 'messaging'`
  - `severity`: `'critical' | 'high' | 'medium' | 'low'`
  - `matched_text`, `start_offset`, `end_offset`, `explanation`
  - `source_type`: `'terminology' | 'fact' | 'guideline_rule' | 'model' | null`
  - `source_id`: UUID string matching supplied workspace knowledge or `null`
  - `confidence`: `0.0–1.0` (`0.99` terminology, `0.95` fact, `0.90` regex rule, `0.60` LLM)
  - `verification_status`: `'verified' | 'unverified'`
  - `origin`: `'deterministic' | 'llm'`
  - `suggested_text`: string or `null`
- **`ReviewResponse`:** `document_id`, `model_name`, `ai_status` (`'ok' | 'unavailable' | 'invalid_output' | 'skipped'`), `ai_detail`, `findings`, `dropped`, `elapsed_ms`.

*(Note: Every persisted finding always gets one `suggestions` row—even when `suggested_text` is `null`—so human decisions always reference a single `suggestion_id` target with a `unique` constraint blocking duplicate decisions.)*

---

## 4. Deterministic-First Pipeline & Evidence Verifier

Inside `ai-service/main.py`:

1. **Deterministic checkers execute first (no LLM dependency):**
   - `check_terminology()`: case-insensitive word-boundary search against `terminology` entries, preserving case (`match_case`).
   - `check_facts()`: compiles single-capture regex (`match_pattern`, max length `300` defensively guarded via `safe_compile`), normalizes whitespace/commas (`norm()`), flags discrepancies against `approved_facts.value`, and generates replacement slices keeping surrounding matched text.
   - `check_rules()`: applies approved `guideline_rules` regex `pattern` values (such as `"guarantee..."` or `"cheapest"`/`"best"`/`"number one"`), attaching optional `rule.suggestion`.
2. **LLM inspection runs second (only when `use_llm=True`):**
   - Returns exact verbatim `quote` substrings rather than model-computed integer offsets; code locates quotes via exact `text.find(quote)` (with case-insensitive regex fallback). Unfound hallucinated quotes are incremented in `dropped` and discarded immediately.
   - LLM candidates overlapping any deterministic finding (`overlaps()`) are removed so deterministic workspace rules take precedence.
3. **Evidence Verifier (`verify()`):**
   - Checks `0 <= start_offset < end_offset <= len(text)` and exact slice equality `text[start_offset:end_offset] == matched_text`. Any mismatch is dropped (`dropped += 1`).
   - Checks `source_id` membership in the supplied RLS knowledge IDs (`terminology`, `facts`, `guideline_rules`). Only verified workspace references receive `verification_status = "verified"`; unlinked LLM claims remain `"unverified"` with `origin = "llm"`.
   - Final list is sorted deterministically by `(SEV_ORDER[severity], start_offset)` in both Python and [`validateReviewResponse`](../web/lib/validators/review.ts).
4. **Unicode Offset Handling (Python vs JavaScript):**
   - Python string indices count Unicode code points, whereas JavaScript strings index UTF-16 code units. [`resolveHighlightSpan`](../web/lib/validators/review.ts) and [`applyAcceptedEditsToDocument`](../web/lib/validators/decision.ts) check exact `slice(start, end) === matched_text` first and fall back to `indexOf(matched_text)` if surrogate pairs (e.g., emojis) shifted offsets, skipping unmatched spans rather than corrupting text.

---

## 5. Failure Modes & Concurrency Safety

| Failure Scenario | System Behavior | Observed / Coded Result |
| --- | --- | --- |
| **FastAPI unreachable / timeout / 5xx / malformed JSON** | Next.js `POST /api/review` catches fetch/HTTP/validation failures, calls `markRunFailed()` (deletes any partial findings, marks `review_runs.status = 'failed'` with truncated error), preserves existing `documents.status`, and returns `HTTP 502`. | UI displays `role="alert"` error message (`0` fake findings persisted). |
| **LLM unreachable / timeout / bad key** | `run_llm()` catches `httpx.HTTPError`, `asyncio.TimeoutError`, or `OSError` and returns `([], "unavailable", <ExceptionType>, 0)`. Deterministic findings proceed through `verify()` and save normally. | `AiStatusBanner` displays **`AI unavailable`** alongside valid deterministic findings. |
| **LLM returns non-JSON or violates Pydantic schema** | `run_llm()` catches JSON/Validation errors and returns `([], "invalid_output", "Model returned output that failed schema validation", 0)`. | `0` corrupted LLM findings stored; `AiStatusBanner` displays **`AI output rejected`**. |
| **Concurrent double-click / stuck run** | Client locks with `inFlightReviewRef`; server marks running attempts older than `90s` (`timed out`) as `'failed'`, rejects active runs with `HTTP 409`, and runs a post-insert winner check (`started_at`, `id` ordering) marking losing concurrent inserts failed (`409`). | Prevents duplicate parallel reviews and permanently stuck `'running'` rows. |
| **Missing server secrets (`SUPABASE_SERVICE_ROLE_KEY`, `AI_SERVICE_TOKEN`, `AI_SERVICE_URL`)** | `getServerEnv()` throws cleanly; `POST /api/review` returns `HTTP 503` before creating any run row. | Tested live on `:3100` (`503` alert shown in UI, button re-enabled). |
| **Role violation or duplicate human decision** | `POST /api/suggestions/[id]/decision` inserts via USER RLS `createClient()`: `creator` role triggers PostgreSQL `42501` (`HTTP 403`), second decision on the same `suggestion_id` triggers `23505` (`HTTP 409`). | Verified in `decision_rls.sql` + route error mapping in [`decision/route.ts`](../web/app/api/suggestions/[id]/decision/route.ts). |
