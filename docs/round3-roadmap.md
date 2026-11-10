# BrandGuardian Round 3 Roadmap

Each improvement below explicitly separates **what exists and is verified today** from **what would be built next in Round 3**.

---

## 1. Guideline-Gap Analytics

- **Exists Today:**
  - Every human decision (`accepted`, `edited`, `rejected`, `dismissed`) plus optional `edited_text` and required rejection `comment` is persisted immutably in `review_decisions` (tied `1:1` to `suggestions` -> `findings` -> `source_id`).
  - Chronological `audit_events` (`review.completed`, `decision.recorded`, `document.reviewed`) capture per-run metadata (`total_findings`, `verified_count`, `unverified_count`, `dropped`) and per-decision events.
  - **Analytics UI is NOT built** (no aggregation queries, charts, or rule-health views exist).
- **Next (Round 3):**
  - Build a manager/admin analytics view summarizing override, rejection, and dismissal rates per `guideline_rule` and `category` so brand teams can identify ambiguous guidelines or noisy regex rules (such as overly broad `"best"` matches) and refine source policies from real reviewer feedback.

---

## 2. Trust Layer (Calibration & Model-Call Traceability)

- **Exists Today:**
  - Deterministic-first execution pairs every finding with `verification_status` (`verified` vs `unverified`), `origin` (`deterministic` vs `llm` rendered as `AI-generated`), and confidence explicitly labeled `Confidence: X% (estimate)`.
  - Hallucinated LLM quotes not matching document substrings are discarded (`dropped` counter), High/Critical findings lock **Accept** behind clicking **Inspect evidence**, degraded AI runs surface explicit `AiStatusBanner` states, and `/documents/[id]/history` renders a chronological audit trail.
  - **Confidence calibration and detailed model-call traceability are NOT built** (only `model_name`, `ai_status`, `ai_detail`, `elapsed_ms`, and `dropped` are stored per run).
- **Next (Round 3):**
  - **Confidence calibration:** Replace static heuristics (`0.99` / `0.95` / `0.90` / `0.60`) with calibrated empirical precision intervals derived from historical human `accepted` vs `rejected`/`dismissed` outcomes.
  - **Model-call traceability:** Record sanitized prompt/knowledge snapshot digests, schema-validation retry/repair events, token counts, and upstream latency histograms inside admin-only audit records for compliance auditing.

---

## 3. Multimodal & Accessibility Expansion

- **Exists Today:**
  - The Python checking service (`ai-service/main.py`) separates input models (`ReviewRequest`), modular checker functions (`check_terminology`, `check_facts`, `check_rules`, `run_llm`), and the evidence verifier (`verify()`) from persistence and UI rendering, keeping the checker interface extensible.
  - The reviewer UI implements WCAG AA contrast tokens, `<h1>` landmarks, reduced-motion transitions, keyboard finding navigation (`j` / `k`), and screen-reader `aria-live` status announcements.
  - **Only plain text (`<= 6,000` chars) is analyzed today** (**PDF/DOCX ingestion and image or logo checks are NOT built**).
- **Next (Round 3):**
  - Add extraction adapters for **PDF / DOCX** documents and multi-section web pages mapping normalized text blocks back to source page/paragraph coordinates.
  - Introduce **image/logo/alt-text & visual accessibility** analyzers (brand asset verification, color-contrast and missing alt-text checks) emitting structured evidence into the same `Finding` contract and human decision gate.
