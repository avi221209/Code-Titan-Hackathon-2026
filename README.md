# BrandGuardian

Evidence-backed brand compliance review workspace built with Next.js App Router, TypeScript, Tailwind CSS, Supabase (Auth, PostgreSQL, RLS), and a Python FastAPI AI verification service.

> **Current Milestone:** **M0 — Project Structure Only.**  
> M0 establishes the monorepo layout, design tokens, typed API contracts, isolated Supabase client helpers, and the unchanged FastAPI checker/verifier engine. Product authentication (M1), review execution (M2), and human decision workflows (M3) are not yet implemented.

---

## Monorepo Architecture

```text
brandguardian/
├── web/                  # Next.js App Router frontend + BFF route handlers
├── ai-service/           # Python FastAPI deterministic + LLM checker/verifier service
├── supabase/
│   ├── migrations/       # Idempotent PostgreSQL DDL + RLS policies (0001_schema.sql)
│   └── seed.sql          # Synthetic "Asterra" brand seed data (separated from DDL)
├── docs/                 # Architecture, limitations, AI disclosure, and test evidence
└── .planning/            # Milestone specifications (M0.md) and state tracker (STATE.md)
```

---

## Prerequisites

- **Node.js** `>= 20` (tested on `v24.14.0`) and **pnpm** (`12.5.1`)
- **Python** `>= 3.11` (tested on `3.13.15`) and **uv** or **pip**
- **Supabase** project (for M1+ database & auth setup)
- **Ollama** (local mode, e.g. `qwen2.5:3b`) or hosted Groq API account configured inside `ai-service`

---

## Local Setup (M0)

### 1. Environment Templates

Copy the environment templates without committing real credentials:

- **Web (`web/.env.example` -> `web/.env.local`):**
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` *(server-only; never expose to browser code)*
  - `AI_SERVICE_URL`
  - `AI_SERVICE_TOKEN`
- **AI Service (`ai-service/.env.example` -> `ai-service/.env`):**
  - Configure `AI_SERVICE_TOKEN`, `LLM_PROVIDER` (`ollama` or `groq`), and provider credentials (`ai-service` holds LLM credentials exclusively).

### 2. Web Application (`web/`)

```bash
cd web
pnpm install
pnpm typecheck
pnpm build
pnpm dev
```

In M0:
- `GET /api/health` returns `{ "status": "ok", "service": "brandguardian-web", ... }` with HTTP `200`.
- `POST /api/review`, `/api/documents`, and `/api/suggestions/[id]/decision` return `{"error":"not_implemented"}` with HTTP `501`.
- UI pages display their title and one sentence describing their planned milestone delivery.

### 3. Python AI Microservice (`ai-service/`)

```bash
cd ai-service
uv venv .venv
.venv\Scripts\activate
uv pip install -r requirements.txt
python -m pytest -v
uvicorn main:app --host 127.0.0.1 --port 8000
```

### 4. Database Files (`supabase/`)

- `supabase/migrations/0001_schema.sql`: Core tables (`profiles`, `workspaces`, `workspace_members`, `guidelines`, `guideline_rules`, `approved_facts`, `terminology`, `documents`, `review_runs`, `findings`, `suggestions`, `review_decisions`, `comments`, `audit_events`), RLS helper functions, policies, and explicit `GRANT`s.
- `supabase/seed.sql`: Synthetic `"Asterra"` brand seed block (requires creating demo auth users first in M1 before manual execution). **Not applied in M0.**

---

## Security Boundaries

1. **Service Role Isolation:** `web/lib/supabase/admin.ts` imports `server-only`, forcing Next.js build failures if ever imported by client components.
2. **LLM Credential Isolation:** LLM provider credentials live strictly inside `ai-service` and are never configured or read inside `web/`.
3. **Zero Client Write Access to Findings:** `review_runs`, `findings`, and `suggestions` have no client RLS write policies; only Next.js server routes using the admin client write them (M2).

---

## Documentation Index

- [System Architecture](docs/architecture.md)
- [Known Limitations](docs/limitations.md)
- [AI Assistance & Governance Disclosure](docs/ai-disclosure.md)
- [M0 Test & Verification Evidence](docs/test-evidence.md)
