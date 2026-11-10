# BrandGuardian Submission Readiness Checklist

> **Roadmap Section 11 Verification Note:** The local resource pack (`_pack/02_RESOURCES_AND_ANTIGRAVITY_LOOP.md`) includes **Sections 0–10 only**; the external **Roadmap PDF Section 11** document was **not present** in the repository or pack. Items below cover every verified Round 2 build, security/RLS, deployment, testing, and documentation requirement from Sections 0–10 plus explicit Section 11 cross-check markers.  
> **Strict Status Legend:** **`Done`** (verified in repo with observed evidence) · **`USER`** (requires Project Owner credentials, host accounts, manual SQL Editor, or placeholder completion) · **`Missing`** (not present in workspace / unbuilt).

---

## Checklist

| # | Area | Deliverable / Verification Item | Status | Notes / Action |
| --- | --- | --- | --- | --- |
| 1 | **Roadmap Cross-Check** | Verify external **Roadmap PDF Section 11** checklist items verbatim against repo | **`Missing`** | External PDF Section 11 is absent from `_pack/`; **Project Owner (`USER`)** should inspect the PDF Section 11 table directly before final submission |
| 2 | **Repository & Git Hygiene** | Public GitHub repo `avi221209/Code-Titan-Hackathon-2026` on `main`, zero `.env*` secrets committed or in history | **`Done`** | Verified (`0` tracked secrets; clean push to `origin/main` pending latest docs commits) |
| 3 | **Schema & RLS Isolation** | Apply `0001_schema.sql`, synthetic Asterra/Northwind `seed.sql`, `0002_rls_hardening.sql` (`[DEF-10]`), and run `rls_checks.sql` (`cases a–g`, `14` tables, `0` `DELETE` grants) | **`Done`** | Executed by Project Owner in Supabase SQL Editor: `7 of 7` passed, `14` tables active, `0` `DELETE` grants |
| 4 | **M3 Decision RLS Check** | Run `supabase/tests/decision_rls.sql` (`cases a–d`) in Supabase SQL Editor | **`USER`** | SQL script committed & reviewed; execute manually (`begin` / `rollback`) |
| 5 | **Audit Insert Lock (`0003`)** | Apply `supabase/migrations/0003_audit_server_only.sql` **only after** live M3 decision test passes | **`USER`** | Committed & reviewed; apply in SQL Editor post-test |
| 6 | **Python AI Service Tests** | Deterministic checkers, `verify()`, prompt injection guard, invalid JSON, `Depends(require_key)` `401` (`pytest` `12/12`) | **`Done`** | Re-run fresh `2026-11-10` -> `12 passed in 0.55s` |
| 7 | **AI Service Container Prep** | Hardened `ai-service/Dockerfile` (Python slim, non-root `appuser`, `0.0.0.0:${PORT:-8000}`, no baked secrets) & `.dockerignore` | **`Done`** | Committed in `b503307`; local `docker build` test is **`USER`** (Docker CLI not installed locally) |
| 8 | **Web Typecheck, Unit Tests & Build** | `tsc --noEmit`, `--noUnusedLocals --noUnusedParameters`, `pnpm test` (`17/17`), local & isolated clean-env `next build`, `maxDuration = 60`, `0` hardcoded prod `localhost` | **`Done`** | Verified empirically `2026-11-10` (`exit 0`, `17/17`, `CLEAN_BUILD_EXIT=0`) |
| 9 | **Production Route & UI Layout Smoke** | Negative/auth API tests (`405`/`401`/`400`/`404`/`503`) + Playwright `1440px`/`375px` `0` overflow & `0` console errors | **`Done`** | Verified against local `next start` (`:3100`/`:3101`) `2026-11-10` |
| 10 | **Cloud Deployment (`ai-service` + `web`)** | Deploy `ai-service/` to Render/Railway -> `<AI_URL>`, deploy `web/` to Vercel (root `web`) -> `<WEB_URL>`, rotate production keys, update Supabase Auth Site/Redirect URLs | **`USER`** | Step-by-step instructions ready in [`docs/deployment.md`](deployment.md) |
| 11 | **Live M2/M3 E2E + Incognito Check** | Run live Asterra review, degraded modes (`502` / wrong Groq key / prompt injection), High/Critical Evidence unlock, **Accept/Edit/Reject/Dismiss**, `documents.status = 'reviewed'`, `/history`, incognito check on `<WEB_URL>` | **`USER`** | Tracked in [`docs/test-evidence.md`](test-evidence.md) Section 4 & [`docs/deployment.md`](deployment.md) Section 6 |
| 12 | **Documentation & Submission Pack** | `README.md`, `deployment.md`, `features.md`, `architecture.md`, `ai-disclosure.md`, `test-evidence.md`, `limitations.md`, `round3-roadmap.md`, `contributions.md`, `submission-checklist.md` | **`Done`** | Written & grounded strictly in verified evidence (`README.md` URLs & `contributions.md` `[placeholder]`s remain **`USER`** to fill before final submission) |
| 13 | **Fill URL & Member Placeholders** | Replace `<WEB_URL>`, `<AI_URL>`, Groq latency numbers, and team member `[placeholder]` fields in `README.md`, `docs/test-evidence.md`, `docs/contributions.md` | **`USER`** | Must be filled after cloud deploy & team sign-off |
| 14 | **Deferred / Out-of-Scope Items** | ESLint/postcss (`[DEF-09]`), SSR auth latency (`[DEF-11]`), soft-404 status (`[DEF-12]`); unbuilt PDF/DOCX, image/logo checks, analytics UI, comments UI, reviewer assignment | **`Missing`** | Deliberately deferred (Tier B) or out-of-scope for Round 2; documented honestly in [`docs/features.md`](features.md) & [`docs/limitations.md`](limitations.md) |
