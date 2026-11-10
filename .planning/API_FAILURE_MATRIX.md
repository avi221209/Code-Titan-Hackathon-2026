# BrandGuardian — API Failure & Reliability Matrix (Phase 3)

> [!IMPORTANT]
> **Post-Remediation Update (`2026-11-10`, Uncommitted Working Tree Ready for Review):**  
> Sections 1–4 below preserve the **Pre-Remediation Baseline (`HEAD 03a9c96`)**. Working-tree fixes (`[DEF-15]`, `[DEF-19]`, `[DEF-20]`) resolved the audited BFF & AI error gaps:
> - **Readiness & Health Probes (`[DEF-19]`):** Added `GET /ready` (`200`/`503`) and `token_configured` in `ai-service/main.py`; upgraded `GET /api/health` + `executeHealthCheck()` ([`health-workflow.ts`](../web/lib/server/health-workflow.ts)) to require `AI_SERVICE_URL`, `AI_SERVICE_TOKEN`, and `SUPABASE_SERVICE_ROLE_KEY` and support `?probe=1` (`503` when upstream/env degraded).
> - **Sanitized Upstream Errors (`[DEF-19]`):** `format_llm_unavailable_detail()` + defensive `RAW_PYTHON_EXCEPTION_NAMES` guard in [`ai-status-banner.tsx`](../web/components/ai-status-banner.tsx) eliminated `HTTPStatusError`, `OSError`, and `ReadTimeout` leaks (`verify_phase6.py` `6/6` pass).
> - **Transactional Decision RPC, Concurrency Index, Logging & Rate Limits (`[DEF-15]`, `[DEF-20]`):** Extracted [`decision-workflow.ts`](../web/lib/server/decision-workflow.ts) (calls atomic `record_review_decision(...)` RPC from `0004`, unit-tested `3/3`), [`review-workflow.ts`](../web/lib/server/review-workflow.ts) (maps `23505 -> 409` for `uq_review_runs_one_running` + explicit write error handling, unit-tested `3/3`), redacting [`logger.ts`](../web/lib/server/logger.ts), and [`rate-limit.ts`](../web/lib/server/rate-limit.ts). Live RPC execution awaits `USER-RUN` `0004` apply in Supabase SQL Editor ([`.planning/REMAINING_USER_RUN.md`](REMAINING_USER_RUN.md)).

**Original Baseline Audit Date:** `2026-11-10` (IST)  
**Baseline Target Commit:** `03a9c96` (`main`, pre-remediation)  
**Evidence Sources:**
- Live FastAPI mock-upstream test harness (`audit_phase3.py` using `TestClient` + local `ThreadingHTTPServer`, `0.25s` timeout, exit `0`).
- Local Next.js production server `next start -p 3105` (`task-2158`) + static/code-trace inspection of `web/app/api/health/route.ts`, `web/app/api/review/route.ts`, `web/app/api/suggestions/[id]/decision/route.ts`, `web/app/api/documents/route.ts`, and `web/components/ai-status-banner.tsx`.
- **Zero** live Groq quota calls or destructive remote Supabase mutations were executed (**`USER-RUN`**).

---

## 1. Health / Liveness vs Readiness Probes

| Endpoint | Checked Implementation | Observed Behavior | Audit Finding (`[DEF-19]`) |
| --- | --- | --- | --- |
| `GET /health` (`ai-service/main.py:362-366`) | Returns `{"status": "ok", "provider": "groq", "llm_configured": bool(GROQ_API_KEY), "model": MODEL}` | Tested: `GROQ_API_KEY=""` -> `llm_configured: false`; **`GROQ_API_KEY="bad-groq-key"` -> still returns `HTTP 200`, `"status": "ok"`, `"llm_configured": true`** | Pure liveness + boolean env check (deliberate to save Groq quota), **NOT** a readiness probe. No `/ready` route checking `AI_SERVICE_TOKEN` presence! Missing `AI_SERVICE_TOKEN` still returns `GET /health` `200 ok` while rejecting every `POST /review` `401`. |
| `GET /api/health` (`web/app/api/health/route.ts:3-17`) | Checks `Boolean(NEXT_PUBLIC_SUPABASE_URL && NEXT_PUBLIC_SUPABASE_ANON_KEY)` and `Boolean(process.env.AI_SERVICE_URL)` | `:3105` returned `HTTP 200` `{"status":"ok","supabase_configured":true,"ai_service_configured":true}` | **Misleading check (`[DEF-19]`):** `ai_service_configured` checks `AI_SERVICE_URL` **only** — ignoring missing `AI_SERVICE_TOKEN`, missing `SUPABASE_SERVICE_ROLE_KEY`, missing `DEMO_*`, and FastAPI reachability. Even when `POST /api/review` fails `503` on missing `SUPABASE_SERVICE_ROLE_KEY`, `/api/health` reports `ai_service_configured: true`. |

