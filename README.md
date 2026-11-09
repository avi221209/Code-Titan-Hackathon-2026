# BrandGuardian

Evidence-backed brand compliance review workspace built with Next.js App Router, TypeScript, Tailwind CSS, Supabase (Auth, PostgreSQL, RLS), and a Python FastAPI AI verification service.

> **Current Milestone:** **M1 — Foundation (Auth, Workspace Knowledge, Document Persistence, RLS Isolation)** *(with QA-Fix Tier A hardening applied).*  
> M0 established the monorepo, design tokens, typed API contracts, Supabase client boundaries, and FastAPI deterministic/LLM verifier. M1 adds cookie-based Supabase Auth (demo workspace login + email/password + sign-out), middleware route protection, RLS-scoped `/dashboard` and `/knowledge` views, and draft creation/read-only persistence (`/documents/new`, `GET/POST /api/documents`, `/documents/[id]`). Review execution (`POST /api/review`, M2) and human decision workflows (`POST /api/suggestions/[id]/decision`, `/documents/[id]/history` audit timeline, M3) remain unimplemented stubs.

---

## Monorepo Architecture

```text
brandguardian/
├── web/                  # Next.js 15 App Router frontend + BFF route handlers
├── ai-service/           # Python FastAPI deterministic + LLM checker/verifier service
├── supabase/
│   ├── migrations/       # Idempotent PostgreSQL DDL + RLS policies (0001_schema.sql)
│   ├── seed.sql          # Synthetic "Asterra" & "Northwind" workspace seed data
│   └── tests/            # SQL impersonation checks for Supabase SQL Editor (rls_checks.sql)
├── docs/                 # Architecture, limitations, AI disclosure, and test evidence
└── .planning/            # Milestone specs (M0.md), state tracker (STATE.md), QA.md, DEFECTS.md
```

---

## Implemented Routes & APIs (M1)

| Surface | Status | Behavior |
| --- | --- | --- |
| `/` | Implemented | Public landing page linking to `/login` and `/dashboard` |
| `/login` | Implemented | Demo workspace button (server-only creds) + email/password login; redirects signed-in users to `/dashboard` |
| `/dashboard` | Implemented | Real RLS-scoped workspace name, role badge, knowledge counts, recent draft documents |
| `/knowledge` | Implemented | Read-only tabbed ledger for Rules, Facts, and Terminology via USER RLS client |
| `/documents/new` | Implemented | Draft editor (`<= 6,000` chars) with `"Load Asterra sample"` and validation |
| `/documents/[id]` | Implemented | Read-only persisted draft view with honest `"Review engine arrives in M2"` notice |
| `/documents/[id]/history` | Stub (M3) | Validates UUID & workspace document via RLS (`notFound()` if missing); renders M3 placeholder |
| `GET /api/health` | Implemented | Returns runtime configuration booleans (`200`) |
| `GET / POST /api/documents` | Implemented | Authenticated USER-client workspace read/insert (`200` / `201` / `400` / `401` / `403`) |
| `/api/review`, `/api/suggestions/[id]/decision` | Stub (M2/M3) | Intentionally return `501 {"error":"not_implemented"}` |

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
  - `SUPABASE_SERVICE_ROLE_KEY`, `AI_SERVICE_URL`, `AI_SERVICE_TOKEN` *(reserved for M2+ server routes; M1 runs without service-role DB bypass)*
- **AI Service (`ai-service/.env.example` -> `ai-service/.env`):**
  - `AI_SERVICE_TOKEN`, `LLM_PROVIDER=groq` (default in `.env.example`) or `ollama`, plus `GROQ_API_KEY` / `GROQ_MODEL` (`openai/gpt-oss-20b`).

### 2. Web Application (`web/`)

```bash
cd web
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm dev
```

Note: ESLint (`pnpm lint`) is not yet configured in `web/package.json` (`[DEF-09]`, awaiting dependency approval).

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
3. Run **BLOCK 1** (cases `a`–`e`) and **BLOCK 2** (`pg_policies` summary) from `supabase/tests/rls_checks.sql` in the Supabase SQL Editor to verify RLS isolation on your project.

---

## Security Boundaries

1. **Client & Bundle Secret Isolation:** `web/lib/env.ts`, `web/lib/supabase/admin.ts`, and `web/lib/workspace.ts` enforce `import 'server-only'`. `DEMO_EMAIL`, `DEMO_PASSWORD`, `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`, and `AI_SERVICE_TOKEN` never enter client components or `.next/static/*.js`.
2. **USER-Client RLS in M1:** M1 workspace queries and document inserts execute exclusively via `createClient()` (`web/lib/supabase/server.ts`) under PostgreSQL RLS, without invoking `createAdminClient()`.
3. **LLM Credential Isolation:** LLM keys live strictly inside `ai-service/.env` and are never read by `web/`.
4. **Zero Client Write Access to Findings:** `review_runs`, `findings`, and `suggestions` have no client RLS write policies; M2 server routes will write them via `createAdminClient()`.
5. **Response Headers & Error Boundaries:** `web/next.config.mjs` sets `poweredByHeader: false`, `Content-Security-Policy`, `Permissions-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and `Referrer-Policy`. `web/app/error.tsx` displays fixed fallback copy without raw `error.message`.

---

## Documentation Index

- [System Architecture](docs/architecture.md)
- [Known Limitations](docs/limitations.md)
- [AI Assistance & Governance Disclosure](docs/ai-disclosure.md)
- [Verification & Test Evidence](docs/test-evidence.md)
- [QA Matrix](.planning/QA.md)
- [Defect Log](.planning/DEFECTS.md)
