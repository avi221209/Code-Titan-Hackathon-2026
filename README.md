# BrandGuardian

Evidence-backed brand compliance review workspace built for **CodeTitans India 2026 (Round 2)** by **Team Stark**.

BrandGuardian checks marketing and product copy against workspace-approved guidelines, facts, and controlled terminology, separates deterministic checks from best-effort LLM suggestions with explicit verification labels, and enforces human review authority through PostgreSQL Row-Level Security (RLS) and chronological audit logging.

> **Current Status:** M0–M3 code, reliability remediation (`[DEF-09]`, `[DEF-11]`, `[DEF-12]`, `[DEF-14]`–`[DEF-23]`), `pytest` (`19/19`), Web unit tests (`34/34`), ESLint (`0` warnings/errors), `pnpm audit` (`0` advisories), and isolated clean-env production build are implemented and verified in the working tree. Live cloud deployment (`<WEB_URL>`, `<AI_URL>`), live end-to-end Groq/Supabase DB runs, `decision_rls.sql`, post-test `0003_audit_server_only.sql`, and migration/test `0004_remediation_integrity_and_rpc.sql` / `remediation_checks.sql` are **`USER-RUN`** (see [`docs/deployment.md`](docs/deployment.md) and [`docs/test-evidence.md`](docs/test-evidence.md)).

---

## Hosted URLs (`USER-RUN` Placeholders)

- **Web App (`web/` on Vercel):** `<WEB_URL>` *(fill after Vercel deployment — [`docs/deployment.md`](docs/deployment.md))*
- **AI Microservice (`ai-service/` on Render/Railway):** `<AI_URL>` *(fill after Docker deployment — [`docs/deployment.md`](docs/deployment.md))*

> Zero laptop dependency applies **only after `USER-RUN` deployment and incognito verification** on `<WEB_URL>` and `<AI_URL>`.

---

## Demo Sign-In & 3-Minute Judge Journey

All workspace rules, facts, terminology, and sample copy belong to the synthetic fictional brand **Asterra**. No real customer or confidential data is included.

### Quick Sign-In
1. Open `<WEB_URL>/login` (or click **Sign in** from `/`).
2. Click **"Enter demo workspace"** (one-click server action using server-only `DEMO_EMAIL` / `DEMO_PASSWORD` credentials — zero secrets are shipped to the browser).
   *(Alternatively, sign in via the email/password form with Supabase Auth credentials.)*

### 3-Minute Judge Walkthrough (Verified UI Steps Only)
1. **Inspect Workspace & Knowledge (`/dashboard` -> `/knowledge`):**
   - On `/dashboard`, confirm the **Asterra (demo)** workspace header, role badge (`Role: admin`), **Knowledge Ledger** (`5` Guideline rules, `5` Approved facts, `2` Terminology entries), and **Recent Documents**.
   - Click **View knowledge** (`/knowledge`) to inspect the read-only **Rules**, **Facts**, and **Terminology** tabs with source records and status badges (`Approved`, `Active`).
2. **Create the Synthetic Draft (`/documents/new`):**
   - Click **Review new content** (or **New Review** in the navigation bar).
   - Click **"Load Asterra sample"** to populate `"Asterra Flow Launch Draft"` (`163 / 6,000` chars).
   - Click **"Save document"** to persist the draft via `POST /api/documents` and open `/documents/[id]`.
3. **Run Compliance Review (`/documents/[id]`):**
   - Click **"Run review"** (calls Next.js BFF `POST /api/review` -> FastAPI `POST /review`).
   - Observe the status banner (`AI review completed` with `openai/gpt-oss-20b`, or an explicit degraded banner such as `AI unavailable` / `AI output rejected` without hiding deterministic results).
   - Click highlights in **Document Copy** or navigate **Findings** using keyboard shortcuts `j` / `k`. Confirm findings include:
     - `consumers` (`terminology`, `medium`, **Verified**, suggested revision `customers`)
     - `founded in 2019` (`fact`, `high`, **Verified**, cites `"Asterra was founded in 2021."`)
     - `cheapest and best` (`unsupported_claim`, `high`, **Verified**)
     - `guarantee 300% revenue growth in just 7 days` (`unsupported_claim`, `critical`, **Verified**)
   - Confirm each card shows verification status (`Verified` / `Unverified`), `AI-generated` when `origin === "llm"`, and `Confidence: X% (estimate)`.
4. **Enforce Evidence Gate & Record Human Decisions (`/documents/[id]`):**
   - On **High** or **Critical** findings, **Evidence** starts collapsed and both **Accept** and **Edit** stay disabled until you click **Inspect evidence**.
   - Exercise **Accept**, **Edit** -> **Save edit**, **Reject** *(requires non-blank reason)* -> **Confirm reject**, or **Dismiss**.
   - Hard-refresh (`Ctrl+Shift+R`) to verify persisted decisions and attribution; once every suggestion in the latest completed run has a decision, the document status badge updates to **Reviewed**.
5. **Preview Final Copy & Inspect Audit Trail (`/documents/[id]/history`):**
   - Click **"Preview final text"** to inspect the read-only end-to-start replacement preview (stored draft text remains unchanged), then click **Copy**.
   - Click **"Audit history"** (`/documents/[id]/history`) to view chronological `review.completed`, `decision.recorded`, and `document.reviewed` audit events in UTC with resolved actor names.

---

## Monorepo Layout

