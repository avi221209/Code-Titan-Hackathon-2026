# BrandGuardian

Evidence-backed brand compliance review workspace built with Next.js App Router, TypeScript, Tailwind CSS, Supabase (Auth, PostgreSQL, RLS), and a Python FastAPI AI verification service.

> **Current State:** **M0–M3 Implemented (`M4+` deployment/analytics not built yet).**  
> Includes Supabase Auth + RLS workspace isolation (M1), deterministic + Groq review execution via `POST /api/review` and two-pane findings workspace (M2), and human review decisions (`Accept` / `Edit` / `Reject` / `Dismiss`), High/Critical evidence-inspection gating, read-only `"Preview final text"` + Copy, and `/documents/[id]/history` chronological audit trail (M3). See `.planning/DECISIONS_NEEDED.md` and `docs/test-evidence.md` for missing server secrets (`SUPABASE_SERVICE_ROLE_KEY`, `AI_SERVICE_TOKEN`) required for live DB writes (`USER-RUN`).

---

## Monorepo Architecture

```text
brandguardian/
├── web/                  # Next.js 15 App Router frontend + BFF route handlers
├── ai-service/           # Python FastAPI deterministic + LLM checker/verifier service
├── supabase/
│   ├── migrations/       # DDL + RLS (`0001_schema.sql`), hardening (`0002` USER-RUN), audit lock (`0003` USER-RUN post-test)
│   ├── seed.sql          # Synthetic "Asterra" & "Northwind" workspace seed data
│   └── tests/            # SQL impersonation checks (`rls_checks.sql`, `decision_rls.sql`)
├── docs/                 # Architecture, limitations, AI disclosure, and test evidence
└── .planning/            # State, QA matrix, defect log, decisions needed, autonomous report
```

---

## Implemented Routes & APIs (M1–M3)

| Surface | Status | Behavior |
| --- | --- | --- |
| `/` | Implemented | Public landing page linking to `/login` and `/dashboard` |
| `/login` | Implemented | Demo workspace button (server-only creds) + email/password login; redirects signed-in users to `/dashboard` |
| `/dashboard` | Implemented | Real RLS-scoped workspace name, role badge, knowledge counts, recent draft documents |
| `/knowledge` | Implemented | Read-only tabbed ledger for Rules, Facts, and Terminology via USER RLS client |
| `/documents/new` | Implemented | Draft editor (`<= 6,000` chars) with `"Load Asterra sample"` and validation |
| `/documents/[id]` | Implemented | Two-pane copy + findings review workspace (`Run review`, severity/offset sorting, collapsible High/Critical evidence panels, human decision actions, read-only `"Preview final text"` + Copy) |
| `/documents/[id]/history` | Implemented | Chronological `audit_events` timeline (`review.completed`, `decision.recorded`, `document.reviewed`) with actor resolution and honest empty state |
| `GET /api/health` | Implemented | Returns runtime configuration booleans (`200`) |
| `GET / POST /api/documents` | Implemented | Authenticated USER-client workspace read/insert (`200` / `201` / `400` / `401` / `403`) |
| `POST /api/review` | Implemented | Auth + body check -> USER knowledge fetch -> FastAPI `/review` (`x-api-key`) -> ADMIN persistence of `review_runs`, `findings`, `suggestions`, `audit_events` (`90s` stale lock, atomic `markRunFailed` rollback) |
| `POST /api/suggestions/[id]/decision` | Implemented | Auth + UUID/payload validation -> USER RLS `review_decisions` insert (`403`/`409` mapped) -> ADMIN status/audit update + `documents.status = 'reviewed'` when all latest-run suggestions are decided |

---

## Prerequisites

- **Node.js** `>= 20` (tested on `v24.14.0`) and **pnpm**
- **Python** `>= 3.11` (tested on `3.13.15`) and **uv** or **pip**
- **Supabase** project with `0001_schema.sql` & `seed.sql` applied and demo auth users created
- **Ollama** (local mode, e.g. `qwen2.5:3b`) or **Groq** API key configured inside `ai-service/.env`

