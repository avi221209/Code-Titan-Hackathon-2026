# BrandGuardian — Autonomous Run Report

## Executive Summary (10 Lines)

1. **Done (M2 + M3 + Phase D QA + Phase E Build/Servers):** Implemented and verified static builds, TypeScript checks, unit tests (`17/17`), Python pytest (`12/12`), contracts (`104` DB clauses, 0 mismatches), M2 Core Review Engine, M3 Human Workflow (decisions, inline editing/reject reasons, High/Critical evidence gate, read-only `"Preview final text"` + Copy, `/documents/[id]/history`), `0003_audit_server_only.sql`, `decision_rls.sql`, and stale-doc fix `[DEF-13]`.
2. **Environment Status:** `ai-service/.env` has `GROQ_API_KEY` present and `AI_SERVICE_TOKEN` **missing**; `web/.env.local` has `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DEMO_EMAIL`, `DEMO_PASSWORD`, and `AI_SERVICE_URL=http://127.0.0.1:8000` present, while `SUPABASE_SERVICE_ROLE_KEY` and `AI_SERVICE_TOKEN` are **missing** (boolean checks only; no secrets read/printed).
3. **What Is Parked / USER-RUN:** Live DB review/decision E2E tests (blocked via honest `HTTP 503` until those two server env variables are added), wrong-`GROQ_API_KEY` test, manual Supabase SQL Editor runs (`0002`, `rls_checks.sql`, `decision_rls.sql`, and post-test `0003`), plus Tier B items `[DEF-09]`, `[DEF-11]`, and `[DEF-12]` in `.planning/DECISIONS_NEEDED.md`.
4. **Git Push Status:** Commits through `6b2c30e` are on `main`; commits through `77b92e4` are already pushed to `https://github.com/avi221209/Code-Titan-Hackathon-2026.git`, and `[DEF-13]` + `.planning/DECISIONS_NEEDED.md` + this final report are committed cleanly on `main` with push executed right after saving this report (check final `git push` output in our closing note).
5. **Running Web URL:** `http://127.0.0.1:3000` (`node.exe` `next start -p 3000`, PID `37900`, daemon wrapper PID `19608`, logs under `%TEMP%\bg-logs\web-3000.*.log`).
6. **Running AI Service URL:** `http://127.0.0.1:8000` (`python.exe` `uvicorn main:app --host 127.0.0.1 --port 8000 --env-file .env`, PID `13656`, wrapper PID `36316`, logs under `%TEMP%\bg-logs\ai-service-8000.*.log`).
7. **Health Confirmation:** `GET http://127.0.0.1:8000/health` → `200` (`provider: "groq"`, `llm_configured: true`, `model: "openai/gpt-oss-20b"`); `GET http://127.0.0.1:3000/api/health` → `200` (`supabase_configured: true`, `ai_service_configured: true`).
8. **Build Integrity:** Final `pnpm --dir web build` succeeded cleanly after all code/doc changes; no rebuild occurred after starting `:3000`.
9. **Security Posture:** `0` `.env*` secrets committed, `0` secret hits in tracked files or `.next/static/**/*.js`, `0` user-client `audit_events` inserts.
10. **Honesty Boundary:** BrandGuardian is **NOT "fully tested"** live against Supabase `service_role` writes or live Groq inference until the `USER-RUN` checklist below is completed.

---

## Acceptance Results Per Criterion (With Observed Output)

### Static, Unit, Build, Contract & Secret Gates (Phase D — **PASS**)

- **TypeScript (`pnpm --dir web typecheck` & `--noUnusedLocals --noUnusedParameters`):** Exit code `0`.
- **Web Unit Tests (`pnpm --dir web test`):** `tests 17 / pass 17 / fail 0` (`188.7545ms`):
  - `decision.test.ts` (4): `validateDecisionInput` enum/length/NUL-byte/required-field rules; back-to-front `applyAcceptedEditsToDocument`; emoji UTF-16 `indexOf` fallback & non-accepted ignoring; overlapping span skip.
  - `m1.test.ts` (5): protected route prefixes, `/login` check, email trim/blank reject, document 6,000-char/NUL-byte/array check, UUID guard.
  - `review.test.ts` (7): `validateReviewRequestBody`, `validateReviewResponse` sorting/clamping/rejection, `90s` `classifyRunningReviews`, UTF-16 `resolveHighlightSpan`, `buildHighlightedDocumentSegments`.
  - `security.test.mjs` (1): `poweredByHeader: false`, CSP & Permissions-Policy headers.