---

## 2. 15-Condition Failure & Resilience Matrix

| # | Condition | Layer Tested | HTTP Status | Persisted / Returned State & Body | Honest Error / Secret Leak Check | Audit Status |
| --- | --- | --- | --- | --- | --- | --- |
| `01` | **Missing `AI_SERVICE_TOKEN`** (client header omitted OR server env unset) | FastAPI `POST /review` (`audit_phase3.py`) | **`401`** | `{"detail":"unauthorized"}` (runs in `Depends(require_key)` **before** body validation) | No secret/schema leak | **PASS** |
| `02` | **Wrong `AI_SERVICE_TOKEN`** (valid body + `{}` body) | FastAPI `POST /review` (`audit_phase3.py`) | **`401`** | Both valid `{...}` and `{}` -> `401 {"detail":"unauthorized"}` | No secret/stack leak | **PASS** |
| `03` | **Missing `GROQ_API_KEY`** (`""`) | FastAPI `POST /review` (`audit_phase3.py`) | **`200`** | `ai_status: "unavailable"`, **`ai_detail: "OSError"`**, `det_count: 2`, `llm_count: 0` | Det preserved; **raw class name `OSError` leaked to UI banner** (`[DEF-19]`) | **PARTIAL FAIL** |
| `04` | **Invalid `GROQ_API_KEY`** (`"bad-groq-key"`) | FastAPI `POST /review` (`audit_phase3.py`) | **`200`** | `ai_status: "unavailable"`, **`ai_detail: "HTTPStatusError"`**, `det_count: 2` (`contains_secret_in_detail: false`) | Secret not leaked; **raw class `HTTPStatusError` rendered to user** (`[DEF-19]`) | **PARTIAL FAIL** |
| `05` | **Upstream Groq HTTP `401`** | FastAPI `POST /review` (`audit_phase3.py`) | **`200`** | `ai_status: "unavailable"`, `ai_detail: "HTTPStatusError"`, `det_count: 2` | Det preserved; raw exception class shown | **PARTIAL FAIL** |
| `06` | **Upstream Groq HTTP `429` (Rate Limit)** | FastAPI `POST /review` (`audit_phase3.py`) | **`200`** | `ai_status: "unavailable"`, `ai_detail: "HTTPStatusError"`, `det_count: 2` | Det preserved; zero backoff/Retry-After differentiation | **PARTIAL FAIL** |
| `07` | **Upstream Groq HTTP `500`** | FastAPI `POST /review` (`audit_phase3.py`) | **`200`** | `ai_status: "unavailable"`, `ai_detail: "HTTPStatusError"`, `det_count: 2` | Det preserved | **PARTIAL FAIL** |
| `08` | **Upstream Groq Timeout** (`0.25s` exceeded by `0.8s` mock sleep) | FastAPI `POST /review` (`audit_phase3.py`) | **`200`** | `ai_status: "unavailable"`, **`ai_detail: "ReadTimeout"`**, `det_count: 2` | Det preserved; `50s` BFF abort can race `30s`+`5s` LLM + Render cold start (`[DEF-20]`) | **PARTIAL FAIL** |
| `09` | **Malformed Non-JSON LLM Output** (`"NOT_JSON_OUTPUT {{"`) | FastAPI `POST /review` (`audit_phase3.py`) | **`200`** | `ai_status: "invalid_output"`, `ai_detail: "Model returned output that failed schema validation"`, `det_count: 2`, `llm_count: 0` | Clean human-readable message + det preserved | **PASS** |
| `10` | **Unexpected Schema (`category: "bogus"`)** | FastAPI `POST /review` (`audit_phase3.py`) | **`200`** | `ai_status: "invalid_output"`, `ai_detail: "Model returned output that failed schema validation"`, `det_count: 2` | Clean rejection + det preserved | **PASS** |
| `11` | **Empty Findings List (`{"findings": []}`)** | FastAPI `POST /review` (`audit_phase3.py`) | **`200`** | `ai_status: "ok"`, `ai_detail: null`, `det_count: 2`, `llm_count: 0` | Honest `ok` with deterministic matches | **PASS** |
| `12` | **Oversized Content (`6001` vs `6000` chars)** | FastAPI `POST /review` (`audit_phase3.py`) + Web `m1.ts` | **`422`** (Py) / **`400`** (TS) | Py: `6001` -> `422`, `6000` -> `200`; Web `/api/documents`: `6001` -> `400` | Consistent `6000` limit across layers | **PASS** |
| `13` | **Concurrent Requests** (5 parallel FastAPI `/review`; concurrent `POST /api/review` race analysis) | FastAPI (`audit_phase3.py`) + Web `review/route.ts:140-226` (code audit) | FastAPI: **`5 x 200`**; Web: **`200` + `409`** (expected) | FastAPI statelessly serves 5/5 concurrent calls cleanly. **Web BFF Gap (`[DEF-15]`):** Next.js checks `postInsertRunning` under PostgreSQL Read Committed isolation **without** a DB `UNIQUE (document_id) WHERE status = 'running'` index; simultaneous transactions can briefly miss each other or cancel both depending on commit ordering | FastAPI safe; Next BFF relies on best-effort app tie-break | **PARTIAL FAIL** (`[DEF-15]`) |
| `14` | **Database Unavailable / Downstream DB Error** | Web routes (`review/route.ts`, `decision/route.ts`, `documents/route.ts`) & FastAPI | **`500`** / **`502`** | `documents` -> `500 {"error":"Unable to fetch/save..."}`; `review/route.ts:134` -> `500` pre-insert, or `markRunFailed()` -> **`502`** (note if DB stays down during `markRunFailed()`, `await` silently ignores Supabase error and leaves run `'running'` for `90s`); `decision` -> `500` | No raw SQL/Postgres message exposed to clients (`0` leaks) | **PARTIAL FAIL** |
| `15` | **Partial Write Failure After Auth/Primary Commit** | Web `review/route.ts:288-400` & `decision/route.ts:146-328` (code trace) | **`502`** (`review`) / **`500`** (`decision`) | **`review/route.ts`:** `markRunFailed()` is **NOT atomic** (sequential `delete(findings)` then `update(review_runs)` — if step 2 fails, run stays `'running'` without findings; lines `392-400` ignore `documents.update` error silently). **`decision/route.ts` (`[DEF-15]` P1):** commits `review_decisions` FIRST under USER RLS, then runs up to **4 separate `admin` writes** (`suggestions`, `audit_events`, `documents`, `audit_events`). Mid-failure returns `HTTP 500` while `review_decisions` remains committed — permanently blocking retries with `HTTP 409` (`23505`) and leaving UI stuck on `pending`! | Critical state-divergence risk on transient Supabase network glitch (`[DEF-15]`) | **FAIL** (`[DEF-15]`, P1) |

