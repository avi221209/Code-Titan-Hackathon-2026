# Verification & Test Evidence (M0 + M1 + QA Round 2 + M2 + M3)

All outputs below were captured empirically inside `E:\Plugins\Get Shit Done\Code Titan 2026\brandguardian` without reading or printing any `.env` files. Items marked **USER-RUN** require user-held credentials (`SUPABASE_SERVICE_ROLE_KEY`, `AI_SERVICE_TOKEN`, `GROQ_API_KEY`) or manual SQL Editor execution.

## 1. Python AI Service (`pytest`)

Command: `.\ai-service\.venv\Scripts\python.exe -m pytest -q ai-service`

```text
............                                                             [100%]
12 passed, 1 warning in 0.44s
```

Live HTTP checks against detached `uvicorn main:app --host 127.0.0.1 --port 8000 --env-file .env`:
- `GET http://127.0.0.1:8000/health` → `HTTP 200` `{"status":"ok","provider":"groq","llm_configured":true,"model":"openai/gpt-oss-20b"}`
- `POST /review` without valid `x-api-key` → covered by `pytest` (`test_review_rejects_unauthenticated_empty_body_with_401` → `HTTP 401`)

## 2. TypeScript, Unit Tests & Production Build (`web/`)

Commands executed in `web/`:
- `pnpm typecheck` (`tsc --noEmit`) → **Exit code `0`**
- `pnpm exec tsc --noEmit --noUnusedLocals --noUnusedParameters` → **Exit code `0`**
- `pnpm test` (`node --test lib/validators/*.test.*`) → **17/17 passed**:
  - `m1.test.ts` (`5/5`): route guards, login validation, NUL-byte/array/6,000-char document validation, UUID guard
  - `review.test.ts` (`7/7`): `validateReviewRequestBody`, `validateReviewResponse` (clamped confidence, severity+offset sort, invalid doc/enum/offset rejection), `classifyRunningReviews` (`90s` cutoff), `resolveHighlightSpan` (surrogate-pair/emoji Python vs JS UTF-16 offset fallback to `indexOf`), `buildHighlightedDocumentSegments` (exact reconstruction + non-overlapping highlights)
  - `decision.test.ts` (`4/4`): `validateDecisionInput` (enum, required `editedText` / `comment` on edit/reject, `<=500` chars, NUL-byte guard), `applyAcceptedEditsToDocument` (end-to-start application, UTF-16 emoji `indexOf` fallback, non-accepted ignore, overlap skipping)
  - `security.test.mjs` (`1/1`): `poweredByHeader: false` + hardened headers
- `pnpm build` (`next build`) → **Exit code `0`** (`102 kB` shared JS, `/documents/[id]` `10.5 kB` / `125 kB`, `/documents/[id]/history` `168 B` / `106 kB`, `/api/review` & `/api/suggestions/[id]/decision` dynamic `ƒ`)

## 3. HTTP Route, API & UI Verification (`next start -p 3100` and `:3101`)

Verified against fresh production builds:

| Endpoint / Flow | Check / Condition | Observed Result |
| --- | --- | --- |
| `http://127.0.0.1:3100/api/health` | `GET` | `HTTP 200` `{"status":"ok","service":"brandguardian-web","supabase_configured":true,"ai_service_configured":true}` |
| `http://127.0.0.1:3101/api/health` (`AI_SERVICE_URL=http://127.0.0.1:9`) | `GET` | `HTTP 200` `{"status":"ok","service":"brandguardian-web","supabase_configured":true,"ai_service_configured":true}` |
| `/api/review` | `GET` / Unauth `POST` / Bad JSON / Bad UUID / Missing UUID | `405` / `401` / `400` / `400` / `404` |
| `/api/suggestions/[id]/decision` | `GET` / Unauth `POST` (valid & invalid UUID) | `405` / `401` `{"error":"Unauthorized"}` / `401` `{"error":"Unauthorized"}` |
| `/api/suggestions/[id]/decision` | Auth invalid UUID / JSON / enum / empty edit / empty reject / `>500` chars / Missing UUID | All invalid inputs → `400` (`"A rejection reason is required..."` etc.); missing suggestion UUID → `404` `{"error":"Suggestion not found."}` |
| `/documents/[id]` (`Asterra Flow Launch Draft`) | Headless Chromium (`1440px` & `375px`) | `<h1>` renders, `"Run review"`, `"Document Copy"`, `"Findings"`, `"Audit history"` visible, `0` horizontal overflow (`1440` & `375`), `0` console/page errors; clicking `"Run review"` without `SUPABASE_SERVICE_ROLE_KEY`/`AI_SERVICE_TOKEN` shows honest `503` inline alert |
| `/documents/[id]/history` | Headless Chromium (`1440px` & `375px`) | Renders `<h1>Document Audit History</h1>`, honest empty state when no events exist, `"Back to document"` navigation passes, `0` overflow (`1440` & `375`), `0` console/page errors |

