# AI Assistance & Governance Disclosure

## Product AI Usage
BrandGuardian combines deterministic Python rule/fact/terminology matching with optional structured-output LLM analysis inside `ai-service/main.py`:

- **Providers Supported:** Local inference via **Ollama** (default `qwen2.5:3b`) or hosted inference via **Groq** (`openai/gpt-oss-20b`), selectable via `LLM_PROVIDER`.
- **Untrusted Input Guardrails:** Submitted documents are treated as untrusted data inside `<document>` boundaries, with model access restricted to structured JSON extraction (no tools, no external network access).
- **Verification Discipline:**
  - Deterministic findings matching supplied workspace knowledge IDs are labelled `verified` (`origin: "deterministic"`).
  - LLM-suggested findings are located by substring match (never trusting model-computed offsets), dropped if absent from the text, and explicitly marked `AI-generated` (`origin: "llm"`).
- **Failure Honesty:** If the LLM provider is unreachable (`unavailable`) or fails Pydantic schema validation (`invalid_output`), deterministic findings are still returned alongside an explicit status banner rather than fabricating AI results.
- **Human Authority:** BrandGuardian never auto-approves or publishes content. Human reviewers make final decisions (`accepted`, `edited`, `rejected`, `dismissed`) recorded in `review_decisions` and `audit_events`.

## Demo & Seed Data
All reference guidelines, facts, and terminology in `supabase/seed.sql` belong to the synthetic fictional brand **Asterra**. No proprietary or confidential client data is stored or transmitted.
