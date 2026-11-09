# BrandGuardian — Project State

**Last Updated:** 2026-11-09  
**Current Milestone:** M0 — Project Structure Only  
**Milestone Status:** COMPLETE (Pending Final Commit Verification)  
**Next Milestone:** M1 — Foundation (Supabase Auth SSR, Schema Application, RLS Verification, Demo Workspace Login)

---

## Reality Check (Empirically Verified)

- **Repository Root:** `E:/Plugins/Get Shit Done/Code Titan 2026/brandguardian` (isolated `git init` repository; parent `Get Shit Done` repo untouched).
- **Web (`web/`):** Next.js `15.5.29`, React `19.3.1`, TypeScript `5.9.3`, Tailwind CSS `3.4.19`, `@supabase/ssr` `0.5.2`. `tsc --noEmit` and `pnpm build` exit `0`.
- **AI Service (`ai-service/`):** Python `3.13.15` venv with FastAPI `0.162.2`, Pydantic `2.14.3`, `pytest 9.2.0`. `main.py`, `test_checks.py`, and `requirements.txt` copied verbatim from `_pack/ai-service/`. `pytest` passes `11/11` tests.
- **Database (`supabase/`):** `supabase/migrations/0001_schema.sql` contains lines 1–242 of `_pack/01_supabase_schema.sql` unchanged; `supabase/seed.sql` contains lines 244–301 (Asterra synthetic seed block). **Not applied to any live database.**
- **Endpoints:** All 7 web routes return HTTP `200`; `/api/health` returns HTTP `200`; `/api/review`, `/api/documents`, and `/api/suggestions/[id]/decision` return `{"error":"not_implemented"}` (`HTTP 501`); AI `/health` returns `HTTP 200`.

## Locked Architectural Decisions (M0)

1. **1:1 Finding & ReviewResponse Contract:** `web/lib/types/finding.ts` mirrors `ai-service/main.py` fields identically (`category`, `severity`, `matched_text`, `start_offset`, `end_offset`, `explanation`, `source_type`, `source_id`, `confidence`, `verification_status`, `origin`, `suggested_text`; `document_id`, `model_name`, `ai_status`, `ai_detail`, `findings`, `dropped`, `elapsed_ms`).
2. **Design Tokens:** Editorial SaaS tokens in `web/app/globals.css` and `web/tailwind.config.ts` (`#F7F5F0` warm paper, `#14171C` ink, `#0F6B6B` deep teal, crimson/burnt orange/amber/slate severity palette, `Fraunces`/`Inter`/`JetBrains Mono` via `next/font/google`, 8px spacing scale, focus rings, `prefers-reduced-motion`).
3. **Credential Isolation:** LLM provider keys remain strictly inside `ai-service/`. Web server-only Supabase admin client (`web/lib/supabase/admin.ts`) imports `server-only`.
4. **M0 Auth Boundary:** `web/middleware.ts` runs pass-through (`x-brandguardian-auth-mode: m0-passthrough`) on `(app)` and `/login` routes so M0 pages verify cleanly without premature auth lockouts.

## Open Blockers / Deferred to M1

- Apply `0001_schema.sql` and create demo auth users (`judge@brandguardian.demo`, `outsider@brandguardian.demo`) in Supabase before running `seed.sql`.
- Populate `web/.env.local` and `ai-service/.env` locally (never committed) when starting M1.
