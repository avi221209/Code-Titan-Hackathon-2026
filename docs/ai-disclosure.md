# AI Assistance, Model & Governance Disclosure

## 1. Runtime AI Models & Providers

| Mode | Provider | Model | Status in Submission | Purpose & Behavior |
| --- | --- | --- | --- | --- |
| **Hosted Demo (Active Default)** | **Groq API** | `openai/gpt-oss-20b` (`LLM_PROVIDER=groq`) | Configured for hosted deployment | Structured JSON schema extraction (`temperature=0`, `reasoning_effort="low"`, `LLM_TIMEOUT=30`) for nuance in `tone`, `messaging`, and `unsupported_claim` findings (`origin: "llm"`). |
| **Optional Local Mode** | **Ollama** | `qwen2.5:3b` (`LLM_PROVIDER=ollama`) | Supported in `ai-service/main.py` as optional local dev fallback; **NOT part of the hosted demo** | Local `/api/chat` structured output mode behind an `asyncio.Semaphore(1)` GPU lock. Omitted from production container configuration. |

- **No External Model Training / Confidential Exposure:** All reference workspace rules, facts, terminology, and sample documents belong to the synthetic fictional brand **Asterra**. No client, personal, or proprietary data is processed or stored.
- **Deterministic First:** All terminology checks, configured regex fact checks, and regex rule checks execute in Python code (`ai-service/main.py`) without calling any LLM.

---

## 2. Core Platforms & Open-Source Libraries

- **Frontend / BFF (`web/`):** Next.js `15.5.29` (React `19.3.1`), TypeScript (`5.9.3`), Tailwind CSS (`3.4.19`), `lucide-react`, `sonner`, `class-variance-authority`, `clsx`, `tailwind-merge`, `server-only`.
- **Database & Auth (`supabase/`):** Supabase PostgreSQL + Auth + Row-Level Security via `@supabase/ssr` and `@supabase/supabase-js`.
- **AI Inspection Microservice (`ai-service/`):** Python `3.13`, FastAPI, Uvicorn, Pydantic v2, `httpx`, `pytest`.

---

## 3. Build & Research AI Assistance Disclosure

Team Stark used AI tooling during development while maintaining direct human specification review, code auditing, unit/SQL verification, and strict non-fabrication rules:

- **Antigravity agents:** Iterative milestone scaffolding (`M0`–`M3`), QA-fix defect analysis and resolution, security/RLS/accessibility audits, test script authoring, deployment configuration, and documentation alignment.
- **Claude by Anthropic:** Architecture planning support, prompt/guardrail review, and TypeScript/Python/SQL code assistance.
- **Consensus:** Round 1 academic/literature search grounding evidence-based verification and human-in-the-loop compliance design principles.

---

## 4. Product AI Safety & Human Authority Guarantees

1. **AI Never Auto-Approves or Publishes:** BrandGuardian contains **no** auto-approval, auto-rewrite commit, or external publishing action. Every finding preserves `"Preview final text"` as read-only clipboard copy and requires explicit human decisions (`accepted`, `edited`, `rejected`, `dismissed`) recorded per finding in `review_decisions` and `audit_events`.
2. **Honest Grounding & Origin Labels:** Deterministic findings matching supplied workspace IDs display **`Verified`**; LLM findings without a valid workspace `rule_id` display **`Unverified`**, carry an **`AI-generated`** badge, and display numeric confidence explicitly labeled **`(estimate)`**. Hallucinated quotes absent from the submitted document are discarded (`dropped`) before reaching the UI.
3. **Evidence Gate on Severe Findings:** High and Critical findings start with their Evidence panel collapsed and **Accept** disabled until the reviewer clicks **Inspect evidence**.
4. **Honest Degraded States:** When Groq is unreachable (`unavailable`) or emits malformed JSON (`invalid_output`), BrandGuardian never fabricates LLM findings; deterministic findings remain visible alongside an explicit `AiStatusBanner`.
