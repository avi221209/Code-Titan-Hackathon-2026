# BrandGuardian Deployment Guide (Production & Judging Readiness)

> **No Laptop Dependency Statement:** Zero laptop dependency — **"true only after USER-RUN verification"** (meaning after you deploy `ai-service/` to Render or Railway, apply remaining Supabase SQL migrations `0003` and `0004`, deploy `web/` to Vercel with `60s` timeout verified, configure rotated production environment variables, update Supabase Auth Site/Redirect URLs, and verify `GET <AI_URL>/ready`, `GET <WEB_URL>/api/health?probe=1`, and one live review + decision run from an incognito session).

*(This repository prepares deployment configuration and instructions only. The agent does not hold host account credentials, does not inspect or store secrets, and Docker CLI is not installed in this local build environment.)*

---

## 1. Deployment Topology

BrandGuardian runs cleanly with no local GPU/tunnel dependency when hosted on two web services backed by Supabase:

- **Web App (`web/` -> Vercel):** Next.js 15 App Router frontend + server BFF route handlers (`/api/review` with `export const maxDuration = 60` and `AbortSignal.timeout(50_000)`).
- **AI Service (`ai-service/` -> Render or Railway):** Stateless FastAPI microservice built from `ai-service/Dockerfile`, running deterministic checkers + Groq API (`openai/gpt-oss-20b`), binding `0.0.0.0:${PORT:-8000}` as a non-root user.
- **Database & Auth (Supabase Cloud):** PostgreSQL + Auth + RLS (`0001_schema.sql`, `seed.sql`, `0002_rls_hardening.sql`, and remaining `USER-RUN` migrations `0003_audit_server_only.sql` & `0004_remediation_integrity_and_rpc.sql`).

### Build & Config Readiness Checked in Repo
- **`web/` localhost scan (`git grep -n -E "localhost|127\.0\.0\.1" web/`):** Zero hits in `web/app`, `web/components`, and `web/lib`; only `web/next.config.mjs:14` (`isDev ? ' ws://127.0.0.1:* ws://localhost:*' : ''` dev-only HMR CSP directive) references localhost.
- **Documented env-var build check:** Verified cleanly with `pnpm --dir web build` and an isolated clean checkout build (`pnpm install --frozen-lockfile --ignore-scripts` + `pnpm exec next build` with zero `.env.local` and only the 7 variables in `web/.env.example`, including `web/pnpm-workspace.yaml` overrides).
- **`ai-service/Dockerfile` hardening:** Uses `python:3.13-slim`, installs `requirements.txt`, creates non-root `appuser`, copies only `requirements.txt` and `main.py` (paired with `ai-service/.dockerignore` excluding `.env*`, `.venv/`, caches, and tests), switches to `USER appuser`, and launches `uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}`.

---

## 2. Step-by-Step: Deploy `ai-service/` (Render or Railway)

Deploy `ai-service/` **first** so you have `<AI_URL>` ready before setting `AI_SERVICE_URL` on Vercel.

### Local Container Image Build Check (`USER-RUN` — Docker CLI Not Installed Here)
If you install/use Docker locally before pushing or on another machine, verify the container build with:

```bash
cd ai-service
docker build -t brandguardian-ai .
docker run --rm -p 8000:8000 --env-file .env brandguardian-ai
# In a second terminal:
curl -i http://127.0.0.1:8000/health
curl -i http://127.0.0.1:8000/ready
curl -i -X POST http://127.0.0.1:8000/review -H "Content-Type: application/json" -d "{}"
# Expect HTTP 200 on /health and /ready (when AI_SERVICE_TOKEN + GROQ_API_KEY are set), and HTTP 401 {"detail":"unauthorized"} on /review without x-api-key
```

### Option A: Render (Web Service via Docker)
1. In the **Render Dashboard**, click **New + -> Web Service** and connect `avi221209/Code-Titan-Hackathon-2026` (`main` branch).
2. Configure build settings:
   - **Root Directory:** `ai-service`
   - **Language / Environment:** `Docker` (uses `ai-service/Dockerfile` automatically)
   - **Branch:** `main`
   - **Health Check Path:** `/ready` *(use `/health` if you only want container liveness before secrets are entered, then `/ready` once `AI_SERVICE_TOKEN` & `GROQ_API_KEY` are configured)*
   - **Instance Type:** Starter / Free (note: free-tier instances sleep on idle and incur cold starts — always warm `/ready` before judging)
3. Add all `ai-service` environment variables from Section 4 below (do not hard-code `PORT`; Render injects `PORT` dynamically and `Dockerfile` reads `${PORT:-8000}`).
4. Click **Deploy Web Service**, wait for status **Live**, and record the HTTPS URL as `<AI_URL>`.

### Option B: Railway (Docker Service)
1. In the **Railway Dashboard**, create a **New Project -> Deploy from GitHub Repo** (`avi221209/Code-Titan-Hackathon-2026`, `main` branch).
2. Under **Settings -> Source / Build**:
   - Set **Root Directory** to `ai-service` (Railway detects `ai-service/Dockerfile`).
   - Under **Deploy -> Healthcheck Path**, set `/ready` *(ensures `AI_SERVICE_TOKEN` + `GROQ_API_KEY` readiness)*.
