# BrandGuardian Architecture

## System Overview

BrandGuardian uses a three-part separation of concerns designed around strict RLS tenancy and server-side verification:

1. **`web/` (Next.js App Router + TypeScript + Tailwind CSS):**
   - Renders editorial SaaS workspace views using design tokens (`Warm Paper #F7F5F0`, `Ink #14171C`, `Deep Teal #0F6B6B`).
   - Acts as the sole BFF caller to `ai-service/`.
   - Separates Supabase clients across three explicit contexts:
     - `lib/supabase/browser.ts` (`createBrowserClient` with anon key)
     - `lib/supabase/server.ts` (`createServerClient` with cookie store for SSR/route handlers)
     - `lib/supabase/admin.ts` (service-role client guarded by `import 'server-only'`)

2. **`ai-service/` (Python FastAPI):**
   - Stateless inspection microservice that never connects directly to Supabase.
   - Executes deterministic checks (`check_terminology`, `check_facts`, `check_rules`) before optional LLM review (`ollama` or `groq`).
   - Enforces span verification (`verify()`) so every `Finding` quote maps directly to exact character offsets in the source text and references workspace knowledge IDs.
   - Returns `ReviewResponse` with honest `ai_status` (`ok | unavailable | invalid_output | skipped`).

3. **`supabase/` (PostgreSQL + Auth + RLS):**
   - Schema DDL and RLS policies live in `supabase/migrations/0001_schema.sql`.
   - Synthetic Asterra seed data is isolated in `supabase/seed.sql`.
   - Denormalized `workspace_id` on child tables keeps RLS policies simple and non-recursive via `security definer` helpers (`public.is_member`, `public.has_role`).

## Trust Boundaries

- **Browser -> Next.js:** User cookies only; no service-role keys, no direct FastAPI access, no LLM credentials.
- **Next.js Server -> Supabase:** Reads workspace knowledge under user RLS; writes `review_runs`, `findings`, and `suggestions` exclusively via `createAdminClient()` (`server-only`).
- **Next.js Server -> AI Service:** Authenticated via `x-api-key` (`AI_SERVICE_TOKEN` compared with `hmac.compare_digest`). Document content is wrapped in `<document>` delimiters with tag-escape sanitization.
