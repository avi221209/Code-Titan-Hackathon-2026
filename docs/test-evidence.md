# M0 Verification & Test Evidence

All outputs below were captured empirically on `2026-11-09` inside `E:\Plugins\Get Shit Done\Code Titan 2026\brandguardian`.

## 1. Python AI Service (`pytest`)

Command: `.\.venv\Scripts\python.exe -m pytest -v` (inside `ai-service/`)

```text
collected 11 items

test_checks.py::test_expected_asterra_findings PASSED                    [  9%]
test_checks.py::test_suggestions_keep_intent PASSED                      [ 18%]
test_checks.py::test_all_deterministic_findings_verified_and_offsets_exact PASSED [ 27%]
test_checks.py::test_consistent_fact_is_not_flagged PASSED               [ 36%]
test_checks.py::test_verifier_drops_wrong_span PASSED                    [ 45%]
test_checks.py::test_unknown_source_is_unverified_not_verified PASSED    [ 54%]
test_checks.py::test_injection_cannot_break_out_of_document_tags PASSED  [ 63%]
test_checks.py::test_llm_good_output_locates_quote_and_is_unverified_without_rule PASSED [ 72%]
test_checks.py::test_llm_hallucinated_quote_is_dropped PASSED            [ 81%]
test_checks.py::test_llm_invalid_json_gives_honest_status_no_findings PASSED [ 90%]
test_checks.py::test_llm_unreachable_gives_unavailable_no_fake_findings PASSED [100%]

============================= 11 passed in 4.20s ==============================
```

## 2. TypeScript Typecheck & Next.js Production Build

Command: `pnpm typecheck && pnpm build` (inside `web/`)

- `tsc --noEmit`: Exit code `0` (0 type errors).
- `next build`: Exit code `0` (Compiled successfully, 11/11 static & dynamic routes plus Middleware `34 kB`).

## 3. HTTP Route & API Verification (`curl.exe`)

| Endpoint / Route | Method | Expected | Observed Status & Payload |
| :--- | :--- | :--- | :--- |
| `/` | `GET` | `200` | `HTTP 200` |
| `/login` | `GET` | `200` | `HTTP 200` |
| `/dashboard` | `GET` | `200` | `HTTP 200` |
| `/knowledge` | `GET` | `200` | `HTTP 200` |
| `/documents/new` | `GET` | `200` | `HTTP 200` |
| `/documents/test-doc` | `GET` | `200` | `HTTP 200` |
| `/documents/test-doc/history` | `GET` | `200` | `HTTP 200` |
| `/api/health` | `GET` | `200` JSON | `{"status":"ok","service":"brandguardian-web","timestamp":"2026-11-09T03:49:22.117Z","supabase_configured":false,"ai_service_configured":false}` (`HTTP 200`) |
| `/api/review` | `GET` / `POST` | `501` | `{"error":"not_implemented"}` (`HTTP 501`) |
| `/api/documents` | `GET` / `POST` | `501` | `{"error":"not_implemented"}` (`HTTP 501`) |
| `/api/suggestions/test-id/decision` | `GET` / `POST` | `501` | `{"error":"not_implemented"}` (`HTTP 501`) |
| `http://127.0.0.1:8000/health` | `GET` | `200` JSON | `{"status":"ok","provider":"ollama","ollama":false,"model":"qwen2.5:3b"}` (`HTTP 200`) |

## 4. Security & Git Isolation Checks

- `git rev-parse --show-toplevel` (inside `brandguardian/`): `E:/Plugins/Get Shit Done/Code Titan 2026/brandguardian`
- `git check-ignore -v .env web/.env web/.env.local ai-service/.env ai-service/.env.local`: all matched by `.gitignore` ignore rules.
- `server-only` guard: verified present at top of `web/lib/supabase/admin.ts`.
- Secret scan across tracked files: 0 key-like token matches (`gsk_`, `sk-`, `eyJ`, `sb_secret_`).