3. Under **Variables**, add all `ai-service` environment variables from Section 4 below (Railway injects `PORT`; `${PORT:-8000}` handles it automatically).
4. Under **Settings -> Networking -> Public Networking**, click **Generate Domain**, deploy, and record the HTTPS URL as `<AI_URL>`.

---

## 3. Step-by-Step: Deploy `web/` on Vercel

1. **Apply Pending Supabase Migrations (`USER-RUN`, Before Testing Decisions on `<WEB_URL>`):**
   - Run [`supabase/tests/decision_rls.sql`](../supabase/tests/decision_rls.sql) (`begin` / `rollback`), apply [`supabase/migrations/0003_audit_server_only.sql`](../supabase/migrations/0003_audit_server_only.sql), apply **[`supabase/migrations/0004_remediation_integrity_and_rpc.sql`](../supabase/migrations/0004_remediation_integrity_and_rpc.sql)** *(required for `POST /api/suggestions/[id]/decision` `record_review_decision` RPC)*, and run [`supabase/tests/remediation_checks.sql`](../supabase/tests/remediation_checks.sql) (`begin` / `rollback`, `8/8` cases `h`–`o`).
2. In the **Vercel Dashboard**, click **Add New... -> Project** and import `avi221209/Code-Titan-Hackathon-2026` (`main` branch).
3. Configure **Project Settings -> Build and Deployment**:
   - **Root Directory:** `web`
   - **Framework Preset:** `Next.js`
   - **Install Command:** `pnpm install` (auto-detected via `web/pnpm-lock.yaml` + `web/pnpm-workspace.yaml` overrides)
   - **Build Command:** `pnpm build`
   - **Output Directory:** `.next` (default)