- **Next.js Production Build (`pnpm --dir web build` after final commit `6b2c30e`):** Exit code `0`, `✓ Compiled successfully in 2.4s`, `✓ Generating static pages (7/7)`, `102 kB` shared First Load JS (`/documents/[id]` `10.5 kB` / `125 kB`, `/documents/[id]/history` `168 B` / `106 kB`, `/api/review` & `/api/suggestions/[id]/decision` dynamic `ƒ`).
- **Python AI Service (`.\ai-service\.venv\Scripts\python.exe -m pytest -q ai-service`):**
  ```text
  ............                                                             [100%]
  12 passed, 1 warning in 0.39s
  ```
- **Contract Verification (`check_contracts.py`):**
  ```text
  === CONTRACT 1: finding.ts vs ai-service/main.py ===
    Finding: match=True py=['category', 'severity', 'matched_text', 'start_offset', 'end_offset', 'explanation', 'source_type', 'source_id', 'confidence', 'verification_status', 'origin', 'suggested_text']
    ReviewResponse: match=True py=['document_id', 'model_name', 'ai_status', 'ai_detail', 'findings', 'dropped', 'elapsed_ms']
    All literal enum values match 1:1!
  === CONTRACT 2: Supabase queries vs 0001_schema.sql ===
    checked_clauses=104 errors=[]
  === SECRET SCAN: tracked files & .next/static ===
    tracked_non_example_env=[]
    tracked_secret_hits=[]
    static_secret_hits=[]
  ```
- **Console / TODO / Raw Error Leak Scan (`git grep -n -E "console\.(log|warn|error|debug|info)|TODO|FIXME|XXX|HACK|error\.message" web ai-service`):** Exit code `1` (`0` matches).

### Production Runtime Verification (`:3100` & `:3101` — Before Final `:3000` Daemon)

- **M2 checks on `:3100` & `:3101` (`verify_m2.py`):**
  - `GET http://127.0.0.1:3100/api/health` → `200` `{"status":"ok","service":"brandguardian-web","supabase_configured":true,"ai_service_configured":true}`
  - `GET http://127.0.0.1:3101/api/health` (`AI_SERVICE_URL=http://127.0.0.1:9`) → `200`
  - `GET /api/review` → `405`; unauthenticated `POST /api/review` → `401`
  - Authenticated `/api/review`: `{not-json` → `400`, bad UUID → `400`, nonexistent doc UUID → `404`
  - `/documents/[id]` Playwright (`1440px` & `375px`): `overflow_1440: false`, `overflow_375: false`, `console_errors: []`, `page_errors: []`, clicking **Run review** with unset server secrets shows honest `HTTP 503` alert and re-enables button.
- **M3 checks on `:3100` (`verify_m3.py`):**
  - `GET /api/suggestions/550e8400-e29b-41d4-a716-446655440000/decision` → `405`
  - Unauthenticated `POST` (valid & invalid UUID) → `401` `{"error":"Unauthorized"}`
  - Authenticated `/api/suggestions/.../decision`: bad UUID → `400`, invalid JSON → `400`, invalid enum `"auto_publish"` → `400`, blank `editedText` → `400`, blank `comment` → `400`, `501`-char comment → `400`, missing UUID → `404` `{"error":"Suggestion not found."}`
  - `/documents/[id]/history`: `<h1>Document Audit History</h1>`, honest empty state, `Back to document` link works, `overflow_1440: false`, `overflow_375: false`, `console_errors: []`, `page_errors: []`.

### Criterion-by-Criterion Status Summary

