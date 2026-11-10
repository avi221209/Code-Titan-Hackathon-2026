# BrandGuardian — Project State

**Last Updated:** 2026-11-10  
**Current Milestone:** M3 — Human Workflow (`POST /api/suggestions/[id]/decision`, Decision Actions, Final-Text Preview, Audit History)  
**Milestone Status:** CODE + STATIC/UNIT/AUTH/UI STRUCTURE VERIFIED (`USER-RUN` pending `SUPABASE_SERVICE_ROLE_KEY` & `AI_SERVICE_TOKEN` for live DB review + decision + audit persistence E2E)  
**Next Phase:** Phase D QA Round & Tier B/Missing-Env Handoff

---

## Reality Check (M2 + M3 Empirical Verification)

- **Repository & Branch:** `E:/Plugins/Get Shit Done/Code Titan 2026/brandguardian` on `main`.
- **AI Service (`ai-service/`):**
  - `ai-service/main.py` untouched (`12 passed in 0.44s` via `.\ai-service\.venv\Scripts\python.exe -m pytest -q ai-service`).
  - Detached `uvicorn` running on `http://127.0.0.1:8000` (`GET /health` → `200`, `provider: "groq"`, `llm_configured: true`, `model: "openai/gpt-oss-20b"`).
- **Web (`web/`):**
  - `pnpm --dir web typecheck` & `--noUnusedLocals --noUnusedParameters`: **exit 0**.
  - `pnpm --dir web test`: **17/17 passed** (`m1.test.ts` 5 + `review.test.ts` 7 + `decision.test.ts` 4 + `security.test.mjs` 1).
  - `pnpm --dir web build`: **exit 0** (`102 kB` shared First Load JS, `/documents/[id]` `10.5 kB` / `125 kB`, `/documents/[id]/history` `168 B` / `106 kB`, `/api/suggestions/[id]/decision` dynamic `ƒ`).
  - Production server checks on `:3100` (`supabase_configured: true`, `ai_service_configured: true`):
    - M2: `/api/review` `GET` → `405`, unauth `POST` → `401`, invalid JSON/UUID → `400`, missing doc → `404`, two-pane UI at `1440px` & `375px` (`0` overflow), honest `503` UI error when server secrets unset.
    - M3: `/api/suggestions/<uuid>/decision` `GET` → `405`, unauth `POST` (valid & invalid UUID) → `401`, authenticated invalid UUID / JSON / enum / empty `editedText` / empty `comment` / `>500` chars → `400`, missing suggestion UUID → `404`; `/documents/[id]/history` `<h1>Document Audit History</h1>`, honest empty/event state, `0` overflow (`1440px` & `375px`), `0` console/page errors.
  - `git grep -n "audit_events" web/`: zero user-client inserts; all `audit_events` writes use `createAdminClient()` (`review.completed`, `decision.recorded`, `document.reviewed`).
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
| 7 | `pnpm build`, `tsc --noEmit`, `pnpm test`, `pytest`, secret grep clean | **PASS** | Verified empirically (`17/17` web tests, `12/12` pytest, `0` static/client secret hits) |

## M3 Acceptance Matrix

| # | Criterion | Status | Evidence / Notes |
| --- | --- | --- | --- |
| 1 | `POST /api/suggestions/[id]/decision` auth (`401`), validation (`400`), `404`, RLS insert (`42501` -> `403`, `23505` -> `409`), admin status + `decision.recorded` audit | **PARTIAL / USER-RUN** | Route/method/auth/validation/missing checks verified **PASS** on `:3100` (`405`/`401`/`400`/`404`); live RLS `409` duplicate decision & persistence remain **USER-RUN** pending `SUPABASE_SERVICE_ROLE_KEY` & `AI_SERVICE_TOKEN` |
| 2 | Findings UI actions (`Accept`/`Edit`/`Reject`/`Dismiss`), High/Critical Accept gate until Evidence opened, no-`suggested_text` hides Accept/Edit, role notice | **PARTIAL / USER-RUN** | Component logic & negative guards implemented cleanly; live finding click-through (`Accept` gate unlock, hard refresh persistence) awaits seeded completed review run (`USER-RUN`) |
| 3 | Every suggestion decided on latest completed run sets `documents.status = 'reviewed'` + `'document.reviewed'` audit | **USER-RUN** | Implemented via `admin` in `decision/route.ts`; live DB transition awaits `SUPABASE_SERVICE_ROLE_KEY` |
| 4 | `"Preview final text"` read-only end-to-start offset preview + Copy button (`applyAcceptedEditsToDocument`) | **PASS (Unit) / USER-RUN (Live UI)** | `4/4` unit tests in `decision.test.ts` (UTF-16 emoji fallback, overlap skipping, end-to-start edits); live UI click awaits live findings |
| 5 | `/documents/[id]/history` renders chronological `audit_events` + actor names + honest empty state | **PASS** | Verified on `:3100` (`<h1>Document Audit History</h1>`, honest empty state, `0` console errors, `0` overflow at `1440px` & `375px`); live event rows await DB review/decision writes |
| 6 | `supabase/tests/decision_rls.sql` & `supabase/migrations/0003_audit_server_only.sql` created (NOT applied) | **USER-RUN** | SQL files written & committed; run `decision_rls.sql` in SQL Editor, and apply `0003_audit_server_only.sql` **only after a decision test passes** |
