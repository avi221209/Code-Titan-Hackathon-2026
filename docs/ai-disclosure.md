# AI Assistance, Model & Governance Disclosure

## 1. Runtime AI Models & Providers

| Mode | Provider | Model | Status in Submission | Purpose & Behavior |
| --- | --- | --- | --- | --- |
| **Hosted Demo (Active Default)** | **Groq API** | `openai/gpt-oss-20b` (`LLM_PROVIDER=groq`) | Configured for hosted deployment | Structured JSON schema extraction (`temperature=0`, `reasoning_effort="low"`, `LLM_TIMEOUT=30`) for nuance in `tone`, `messaging`, `unsupported_claim`, and advisory unpatterned `fact` discrepancies (`origin: "llm"`). |
| **Optional Local Mode** | **Ollama** | `qwen2.5:3b` (`LLM_PROVIDER=ollama`) | Supported in `ai-service/main.py` as optional local dev fallback; **NOT part of the hosted demo** | Local `/api/chat` structured output mode behind an `asyncio.Semaphore(1)` GPU lock. Omitted from production container configuration. |

- **No External Model Training / Confidential Exposure:** All reference workspace rules, facts, terminology, and sample documents belong to the synthetic fictional brand **Asterra**. No client, personal, or proprietary data is processed or stored.
- **Deterministic First:** All terminology checks, configured regex fact checks, and regex rule checks execute in Python code (`ai-service/main.py`) with JS-compatible UTF-16 code-unit offsets without calling any LLM.

---

## 2. Core Platforms & Open-Source Libraries

- **Frontend / BFF (`web/`):** Next.js `15.5.29` (React `19.3.1`), TypeScript (`5.9.3`), ESLint (`9.39.5`, `eslint-config-next 15.5.29`), Tailwind CSS (`3.4.19`), `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `server-only`.
- **Database & Auth (`supabase/`):** Supabase PostgreSQL + Auth + Row-Level Security via `@supabase/ssr` and `@supabase/supabase-js`.
- **AI Inspection Microservice (`ai-service/`):** Python `3.13`, FastAPI, Uvicorn, Pydantic v2, `httpx`, `pytest`.

---

## 3. Build & Research AI Assistance Disclosure

Team Stark used AI tooling during development while maintaining direct human specification review, code auditing, unit/SQL verification, and strict non-fabrication rules:

- **Antigravity agents:** Iterative milestone scaffolding (`M0`–`M3`), pre-deployment reliability audit, systematic defect remediation (`[DEF-09]`, `[DEF-11]`, `[DEF-12]`, `[DEF-14]`–`[DEF-23]`), security/RLS/accessibility verification, test suite expansion (`19` Python + `34` Web tests), deployment preparation, and documentation alignment.
- **Claude by Anthropic:** Architecture planning support, prompt/guardrail review, and TypeScript/Python/SQL code assistance.
- **Consensus:** Round 1 academic/literature search grounding evidence-based verification and human-in-the-loop compliance design principles.

---

## 4. Product AI Safety & Human Authority Guarantees

1. **AI Never Auto-Approves or Publishes:** BrandGuardian contains **no** auto-approval, auto-rewrite commit, or external publishing action. `"Preview final text"` stays read-only clipboard copy and refuses ambiguous multi-occurrence replacements safely rather than mutating wrong copy; every decision (`accepted`, `edited`, `rejected`, `dismissed`) requires explicit human submission recorded transactionally via PostgreSQL `record_review_decision(...)` (`0004`) across `review_decisions`, `suggestions`, `documents`, and `audit_events`.
2. **Semantic Grounding & Honest Origin Labels:** `verify()` confirms valid UTF-16 spans and checks workspace source ID **plus matching category and non-escalated severity**; findings without semantic workspace substantiation stay **`Unverified`**, carry **`AI-generated`** (`origin === "llm"`), and display confidence explicitly labeled **`(estimate)`** (bounded `[0..1]`). Hallucinated quotes and post-limit truncations increment `dropped` explicitly rather than being hidden silently.
3. **Evidence Gate Enforced on Both Accept & Edit:** High and Critical findings start with their Evidence panel collapsed and disable **both Accept and Edit** until the reviewer clicks **Inspect evidence**. (`Edit` is also forbidden in both UI and server/SQL when `suggested_text === null`.)
4. **Honest Degraded States:** When Groq returns upstream HTTP `401`/`429`/`5xx`, times out (`LLM_TIMEOUT`), or emits malformed JSON (`invalid_output`), BrandGuardian never fabricates LLM findings; deterministic findings remain visible alongside an explicit `AiStatusBanner` displaying sanitized, user-safe guidance without leaking Python exception class names.
