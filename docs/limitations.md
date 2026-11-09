# Known Limitations

## Milestone 0 (Current State)
- **Structure Only:** Authentication, database persistence, review triggering, and decision workflows are intentionally unimplemented (`501 Not Implemented` API stubs and placeholder pages).
- **Database Not Applied:** `supabase/migrations/0001_schema.sql` and `supabase/seed.sql` have not been executed against a live Supabase project yet.

## Architectural & Engine Limitations (From Pack Design)
- **Deterministic Fact Pattern Scope:** Regex fact matching (`approved_facts.match_pattern`) only catches facts phrased in structures the pattern expects; it is not open-ended general fact verification.
- **Broad Promotional Rule Patterns:** Seeded claim rules (e.g., matching `"best"` or `"guarantee"`) can trigger false positives on benign uses; human review remains required.
- **Unicode Offset Divergence:** Python string offsets (`start_offset`, `end_offset`) count Unicode code points, whereas JavaScript strings index UTF-16 code units. Frontend highlighting (M2) must verify `text.slice(start, end) === matched_text` and fall back to `indexOf` if needed.
- **Character Limit:** Submitted content is capped at 6,000 characters (`MAX_CONTENT = 6000`).
- **Small Model Tone Limitations:** Best-effort tone checks via local 3B models (`qwen2.5:3b`) can miss nuance; findings from LLM origin remain marked `unverified` unless linked to a valid supplied `source_id`.