## 4. Security, Audit Isolation & Secret Checks

- `.next/static/**/*.js` scan for `SUPABASE_SERVICE_ROLE_KEY`, `DEMO_PASSWORD`, `GROQ_API_KEY`, `AI_SERVICE_TOKEN` → **0 hits**.
- `'use client'` source scan for `SUPABASE_SERVICE_ROLE_KEY`, `DEMO_PASSWORD`, `DEMO_EMAIL`, `GROQ_API_KEY`, `AI_SERVICE_TOKEN` → **0 hits**.
- `git grep -n "audit_events" web/` → only server-side `createAdminClient()` inserts in [`web/app/api/review/route.ts`](../web/app/api/review/route.ts) (`review.completed`) and [`web/app/api/suggestions/[id]/decision/route.ts`](../web/app/api/suggestions/[id]/decision/route.ts) (`decision.recorded`, `document.reviewed`); zero user-client inserts.

## 5. Pending `USER-RUN` / Blocked Checks (Missing Server Env Secrets & SQL Editor)

Because boolean env checks detected `SUPABASE_SERVICE_ROLE_KEY` missing in `web/.env.local` and `AI_SERVICE_TOKEN` missing in both `ai-service/.env` and `web/.env.local` (values never read/printed), live end-to-end DB review/decision persistence tests could not execute against Supabase/FastAPI and remain **USER-RUN**:
1. Set `SUPABASE_SERVICE_ROLE_KEY` in `web/.env.local`, and set a matching `AI_SERVICE_TOKEN` in both `ai-service/.env` and `web/.env.local`, then restart `ai-service` (`:8000`) and `web` (`:3000`).
2. **M2 live review**: Open seeded Asterra draft on `/documents/[id]` → click **Run review** → verify 4 findings (`consumers`, `founded in 2019` citing `2021` fact, `cheapest and best`, `guarantee 300% revenue growth...`), `Verified`/`Unverified` badges, hard refresh persistence, and concurrent `409` on double-submit.
3. **M2 degraded modes**: Test FastAPI unreachable (`AI_SERVICE_URL=http://127.0.0.1:9`) → `502` + `'failed'` run + `0` findings; test wrong `GROQ_API_KEY` on `ai-service` → `ai_status: "unavailable"`, deterministic findings saved + `AiStatusBanner`; restore valid `GROQ_API_KEY`; test prompt-injection draft.
4. **M3 live decisions & history**:
   - Confirm High/Critical findings start with Evidence collapsed and `Accept` disabled until clicking **Inspect evidence**.
   - Submit **Reject** with blank reason → confirm inline `400` error (`"A rejection reason is required..."`).
   - Record **Accept** / **Edit** / **Reject** / **Dismiss** decisions across findings → confirm persistence across hard refresh (`Ctrl+Shift+R`), second `POST` on the same suggestion returns `409`, **"Preview final text"** + **Copy** reflects accepted/edited text without altering stored draft, final decision updates status badge to `Reviewed`, and `/documents/[id]/history` shows `review.completed`, `decision.recorded`, and `document.reviewed` newest-first with actor names.
5. **Supabase SQL Editor**:
   - Run `supabase/tests/rls_checks.sql` & `supabase/migrations/0002_rls_hardening.sql`.
   - Run `supabase/tests/decision_rls.sql` (cases `a–d`, wrapped in `begin`/`rollback`).
   - **Apply `supabase/migrations/0003_audit_server_only.sql` ONLY AFTER a live decision test passes cleanly.**