```text
brandguardian/
├── web/                  # Next.js 15 App Router frontend + server BFF route handlers (pnpm + ESLint)
├── ai-service/           # Python FastAPI deterministic + LLM checker/verifier microservice + Dockerfile
├── supabase/
│   ├── migrations/       # 0001_schema.sql, 0002_rls_hardening.sql, 0003_audit_server_only.sql, 0004_remediation_integrity_and_rpc.sql
│   ├── seed.sql          # Synthetic "Asterra (demo)" & "Northwind (isolation test)" seed
│   └── tests/            # Manual SQL Editor impersonation scripts (rls_checks.sql, decision_rls.sql, remediation_checks.sql)
├── docs/                 # Deployment, architecture, features, AI disclosure, evidence, limitations, roadmap, team, checklist
└── .planning/            # QA matrix, defect log, remediation reports, decisions needed, autonomous reports
```

---

## Local Setup & Run

### Prerequisites
- **Node.js** `>= 20` (tested on `v24.14.0`) and **pnpm** (`12.x`)
- **Python** `>= 3.11` (tested on `3.13.15`)
- **Supabase** project with `0001_schema.sql` & `seed.sql` applied and `judge@brandguardian.demo` / `outsider@brandguardian.demo` Auth users created
- **Groq API key** (`openai/gpt-oss-20b`, hosted demo provider) or local **Ollama** (`qwen2.5:3b`, optional local-only mode)

### 1. Environment Variables
Copy `.env.example` templates locally (never commit `.env` or `.env.local`):
- **`web/.env.example` -> `web/.env.local`:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `AI_SERVICE_URL`, `AI_SERVICE_TOKEN`, `DEMO_EMAIL`, `DEMO_PASSWORD`.
- **`ai-service/.env.example` -> `ai-service/.env`:** `AI_SERVICE_TOKEN` (must match `web/.env.local`), `LLM_PROVIDER`, `GROQ_API_KEY`, `GROQ_MODEL`, `GROQ_URL`, `LLM_TIMEOUT` (plus `OLLAMA_URL` / `OLLAMA_MODEL` for optional local mode).

### 2. Run `ai-service/` (Terminal 1)
```powershell
cd ai-service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8000 --env-file .env
```

### 3. Run `web/` (Terminal 2)
```powershell
cd web
pnpm install
pnpm build
pnpm start
```
Open `http://127.0.0.1:3000`.

### 4. Supabase Migrations & SQL Checks (Supabase SQL Editor)
1. Apply `supabase/migrations/0001_schema.sql`.
2. Create `judge@brandguardian.demo` and `outsider@brandguardian.demo` in Supabase Auth, then run `supabase/seed.sql`.
3. Apply `supabase/migrations/0002_rls_hardening.sql` (`[DEF-10]`) and run `supabase/tests/rls_checks.sql`.
4. Run `supabase/tests/decision_rls.sql` (wrapped in `begin` / `rollback`).
5. Apply `supabase/migrations/0003_audit_server_only.sql` **only after** a live M3 decision test cleanly passes (locks `audit_events` inserts to server-only).
6. Apply `supabase/migrations/0004_remediation_integrity_and_rpc.sql` (required for `POST /api/suggestions/[id]/decision` transactional `record_review_decision` RPC, post-review `documents` lock, composite FKs, and concurrent run guard) and run `supabase/tests/remediation_checks.sql` (`cases h–o`, wrapped in `begin` / `rollback`).

---

## Verified Tests & Quality Checks

Full commands, outputs, dates, and `Agent` vs `USER-RUN` boundaries are recorded in [`docs/test-evidence.md`](docs/test-evidence.md):

- **AI Service tests:** `.\ai-service\.venv\Scripts\python.exe -m pytest -q ai-service` -> `19 passed, 1 warning` (`2026-11-10`).
- **Web TypeScript & Lint:** `pnpm --dir web typecheck`, strict unused check, and `pnpm --dir web lint` (`eslint` `9.39.5` / `eslint-config-next` `15.5.29`) -> exit `0` (`0` warnings/errors).
- **Web unit & workflow tests:** `pnpm --dir web test` -> `34 passed, 0 failed` (`m1`, `review`, `decision`, `accessibility`, `claims`, `decision-workflow`, `review-workflow`, `health-workflow`, `security`).
- **Web dependency audit:** `pnpm --dir web audit --json` -> exit `0`, **`0` advisories** across all dependencies.
- **Web production build (local + isolated clean checkout with documented env vars only):** exit `0`.
- **RLS isolation & hardening (`USER-RUN`):** `0002` + `rls_checks.sql` `7 of 7` cases (`a`–`g`) passed, `pg_policies` active across all `14` public tables, `0` `DELETE` grants for `authenticated`; `0003`, `0004`, `decision_rls.sql`, and `remediation_checks.sql` remain **`USER-RUN`**.

---

## Documentation Index

- [Deployment Guide (Vercel + Render/Railway)](docs/deployment.md)
- [Features Matrix (Completed, Partial, Not Built)](docs/features.md)
- [System Architecture & Failure Modes](docs/architecture.md)
- [AI Assistance & Governance Disclosure](docs/ai-disclosure.md)
- [Test & Verification Evidence](docs/test-evidence.md)
- [Known Limitations](docs/limitations.md)
- [Round 3 Roadmap](docs/round3-roadmap.md)
- [Team Contributions Template](docs/contributions.md)
- [Submission Readiness Checklist](docs/submission-checklist.md)