---

## 3. UI Propagation & Secret/Exception Exposure Findings

1. **Raw Exception Class Names Shown in UI (`[DEF-19]`):**
   - `ai-service/main.py:323` returns `f"{type(e).__name__}"` (`HTTPStatusError`, `OSError`, `ReadTimeout`) as `ai_detail`.
   - `web/components/ai-status-banner.tsx:75` renders `<p className="text-xs opacity-90">{aiDetail || description}</p>`.
   - Consequently, whenever Groq returns `401`/`429`/`500` or times out, the user loses the helpful copy (`"Language model was unreachable. Only deterministic rule, fact, and terminology checks are shown."`) and instead sees a raw Python exception class name (`HTTPStatusError` or `ReadTimeout`).
2. **Auth & Negative Status Matrix Observed on Production `next start -p 3105` (`task-2158`):**
   - `GET /api/review` -> `405`
   - Unauthenticated `POST /api/review` -> `401`
   - `GET /api/suggestions/<uuid>/decision` -> `405`
   - Unauthenticated `POST /api/suggestions/<uuid>/decision` -> `401`
   - `OPTIONS /api/review` -> `204` (`access-control-allow-origin: null`)
   - **Notice:** Unauthenticated callers hitting `/api/review` or `/api/suggestions/[id]/decision` always hit `supabase.auth.getUser()` before parsing JSON or querying DB (`401`), avoiding unauthenticated enumeration.
   - **Zero secrets in logs/responses:** Mock keys/tokens (`synthetic-audit-token-001`, `synthetic-groq-key`, `bad-groq-key`) were never echoed in any JSON body (`contains_secret_in_detail: false`), and `git grep "error\.message" web/` returned `0` client leaks.

---

## 4. Verdict (Phase 3)

- **FastAPI Boundary Auth & Malformed JSON Handling:** **`PASS`** (`Depends(require_key)` returns `401` before schema inspection; invalid LLM JSON cleanly degrades to `invalid_output`).
- **Next.js BFF Transactionality, Error Mapping, & Health Readiness:** **`FAIL`** (`[DEF-15]` non-transactional `decision` / `review` persistence; `[DEF-19]` shallow health probes & raw exception class name in `AiStatusBanner`).
- **Live Groq & End-to-End DB Failure Tests:** **`USER-RUN`** (FastAPI unreachable rollback & wrong `GROQ_API_KEY` live runs require live secrets).