---

## Local Setup

### 1. Environment Templates

Copy templates locally without committing secrets (`.env*` is gitignored):

- **Web (`web/.env.example` -> `web/.env.local`):**
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `DEMO_EMAIL` and `DEMO_PASSWORD` *(server-only; read exclusively in `web/lib/env.ts` `getDemoCredentials()`)*
  - `SUPABASE_SERVICE_ROLE_KEY`, `AI_SERVICE_URL`, `AI_SERVICE_TOKEN` *(required server-side for `POST /api/review` and admin status/audit updates in M2/M3)*
- **AI Service (`ai-service/.env.example` -> `ai-service/.env`):**
  - `AI_SERVICE_TOKEN` *(must match `web/.env.local`)*, `LLM_PROVIDER=groq` (default in `.env.example`) or `ollama`, plus `GROQ_API_KEY` / `GROQ_MODEL` (`openai/gpt-oss-20b`).

### 2. Web Application (`web/`)

```bash
cd web
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm start
```

Note: ESLint (`pnpm lint`) is not yet configured in `web/package.json` (`[DEF-09]`, awaiting Tier B approval).

### 3. Python AI Microservice (`ai-service/`)

```bash
cd ai-service
uv venv .venv
.venv\Scripts\activate
uv pip install -r requirements.txt
python -m pytest -v
uvicorn main:app --host 127.0.0.1 --port 8000 --env-file .env
```

### 4. Database & RLS Verification (`supabase/`)

1. Apply `supabase/migrations/0001_schema.sql` in Supabase SQL Editor.
2. Create `judge@brandguardian.demo` and `outsider@brandguardian.demo` in Supabase Auth, then run `supabase/seed.sql`.
3. Apply `supabase/migrations/0002_rls_hardening.sql` (`[DEF-10]`) and run `supabase/tests/rls_checks.sql` (cases `a`–`g` + `pg_policies` summary) in the Supabase SQL Editor.
4. Run `supabase/tests/decision_rls.sql` (cases `a`–`d`, wrapped in `begin`/`rollback`).
5. **Only after a live M3 decision test passes**, apply `supabase/migrations/0003_audit_server_only.sql` to lock `audit_events` inserts strictly to the server `service_role`.

---

## Security Boundaries

1. **Client & Bundle Secret Isolation:** `web/lib/env.ts`, `web/lib/supabase/admin.ts`, `web/lib/profiles.ts`, and `web/lib/workspace.ts` enforce `import 'server-only'`. `DEMO_EMAIL`, `DEMO_PASSWORD`, `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`, and `AI_SERVICE_TOKEN` never enter client components or `.next/static/*.js`.
2. **Strict Separation of User RLS vs Server Admin Writes:** Knowledge reads, document submissions, and `review_decisions` inserts run via `createClient()` (`web/lib/supabase/server.ts`) under PostgreSQL RLS so `creator` roles cannot decide (`42501`) and duplicates return `409` (`23505`). Server-owned records (`review_runs`, `findings`, `suggestions`, workflow status updates, and `audit_events`) execute via `createAdminClient()` (`server-only`).
3. **LLM Credential Isolation & Auth Ordering:** `GROQ_API_KEY` lives strictly inside `ai-service/.env` and is never read by `web/`. `POST /review` checks `x-api-key` via `Depends(require_key)` before request schema validation (`401`).
4. **Response Headers & Error Boundaries:** `web/next.config.mjs` sets `poweredByHeader: false`, `Content-Security-Policy`, `Permissions-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and `Referrer-Policy`. `web/app/error.tsx` displays fixed fallback copy without raw `error.message`.

---

## Documentation Index

- [System Architecture](docs/architecture.md)
- [Known Limitations](docs/limitations.md)
- [AI Assistance & Governance Disclosure](docs/ai-disclosure.md)
- [Verification & Test Evidence](docs/test-evidence.md)
- [QA Matrix](.planning/QA.md)
- [Defect Log](.planning/DEFECTS.md)
- [Decisions Needed](.planning/DECISIONS_NEEDED.md)
