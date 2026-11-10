# Verification & Test Evidence (M0 + M1 + QA Round 2 + M2)

All outputs below were captured empirically inside `E:\Plugins\Get Shit Done\Code Titan 2026\brandguardian` without reading or printing any `.env` files. Items marked **USER-RUN** require user-held credentials (`SUPABASE_SERVICE_ROLE_KEY`, `AI_SERVICE_TOKEN`, `GROQ_API_KEY`) or manual SQL Editor execution.

## 1. Python AI Service (`pytest`)

Command: `.\ai-service\.venv\Scripts\python.exe -m pytest -q ai-service`

```text
............                                                             [100%]
12 passed, 1 warning in 0.42s
```

Live HTTP checks against detached `uvicorn main:app --host 127.0.0.1 --port 8000 --env-file .env`:
- `GET http://127.0.0.1:8000/health` → `HTTP 200` `{"status":"ok","provider":"groq","llm_configured":true,"model":"openai/gpt-oss-20b"}`
- `POST /review` without valid `x-api-key` → covered by `pytest` (`test_review_rejects_unauthenticated_empty_body_with_401` → `HTTP 401`)

## 2. TypeScript, Unit Tests & Production Build (`web/`)

Commands executed in `web/`:
- `pnpm typecheck` (`tsc --noEmit`) → **Exit code `0`**
- `pnpm exec tsc --noEmit --noUnusedLocals --noUnusedParameters` → **Exit code `0`**
- `pnpm test` (`node --test lib/validators/*.test.*`) → **13/13 passed**:
  - `m1.test.ts` (`5/5`): route guards, login validation, NUL-byte/array/6,000-char document validation, UUID guard
  - `review.test.ts` (`7/7`): `validateReviewRequestBody`, `validateReviewResponse` (clamped confidence, severity+offset sort, invalid doc/enum/offset rejection), `classifyRunningReviews` (`90s` cutoff), `resolveHighlightSpan` (surrogate-pair/emoji Python vs JS UTF-16 offset fallback to `indexOf`), `buildHighlightedDocumentSegments` (exact reconstruction + non-overlapping highlights)
  - `security.test.mjs` (`1/1`): `poweredByHeader: false` + hardened headers
- `pnpm build` (`next build`) → **Exit code `0`** (`102 kB` shared JS, `/documents/[id]` `7.5 kB` / `122 kB` First Load JS, `/api/review` dynamic `ƒ`)

## 3. HTTP Route, API & UI Verification (`next start -p 3100` and `:3101`)

Verified against fresh production build:

| Endpoint / Flow | Check / Condition | Observed Result |
| --- | --- | --- |
| `http://127.0.0.1:3100/api/health` | `GET` | `HTTP 200` `{"status":"ok","service":"brandguardian-web","supabase_configured":true,"ai_service_configured":true}` |
| `http://127.0.0.1:3101/api/health` (`AI_SERVICE_URL=http://127.0.0.1:9`) | `GET` | `HTTP 200` `{"status":"ok","service":"brandguardian-web","supabase_configured":true,"ai_service_configured":true}` |
| `/api/review` | `GET` (unsupported method) | `HTTP 405` |
| `/api/review` | Unauthenticated `POST` | `HTTP 401` `{"error":"Unauthorized"}` |
| `/api/review` | Authenticated `POST` invalid JSON `{not-json` | `HTTP 400` `{"error":"Invalid JSON request body."}` |
| `/api/review` | Authenticated `POST` invalid UUID `documentId` | `HTTP 400` `{"error":"A valid documentId UUID is required."}` |
| `/api/review` | Authenticated `POST` nonexistent UUID | `HTTP 404` `{"error":"Document not found."}` |
| `/documents/[id]` (`Asterra Flow Launch Draft`) | Headless Chromium (`1440px` & `375px`) | `<h1>` renders, `"Run review"`, `"Document Copy"`, `"Findings"` headings visible, `0` horizontal overflow (`1440` & `375`), `0` page errors, navigates cleanly to `/documents/[id]/history` |
| `/documents/[id]` (`"Run review"` click with missing `SUPABASE_SERVICE_ROLE_KEY` / `AI_SERVICE_TOKEN`) | Authenticated UI click | Returns `HTTP 503`, shows honest inline `role="alert"` (`"Review engine environment variables are not configured on the server yet."`), re-enables `"Run review"` button, creates `0` fake findings |

## 4. Security & Secret Isolation Checks

- `.next/static/**/*.js` scan for `SUPABASE_SERVICE_ROLE_KEY`, `DEMO_PASSWORD`, `GROQ_API_KEY`, `AI_SERVICE_TOKEN` → **0 hits**.
- `'use client'` source scan for `SUPABASE_SERVICE_ROLE_KEY`, `DEMO_PASSWORD`, `DEMO_EMAIL`, `GROQ_API_KEY`, `AI_SERVICE_TOKEN` → **0 hits**.

## 5. Pending `USER-RUN` / Blocked Checks (Missing Server Env Secrets)

Because boolean env checks detected `SUPABASE_SERVICE_ROLE_KEY` missing in `web/.env.local` and `AI_SERVICE_TOKEN` missing in both `ai-service/.env` and `web/.env.local` (values never read/printed), live end-to-end DB review persistence tests could not execute against Supabase/FastAPI and remain **USER-RUN**:
1. Set `SUPABASE_SERVICE_ROLE_KEY` in `web/.env.local`, and set a shared `AI_SERVICE_TOKEN` in both `ai-service/.env` and `web/.env.local` (matching each other), then restart `ai-service` and `web`.
2. Open seeded Asterra draft on `/documents/[id]` → click **Run review** → verify 4 findings (`consumers`, `founded in 2019` citing `2021` fact, `cheapest and best`, `guarantee 300% revenue growth...`), `Verified`/`Unverified` badges, hard refresh persistence, and concurrent `409` on double-submit.
3. Run FastAPI-unreachable check (`AI_SERVICE_URL=http://127.0.0.1:9`) once `SUPABASE_SERVICE_ROLE_KEY` is present → confirm `HTTP 502`, `'failed'` `review_runs` row, and `0` findings.
4. Prompt-injection document test + wrong-`GROQ_API_KEY` test (set invalid `GROQ_API_KEY` on `ai-service`, verify `ai_status: "unavailable"`, deterministic findings saved cleanly, and [`AiStatusBanner`](file:///E:/Plugins/Get%20Shit%20Done/Code%20Titan%202026/brandguardian/web/components/ai-status-banner.tsx) displays unavailable notice; restore valid `GROQ_API_KEY`).
5. `supabase/tests/rls_checks.sql` & `supabase/migrations/0002_rls_hardening.sql` in Supabase SQL Editor.