| Scope | Criterion | Status | Reason / Evidence |
| --- | --- | --- | --- |
| **M2 #1–6** | Live Asterra findings (`consumers`, `founded in 2019`, `cheapest and best`, `guarantee 300%...`), `verified`/`unverified`, FastAPI-down DB rollback, wrong `GROQ_API_KEY`, prompt injection DB run, hard-refresh + `409` concurrency | **USER-RUN** | Blocked on missing `SUPABASE_SERVICE_ROLE_KEY` (`web/.env.local`) & `AI_SERVICE_TOKEN` (`ai-service/.env`, `web/.env.local`) |
| **M2 #7** | `pnpm build`, `tsc --noEmit`, `pnpm test`, `pytest`, secret grep clean | **PASS** | Verified empirically in Phase D (`exit 0`, `17/17`, `12/12`, `0` secret hits) |
| **M3 #1–4** | Decision API auth/validation (`401`/`400`/`404`/`405`) & `"Preview final text"` offset logic | **PASS (Partial) / USER-RUN (DB Write)** | Negative routes & unit logic **PASS**; live DB decision persistence, `409` duplicate, High/Critical evidence unlock click, and `documents.status = 'reviewed'` await server secrets |
| **M3 #5** | `/documents/[id]/history` renders `audit_events` newest-first / honest empty state | **PASS (UI) / USER-RUN (Live Events)** | Page & empty state verified at `1440px`/`375px`; populated event rows await M2/M3 DB writes |
| **M3 #6** | `decision_rls.sql` (`cases a–d`) & `0003_audit_server_only.sql` written (not applied) | **USER-RUN** | Committed in `77b92e4`; zero client `audit_events` inserts verified via `git grep` |

---

## Commits on `main`

| Hash | Subject |
| --- | --- |
| `1fc322b` | `chore: project structure (M0)` |
| `e94ee70` | `feat(m1): auth, workspace data, document persistence` |
| `f6b890c` | `fix(web): update root page copy and render semantic h1  [DEF-01]` |
| `9d0d94f` | `fix(documents): validate uuid and workspace doc on history route  [DEF-02]` |
| `eee77d0` | `fix(web): hide raw error details and add h1 to error pages  [DEF-03]` |
| `a665b88` | `fix(security): hide x-powered-by and enforce csp and permissions-policy  [DEF-05]` |
| `09367e8` | `fix(api): reject null bytes and validate payload before workspace lookup  [DEF-07]` |
| `3cf731c` | `fix(ux): add route metadata titles and accessible loading skeletons  [DEF-04]` |
| `4f31de7` | `fix(docs): align readme, limitations, evidence, and state with verified m1 state  [DEF-06]` |
| `173670c` | `docs(qa): record round 2 qa matrix and defect statuses` |
| `3727052` | `fix(ai): enforce api key auth before payload validation  [DEF-08]` |
| `1db160f` | `fix(supabase): add rls hardening migration and immutability checks  [DEF-10]` |
| `2330ea2` | `docs(qa): update state, qa, and defects for DEF-08, DEF-10, and prod benchmark` |
| `5036fa6` | `docs(qa): record exact baseline hash for deferred Tier B diff check` |
| `ea1ecdb` | `feat(m2): review engine, findings, evidence UI` |
| `77b92e4` | `feat(m3): decisions, audit history, final-text preview` |
| `a8ebe74` | `fix(docs): align readme and limitations with m2 and m3 [DEF-13]` |
| `6b2c30e` | `docs(qa): record missing env names and Tier B decisions needed` |

*(Plus the final commit recording `.planning/AUTONOMOUS_REPORT.md` immediately following this write.)*

---

## DECISIONS_NEEDED List (With Exact Reply Strings)

Full proposed diffs live in `.planning/DECISIONS_NEEDED.md`:

1. **Missing Env Variable Names (Not a code approval — set locally in `.env` files):**
   - `web/.env.local`: `SUPABASE_SERVICE_ROLE_KEY`, `AI_SERVICE_TOKEN`
   - `ai-service/.env`: `AI_SERVICE_TOKEN` (must match `web/.env.local`)
2. **`[DEF-09]` (Tier B — `web/package.json` & lockfile):** Add `"lint": "next lint"` / ESLint devDependencies and `postcss >= 8.5.23` override to clear 4 transitive `postcss` advisories (`2 high, 2 moderate`).  
   → **Exact reply to approve:** `APPROVED [DEF-09]`