4. Note serverless timeout: [`web/app/api/review/route.ts`](../web/app/api/review/route.ts#L7) exports `maxDuration = 60` and calls `<AI_URL>/review` with a 50-second `AbortSignal.timeout(50_000)`. Verify your Vercel project/plan allows up to `60s` function execution (Vercel Fluid Compute / Pro supports 60s; keeping Render/Railway warm and `LLM_TIMEOUT=30` avoids cold-start timeouts).
5. Add every `web` environment variable from Section 4 below (pointing `AI_SERVICE_URL` to `<AI_URL>`), then click **Deploy**.
6. Record the deployed Production URL as `<WEB_URL>`.

---

## 4. Complete Environment Variable Reference

> **Rule:** Variable names and placements only — never commit real keys, tokens, or passwords to Git.

| Variable | Service | Placement | Secret? | Notes / Expected Purpose |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `web` (Vercel) | Public (`NEXT_PUBLIC_*`) | No | Project HTTPS URL (`https://<project-ref>.supabase.co`). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `web` (Vercel) | Public (`NEXT_PUBLIC_*`) | No | Supabase anon/publishable key; safe for browser within Postgres RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | `web` (Vercel) | Server-side secret (`server-only`) | **Yes** | Required by `createAdminClient()` (`review_runs`, `findings`, `suggestions`, profile display-name lookup, `audit_events`) and checked by `/api/health`. Never prefix `NEXT_PUBLIC_`. |
| `AI_SERVICE_URL` | `web` (Vercel) | Server-side config (`server-only`) | No | Deployed HTTPS origin `<AI_URL>` (e.g., Render/Railway URL, no trailing slash). Checked by `/api/health` and `?probe=1`. Never prefix `NEXT_PUBLIC_`. |
| `AI_SERVICE_TOKEN` | **Both** (`web` on Vercel + `ai-service` on Render/Railway) | Server-side secret (`web`) / Host secret (`ai-service`) | **Yes** | Shared random secret sent via `x-api-key` and verified with `hmac.compare_digest` in `Depends(require_key)`. Checked on `/ready`, `/health` (`token_configured`), and `/api/health`. Must match identically on both hosts. |
| `DEMO_EMAIL` | `web` (Vercel) | Server-side config (`getDemoCredentials()`) | No | Synthetic demo login email (`judge@brandguardian.demo`). Server action reads it without exposing it to client bundles. |
| `DEMO_PASSWORD` | `web` (Vercel) | Server-side secret (`getDemoCredentials()`) | **Yes** | Demo password used by **"Enter demo workspace"**. Must match Supabase Auth user password; rotate for production. |
| `LLM_PROVIDER` | `ai-service` (Render/Railway) | Host config | No | Set to `groq` for hosted cloud demo (`ollama` is local-dev mode only). |
| `GROQ_API_KEY` | `ai-service` (Render/Railway) | Host secret | **Yes** | Rotated Groq API key. Read strictly by `ai-service`, checked by `/ready` & `/health`, never placed on Vercel/`web`. |
| `GROQ_MODEL` | `ai-service` (Render/Railway) | Host config | No | Set to `openai/gpt-oss-20b`. |
| `GROQ_URL` | `ai-service` (Render/Railway) | Host config (optional, listed in `ai-service/.env.example`) | No | Optional override; defaults to `https://api.groq.com/openai/v1/chat/completions`. |
| `LLM_TIMEOUT` | `ai-service` (Render/Railway) | Host config | No | Upstream LLM request timeout in seconds (`30` keeps margin below `web`'s `50s` BFF timeout). |
| `PORT` | `ai-service` (Render/Railway) | Platform host env | No | Injected automatically by Render/Railway; `ai-service/Dockerfile` falls back to `8000`. |
| `OLLAMA_URL`, `OLLAMA_MODEL` | `ai-service` (Local only) | Local host config | No | Optional local Ollama mode only (`127.0.0.1:11434`, `qwen2.5:3b`); omit in hosted cloud demo. |

---

## 5. Production Key Rotation & Supabase Auth Configuration (`USER-RUN`)

Do **not** reuse local development secrets verbatim in cloud production:

1. **Generate NEW Production Secrets:**
   - **New `AI_SERVICE_TOKEN`:** Generate a fresh random 32+ byte secret (`openssl rand -hex 32` or PowerShell `[Convert]::ToHexString(...)`) and configure that exact same token in **both** Vercel (`web`) and Render/Railway (`ai-service`).
   - **Rotated `GROQ_API_KEY`:** Issue a dedicated production key in Groq Console, configure it on Render/Railway `ai-service`, and revoke any temporary dev key once verified.
   - **Rotated `DEMO_PASSWORD`:** Update `judge@brandguardian.demo`'s password in **Supabase Dashboard -> Authentication -> Users**, and enter that new password in Vercel's `DEMO_PASSWORD` env var (never `NEXT_PUBLIC_`).
2. **Update Supabase Auth URL Configuration:**
   - Open **Supabase Dashboard -> Authentication -> URL Configuration**:
     - **Site URL:** Set to `<WEB_URL>` (exact production Vercel origin).
     - **Redirect URLs:** Add `<WEB_URL>/**` (and any preview/custom domain pattern you intend to use), then save.

---

## 6. Pre-Judging Verification Checklist (`USER-RUN`)

Run this sequence 10–15 minutes before judging begins (handles free-tier spin-up cleanly):

1. **Wake `ai-service` via `/ready` & `/health`:**
   ```bash
   curl -i <AI_URL>/ready
   curl -i <AI_URL>/health
   ```
   Confirm `HTTP 200` on `/ready` (`"status":"ready"`, `"token_configured":true`, `"llm_configured":true`) and `HTTP 200` on `/health` showing `"provider":"groq"`, `"model":"openai/gpt-oss-20b"`. (Wait if container is waking from cold start.)
2. **Confirm unauthenticated `POST /review` rejects (`401`):**
   ```bash
   curl -i -X POST <AI_URL>/review -H "Content-Type: application/json" -d "{}"
   ```
   Confirm `HTTP 401` `{"detail":"unauthorized"}`.
3. **Verify Web `/api/health` and deep upstream readiness `/api/health?probe=1`:**
   ```bash
   curl -i <WEB_URL>/api/health
   curl -i "<WEB_URL>/api/health?probe=1"
   ```
   Confirm `HTTP 200` with `"status":"ok"`, `"supabase_configured":true`, `"ai_service_configured":true`, and `"upstream_ready":true` on `?probe=1`.
4. **Run One Full Live Review + Decision Smoke Test (Incognito Browser):**
   - Open `<WEB_URL>/login`, click **Enter demo workspace** -> lands on `/dashboard` (`Asterra (demo)`).
   - Navigate to **New Review** (`/documents/new`) -> click **Load Asterra sample** -> click **Save document**.
   - On `/documents/[id]`, click **Run review** -> confirm `AI review completed` banner and all expected findings appear (`best practices` ignored; `cheapest`, `best`, `consumers`, `founded in 2019`, `guarantee ...` caught), unlock one High/Critical evidence panel before **Accept** and **Edit**, exercise **Reject** / **Dismiss**, verify **"Preview final text"** + **Copy**, confirm automatic `documents.status = 'reviewed'`, and inspect `/documents/[id]/history` (`review.completed`, `decision.recorded`, `document.reviewed`).

---

## 7. Rollback Note

- **Web (`web/` on Vercel):** Open **Vercel Dashboard -> Deployments**, choose the previous known-good deployment, and click **Promote to Production / Instant Rollback**.
- **AI Service (`ai-service/` on Render or Railway):** Trigger **Rollback / Redeploy Previous Release** in your Render or Railway service history, or let deterministic checkers continue serving safely if Groq becomes unavailable.
- **Database (`supabase/migrations/`):** Reverting `0002_rls_hardening.sql`, `0003_audit_server_only.sql`, or `0004_remediation_integrity_and_rpc.sql` is documented in the `-- ROLLBACK NOTE` footer at the bottom of each SQL file (`0002` lines 126–139; `0003` lines 15–18; `0004` lines 372–390).
