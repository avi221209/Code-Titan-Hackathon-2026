# Verification & Test Evidence (M0 + M1 + QA Round 2)

All outputs below were captured empirically inside `E:\Plugins\Get Shit Done\Code Titan 2026\brandguardian` after Tier A QA fixes (`[DEF-01]`–`[DEF-07]`). Items marked **USER-RUN** require human execution with user-held credentials or the Supabase SQL Editor.

## 1. Python AI Service (`pytest`)

Command: `.\ai-service\.venv\Scripts\python.exe -m pytest -q ai-service`

```text
...........                                                              [100%]
11 passed in 0.39s
```

Live HTTP checks against `http://127.0.0.1:8000`:
- `GET /health` → `HTTP 200` `{"status":"ok","provider":"groq","llm_configured":true,"model":"openai/gpt-oss-20b"}` (`1.7 ms`)
- `GET /` → `HTTP 404` `{"detail":"Not Found"}`
- `POST /review` (valid body, missing or wrong `x-api-key`) → `HTTP 401`
- `POST /review` (`{}` empty body, no key) → `HTTP 422` (logged as Tier B `[DEF-08]`)
- **USER-RUN:** Live Groq `POST http://127.0.0.1:8000/review` with server `.env` `AI_SERVICE_TOKEN`

## 2. TypeScript, Unit Tests & Production Build (`web/`)

Commands executed in `web/`:
- `pnpm typecheck` (`tsc --noEmit`) → **Exit code `0`**
- `pnpm exec tsc --noEmit --noUnusedLocals --noUnusedParameters` → **Exit code `0`**
- `pnpm test` (`node --test lib/validators/*.test.*`) → **6/6 passed** (`m1.test.ts`: route guards, login validation, NUL-byte/array/6,000-char document validation, UUID guard; `security.test.mjs`: `poweredByHeader: false` + hardened headers)
- `pnpm build` (`next build`) → **Exit code `0`** (`102 kB` First Load JS shared by all, routes `103–118 kB`, Middleware `94.5 kB`)

## 3. HTTP Route, API & Header Verification (`next start -p 3000`)

| Endpoint / Route | Auth / Input Case | Observed Result |
| --- | --- | --- |
| `/` | Public GET | `HTTP 200`, `h1Count=1`, updated M1 description, unique `<title>` |
| `/login` | Public GET / Signed-in GET | `HTTP 200` anon; `HTTP 307 -> /dashboard` when signed in |
| `/dashboard`, `/knowledge`, `/documents/new`, `/documents/<uuid>`, `/documents/<uuid>/history` | Unauthenticated GET | All return `HTTP 307`, `Location: /login` |
| `/api/health` | `GET` / `POST` | `GET` `HTTP 200` (`supabase_configured: true`); `POST` `HTTP 405` |
| `/api/documents` | Unauthenticated `GET` / `POST` / `PUT` | `GET`/`POST` `HTTP 401`; `PUT` `HTTP 405` |
| `/api/documents` | Authenticated `GET` | `HTTP 200` (`count=3`, `902.1 ms`) |
| `/api/documents` | Authenticated `POST` invalid inputs (`{bad json`, `[]`, NUL byte `\u0000`, `6001` chars) | All return `HTTP 400` (`254–319 ms`, validated before DB membership query) |
| `/api/documents` + `/documents/[id]` | Authenticated Asterra sample submission + hard reload | Redirected to `/documents/e7e1021f-3e61-4d65-91e0-32a8d11b7b9c`, persisted across reload (`"Review engine arrives in M2"`, `0` Review buttons) |
| `/api/review`, `/api/suggestions/<uuid>/decision` | `POST` | Intentional stub `HTTP 501` `{"error":"not_implemented"}` |
| `/nonexistent-route-qa` | Authenticated GET | `HTTP 404`, `<h1>Page not found</h1>` |
| `/documents/not-a-uuid/history` | Authenticated GET | Renders `<h1>Page not found</h1>` via `notFound()` (`HTTP 200` stream under parent `loading.tsx`, logged as Tier B `[DEF-12]`) |

Verified HTTP Response Headers (`/`, `/login`, `/api/health`):
- `X-Powered-By`: absent (`null`)
- `Content-Security-Policy`: `default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co`
- `Permissions-Policy`: `camera=(), microphone=(), geolocation=()`
- `X-DNS-Prefetch-Control`: `off`
- `X-Content-Type-Options`: `nosniff`, `X-Frame-Options`: `DENY`, `Referrer-Policy`: `strict-origin-when-cross-origin`

## 4. Headless Chromium E2E & Accessibility (`1440px` & `375px`)

- Incognito `/dashboard` -> `/login` -> `"Enter demo workspace"` -> `/dashboard` rendering real Asterra counts (`5` rules / `5` facts / `2` terminology) and saved drafts (`Admin` role badge).
- `/knowledge` keyboard tabbing (`ArrowRight`, `ArrowRight`, `Home`) verified Rules (`5`), Facts (`5`, `2021`), and Terminology (`2`, `customers`).
- `/documents/new` client validation + `"Load Asterra sample"` (`163 / 6,000`) + `"Save document"` -> `/documents/[id]` + hard refresh persistence.
- `/documents/[id]/history` renders `<h1>Document Audit History</h1>`, `"Back to document"` link, and M3 placeholder.
- **Happy-flow errors:** `0` console errors, `0` uncaught `pageerror`, `0` CSP `securitypolicyviolation` events.
- **Accessibility:** Every audited view renders `<html lang="en">`, 1 `<main>`, 1 `<h1>`, unique page `<title>`, `0` unlabeled visible inputs, `0` unnamed buttons/links, `0` horizontal overflow on `1440px` and `375px`, WCAG AA contrast `>= 4.5:1`.

## 5. Security, Secrets & Git Isolation Checks

- `git check-ignore -v .env web/.env web/.env.local ai-service/.env ai-service/.env.local`: all matched by `.gitignore`.
- Static bundle & `'use client'` scan: `STATIC_SECRET_HITS=0` across `.next/static/**/*.js`, `0` secret identifiers in `'use client'` files, `0` non-allowlisted `NEXT_PUBLIC_*` vars, `0` tracked secrets in `git log -p`.
- **USER-RUN:** `supabase/tests/rls_checks.sql` (Block 1 cases `a`–`e` + Block 2 `pg_policies` summary) to be executed in Supabase SQL Editor.