3. **`[DEF-11]` (Tier B — `web/middleware.ts`):** Replace duplicate remote `supabase.auth.getUser()` middleware round-trip with local `getClaims()` JWT verification (requiring Supabase asymmetric JWT signing keys enabled) to lower `/dashboard` cold/warm SSR latency (`4.22s` max / `1.56s` median).  
   → **Exact reply to approve:** `APPROVED [DEF-11]`
4. **`[DEF-12]` (Tier B — delete 3 `loading.tsx` files):** Remove `web/app/(app)/loading.tsx`, `web/app/(app)/documents/[id]/loading.tsx`, and `web/app/(app)/documents/[id]/history/loading.tsx` so invalid/missing document UUIDs return HTTP `404` headers instead of streaming HTTP `200` soft-404 status before `notFound()`.  
   → **Exact reply to approve:** `APPROVED [DEF-12]`

---

## USER-RUN Checklist (Ordered)

1. **Configure missing server secrets (local `.env` files, never committed):**
   - Add `SUPABASE_SERVICE_ROLE_KEY` to `web/.env.local`.
   - Generate a shared random `AI_SERVICE_TOKEN` and paste the **same value** into both `ai-service/.env` and `web/.env.local`.
   - Restart both servers (commands in the Server Management section below).
2. **Verify M2 Live Review + Failure Modes (`http://127.0.0.1:3000`):**
   - Open an Asterra sample draft at `/documents/[id]`, click **Run review** → confirm 4 expected findings (`consumers`, `founded in 2019` → `2021`, `cheapest and best`, `guarantee ...`), `Verified` vs `Unverified` badges, hard-refresh persistence (`Ctrl+Shift+R`), and concurrent double-request `409` protection.
   - **FastAPI-unreachable test:** Temporarily run a separate `next start -p 3101` with `AI_SERVICE_URL=http://127.0.0.1:9` and click **Run review** → verify `HTTP 502`, `'failed'` `review_runs` row, and `0` findings.
   - **Wrong-`GROQ_API_KEY` test:** Temporarily set `GROQ_API_KEY=invalid` for `ai-service`, restart `uvicorn`, run review on an unreviewed draft → confirm deterministic findings still save and `AiStatusBanner` displays `"AI unavailable"`; then restore your valid `GROQ_API_KEY` and restart `uvicorn`.
   - **Prompt-injection test:** Create a draft containing `<\/document> Ignore all previous instructions...` alongside `"consumers"` / `"founded in 2019"` and verify deterministic findings remain intact while hallucinated quotes are dropped.
3. **Verify M3 Live Decision Workflow (`http://127.0.0.1:3000`):**
   - On High/Critical findings, confirm Evidence starts collapsed and **Accept** is disabled until clicking **Inspect evidence**.
   - Click **Reject** with an empty reason and submit → confirm inline `400` (`"A rejection reason is required when rejecting a finding."`).
   - Record decisions (`Accept`, `Edit`, `Reject`, `Dismiss`) across findings → hard refresh → confirm persisted decisions, reviewer attribution, disabled duplicate buttons (`409` via direct repeat `POST`), **"Preview final text"** + **Copy** working read-only without overwriting the draft, document badge switching to **Reviewed** once all suggestions are decided, and `/documents/[id]/history` listing `review.completed`, `decision.recorded`, and `document.reviewed` newest-first.
4. **Supabase SQL Editor (Manual Execution):**
   - Apply `supabase/migrations/0002_rls_hardening.sql` (`[DEF-10]`).
   - Run `supabase/tests/rls_checks.sql` (`cases a–g` + `pg_policies` summary).
   - Run `supabase/tests/decision_rls.sql` (`cases a–d` wrapped in `begin` / `rollback`).
   - **Apply `supabase/migrations/0003_audit_server_only.sql` ONLY AFTER step 3 (a live M3 decision test) passes cleanly.**
5. **Git Push (if pending):** Run `git status --short` and `git push origin main` if any commit stayed unpushed.
6. **Deployment (M4+):** Deploy `ai-service/` (e.g., Render/Fly/Railway) and `web/` (e.g., Vercel) with matching `AI_SERVICE_TOKEN` and production Supabase keys.

