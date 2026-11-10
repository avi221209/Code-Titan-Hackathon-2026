# BrandGuardian — Project State

**Last Updated:** 2026-11-10  
**Current Milestone:** M2 — Core Review Engine (`POST /api/review`, Findings & Evidence Workspace UI)  
**Milestone Status:** CODE + STATIC/UNIT/AUTH/UI STRUCTURE VERIFIED (`USER-RUN` pending `SUPABASE_SERVICE_ROLE_KEY` & `AI_SERVICE_TOKEN` for live DB/Groq E2E)  
**Next Milestone:** M3 — Human Workflow (`POST /api/suggestions/[id]/decision`, Decision Actions, Final-Text Preview, Audit History)

---

## Reality Check (M2 Empirical Verification)

- **Repository & Branch:** `E:/Plugins/Get Shit Done/Code Titan 2026/brandguardian` on `main`.
- **AI Service (`ai-service/`):**
  - `ai-service/main.py` untouched (`12 passed in 0.42s` via `.\ai-service\.venv\Scripts\python.exe -m pytest -q ai-service`).
  - Detached `uvicorn` running on `http://127.0.0.1:8000` (`GET /health` → `200`, `provider: "groq"`, `llm_configured: true`, `model: "openai/gpt-oss-20b"`).
- **Web (`web/`):**
  - `pnpm --dir web typecheck` & `--noUnusedLocals --noUnusedParameters`: **exit 0**.
  - `pnpm --dir web test`: **13/13 passed** (`m1.test.ts` 5 + `review.test.ts` 7 + `security.test.mjs` 1).
  - `pnpm --dir web build`: **exit 0** (`102 kB` shared First Load JS, `/documents/[id]` `7.5 kB` / `122 kB`, `/api/review` dynamic).
  - Production server checks on `:3100` (`ai_service_configured: true`, `supabase_configured: true`): `GET /api/review` → `405`, unauthenticated `POST /api/review` → `401`, invalid JSON/UUID → `400`, missing doc UUID → `404`, headless Chromium `/documents/[id]` two-pane UI verified at `1440px` & `375px` (`0` overflow, `0` page errors), missing `SUPABASE_SERVICE_ROLE_KEY`/`AI_SERVICE_TOKEN` returns honest `HTTP 503` inline alert and re-enables `"Run review"`.
  - Secret grep across `.next/static/**/*.js` and `'use client'` modules: **0 hits**.

## M2 Acceptance Matrix

| # | Criterion | Status | Evidence / Notes |
| --- | --- | --- | --- |
| 1 | Seeded Asterra copy saves expected findings (`consumers`, `founded in 2019`, `cheapest and best`, `guarantee 300%...`) | **USER-RUN** | Code/validator/UI implemented; blocked on live DB write because `SUPABASE_SERVICE_ROLE_KEY` (`web/.env.local`) & `AI_SERVICE_TOKEN` (`ai-service/.env`, `web/.env.local`) are unset |
| 2 | Deterministic findings show `verified`; AI findings without valid `rule_id` show `unverified` | **USER-RUN** | Enforced in `ai-service/main.py` (`pytest` 12/12) + `validateReviewResponse` + `VerificationBadge`; live DB E2E blocked on missing server secrets |
| 3 | FastAPI unreachable: run marks `failed` with clear error, `0` findings, no stuck `running` | **USER-RUN** | `markRunFailed` rollback implemented in `web/app/api/review/route.ts`; `:3101` `AI_SERVICE_URL=http://127.0.0.1:9` returned `/api/health` `200`, DB-write test blocked on `SUPABASE_SERVICE_ROLE_KEY` |
| 4 | Wrong `GROQ_API_KEY`: deterministic findings complete + honest `AiStatusBanner` | **USER-RUN** | Requires user temporarily testing an invalid `GROQ_API_KEY` after setting server secrets |
| 5 | Prompt injection leaves deterministic findings unchanged | **USER-RUN** | Guaranteed by `ai-service` (`pytest` tag-breakout + deterministic path); live DB run awaits server secrets |
| 6 | Hard refresh retains findings; concurrent double-click creates one run (`409` guard) | **USER-RUN** | Client `inFlightRef` lock + `90s` `classifyRunningReviews` (`4/4` unit tests) + server post-insert tie-break implemented; live DB run awaits server secrets |
| 7 | `pnpm build`, `tsc --noEmit`, `pnpm test` (`13/13`), `pytest` (`12/12`), secret grep clean | **PASS** | Verified empirically (`0` static/client secret hits, all builds and unit suites exit `0`) |