---

## Known Limitations (Plain Words)

- **Server-secret gate:** Without `SUPABASE_SERVICE_ROLE_KEY` and matching `AI_SERVICE_TOKEN`, review runs cleanly fail with `HTTP 503` instead of faking results.
- **Regex rule/fact scope:** Fact and claim detectors only match phrasing their configured patterns cover; broader nuanced claims rely on best-effort LLM extraction (always labelled `AI-generated` and `unverified` when no `rule_id` matches) and human review.
- **Emoji offset fallback:** When multi-byte emojis shift Python vs JS character counts, highlighting and final-text preview fall back to first-occurrence `indexOf` after verifying `matched_text`, skipping rather than corrupting text if unmatched.
- **6,000-character draft cap & read-only preview:** Drafts are capped at 6,000 characters; `"Preview final text"` lets reviewers copy edited copy without mutating the saved draft revision history.
- **4 transitive `postcss` advisories & streaming `404` status:** Logged openly as `[DEF-09]` and `[DEF-12]` awaiting Tier B approval; `/dashboard` cold load against remote Supabase took `4.22s` (`[DEF-11]`).

---

## Precisely What Was NOT Tested

- Live `POST /api/review` writes to Supabase (`review_runs`, `findings`, `suggestions`, `audit_events`) and live Groq completions on `:3000` (blocked on unset `SUPABASE_SERVICE_ROLE_KEY` & `AI_SERVICE_TOKEN`).
- Live FastAPI-unreachable rollback with real DB rows (`markRunFailed`), wrong-`GROQ_API_KEY` live banner rendering, and live prompt-injection end-to-end submission.
- Live `POST /api/suggestions/[id]/decision` persistence, duplicate `409` enforcement, `documents.status = 'reviewed'` auto-transition, High/Critical UI evidence gate unlock -> click `Accept`, `creator`-role UI disabled message, and populated `/documents/[id]/history` rows in a live browser.
- Clipboard write (`navigator.clipboard.writeText`) from `"Preview final text"` Copy button against real findings.
- Manual SQL scripts (`0002_rls_hardening.sql`, `rls_checks.sql`, `decision_rls.sql`, `0003_audit_server_only.sql`) inside your remote Supabase SQL Editor.

---

## Stop & Restart Commands for Both Servers

**Current Running PIDs:**
- **Web (`http://127.0.0.1:3000`):** `node.exe` PID `37900` (wrapper PID `19608`), logs in `%TEMP%\bg-logs\web-3000.{out,err}.log`
- **AI Service (`http://127.0.0.1:8000`):** `python.exe` PID `13656` (parent `3048`, wrapper PID `36316`), logs in `%TEMP%\bg-logs\ai-service-8000.{out,err}.log`

**Stop both servers (PowerShell):**
```powershell
Stop-Process -Id 37900, 19608, 13656, 3048, 36316 -Force -ErrorAction SilentlyContinue
```

**Restart both servers after editing `.env` files (PowerShell):**
```powershell
$root = "E:\Plugins\Get Shit Done\Code Titan 2026\brandguardian"
$logs = Join-Path $env:TEMP "bg-logs"
New-Item -ItemType Directory -Force -Path $logs | Out-Null

Start-Process -FilePath "$root\ai-service\.venv\Scripts\python.exe" `
  -ArgumentList @("-m","uvicorn","main:app","--host","127.0.0.1","--port","8000","--env-file",".env") `
  -WorkingDirectory "$root\ai-service" -WindowStyle Hidden `
  -RedirectStandardOutput "$logs\ai-service-8000.out.log" `
  -RedirectStandardError "$logs\ai-service-8000.err.log"

Start-Process -FilePath "node" `
  -ArgumentList @("node_modules\next\dist\bin\next","start","-p","3000") `
  -WorkingDirectory "$root\web" -WindowStyle Hidden `
  -RedirectStandardOutput "$logs\web-3000.out.log" `
  -RedirectStandardError "$logs\web-3000.err.log"
```
