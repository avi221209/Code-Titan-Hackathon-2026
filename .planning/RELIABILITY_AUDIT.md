# BrandGuardian — Pre-Deployment Reliability Audit

> [!IMPORTANT]
> **Post-Remediation Update (`2026-11-10`, Uncommitted Working Tree Ready for Review):**  
> This document records the **Pre-Remediation Baseline Audit** at `HEAD = 03a9c96c32f067936c632c779a60681923a86afe`. Subsequent fixes in the local working tree remediated **`[DEF-09]`**, **`[DEF-11]`**, **`[DEF-12]`**, **`[DEF-16]`**, **`[DEF-17]`** *(code & synthetic harness)*, **`[DEF-18]`** *(app/UI/Python; `0004` CHECKs `USER-RUN`)*, **`[DEF-19]`**, **`[DEF-21]`**, **`[DEF-22]`**, and **`[DEF-23]`** to **`FIXED`**, while completing all code & SQL for **`[DEF-14]`**, **`[DEF-15]`**, and **`[DEF-20]`** logging/rate-limits (remaining live DB apply / Docker / cloud deploy steps are **`USER-RUN`**).  
> - **Post-Remediation Final Verdict:** **`CONDITIONALLY READY (CODE REMEDIATED — AWAITING USER-RUN SQL, LIVE E2E & CLOUD DEPLOY)`**  
> - **Authoritative Post-Remediation Deliverables:** [`.planning/REMEDIATION_REPORT.md`](REMEDIATION_REPORT.md) · [`.planning/REMEDIATION_DIFF_SUMMARY.md`](REMEDIATION_DIFF_SUMMARY.md) · [`.planning/REMEDIATION_TEST_EVIDENCE.md`](REMEDIATION_TEST_EVIDENCE.md) · [`.planning/REMAINING_USER_RUN.md`](REMAINING_USER_RUN.md) · [`.planning/DEFECTS.md`](DEFECTS.md)

**Original Baseline Audit Date:** `2026-11-10` (IST)  
**Baseline Target:** `avi221209/Code-Titan-Hackathon-2026` (`brandguardian/`, branch `main`, `HEAD = 03a9c96`)  
**Baseline Audit Posture:** Strict empirical verification — statuses below in Sections 1–8 reflect the **pre-remediation baseline** before working-tree fixes were implemented.

---

## 1. Overall Release Verdict: **`CONDITIONALLY READY`**

BrandGuardian's core architecture cleanly separates browser sessions, server RLS queries, stateless Python compliance checks, and service-role persistence. All Python unit/auth tests (`12/12`), TypeScript checks (`tsc --noEmit` & `--noUnusedLocals --noUnusedParameters`), web validator/security unit tests (`17/17`), local/isolated clean-env production builds, client bundle secret scans (`39` JS files, `0` hits), security headers, responsive layout checks (`32/32` route×viewport combinations with `0` horizontal overflow), and initial owner-executed RLS isolation checks (`7/7` cases `a–g`) **PASS**.

However, BrandGuardian is **`CONDITIONALLY READY`** — **NOT** ready for unsupervised production/judging until:
1. **Mandatory `USER-RUN` local & cloud verification executes cleanly:** Setting missing local `SUPABASE_SERVICE_ROLE_KEY` & `AI_SERVICE_TOKEN` *(or deploying rotated cloud keys)*, running live M2 review + M3 decision end-to-end DB tests, executing [`supabase/tests/decision_rls.sql`](../supabase/tests/decision_rls.sql), applying [`supabase/migrations/0003_audit_server_only.sql`](../supabase/migrations/0003_audit_server_only.sql), warming Render/Railway `/health`, and confirming a 60s Vercel function timeout (`Fluid Compute` / Pro) via an incognito walkthrough.
2. **Project Owner reviews and decides on the P1/P2 Tier B reliability & trust defects uncovered in this audit (`[DEF-14]`–`[DEF-20]`)** before final freeze or Round 3 hardening.

### Top 5 Release Blockers & Highest-Risk Findings

| Priority | ID | Summary | Where | Release Impact |
| --- | --- | --- | --- | --- |
| **1 (P1)** | **`[DEF-15]`** | Non-transactional 5-step human decision commit + missing `review_runs` partial unique index | [`decision/route.ts`](../web/app/api/suggestions/%5Bid%5D/decision/route.ts#L146-L328), [`review/route.ts`](../web/app/api/review/route.ts#L208-L226) | A transient failure after step 1 locks a suggestion behind `409` while leaving `suggestions.status = 'pending'`. Concurrent runs lack a DB uniqueness guard. |
| **2 (P1)** | **`[DEF-14]`** | Authenticated PostgREST `UPDATE` on `documents` can alter `status` / `content` post-review; `0003` not applied yet | [`0002_rls_hardening.sql`](../supabase/migrations/0002_rls_hardening.sql#L50-L90), [`0003_audit_server_only.sql`](../supabase/migrations/0003_audit_server_only.sql) | Any `creator` can bypass `approver` workflow by patching `documents.status = 'reviewed'` via PostgREST or corrupt finding offsets via `content` edit; `audit_insert` remains open until `0003` runs. |
| **3 (P1)** | **`[DEF-16]`** | Python code-point vs JS UTF-16 offset drift + `indexOf` fallback edits **wrong occurrence**; repeated LLM quotes collapse | [`ai-service/main.py`](../ai-service/main.py#L334), [`review.ts`](../web/lib/validators/review.ts#L384-L447), [`decision.ts`](../web/lib/validators/decision.ts#L151-L182) | Empirically proven: approving replacement for the 2nd `"consumers"` after emojis (`🚀🎉`) rewrites the **1st** `"consumers"` in `"Preview final text"`. |
| **4 (P1)** | **`[DEF-17]`** | `verify()` marks unrelated `rule_id` citations `"verified"`; `/api/review` omits date expiry & parent guideline status filters; facts/terms omitted from LLM prompt | [`ai-service/main.py`](../ai-service/main.py#L216-L269), [`review/route.ts`](../web/app/api/review/route.ts#L163-L178) | Prompt injection / hallucinated category mismatch on any valid `rule_id` gets a green `Verified` badge; expired facts (`valid_until`) and draft guidelines still execute. |
| **5 (P1/P2)** | **`[DEF-18]` / `[DEF-19]`** | **Edit** bypasses High/Critical Evidence gate; shallow `/api/health`; raw Python exception class rendered in UI | [`document-review-workspace.tsx`](../web/components/document-review-workspace.tsx#L1035-L1055), [`health/route.ts`](../web/app/api/health/route.ts#L13), [`ai-status-banner.tsx`](../web/components/ai-status-banner.tsx#L75) | Clicking **Edit** succeeds without inspecting High/Critical evidence; `/api/health` returns `ai_service_configured: true` without checking `AI_SERVICE_TOKEN` or `SUPABASE_SERVICE_ROLE_KEY`. |

---

## 2. Phase-by-Phase Audit Scorecard

| Audit Phase | Detailed Report | Empirical Status | Key Result Summary |
| --- | --- | --- | --- |
| **Phase 0: Baseline Checks** | This report (`Section 8` ledger) | **`PASS`** *(Audit Advisories `FAIL`)* | `pytest` `12/12`, `tsc --noEmit` + unused flags `exit 0`, `pnpm test` `17/17`, local + clean build `exit 0`, `pnpm audit` `4` transitive `postcss` advisories (`[DEF-09]`). |
| **Phase 1: Schema & API Contracts** | This report (`Section 3`) | **`FAIL`** (`[DEF-18]`, `[DEF-22]`) | Core enums & `6000` content cap align across SQL/Py/TS; missing DB `CHECK`s (`title<=200`, `confidence [0..1]`, offsets, conditional decision text) & M2–M3 UI copy drift. |
| **Phase 2: AI Trust & Grounding** | [`.planning/AI_TRUST_AUDIT.md`](AI_TRUST_AUDIT.md) | **`FAIL`** (`[DEF-16]`, `[DEF-17]`) | Deterministic + breakout defense `PASS`; det precision `88.89%` (`8/9`, FP `"best practices"`), det recall `61.54%` (`8/13`), semantic `rule_id` verification bug & UTF-16 wrong-occurrence edit fail; live Groq `USER-RUN`. |
| **Phase 3: API Failure Matrix** | [`.planning/API_FAILURE_MATRIX.md`](API_FAILURE_MATRIX.md) | **`FAIL`** (`[DEF-15]`, `[DEF-19]`) | FastAPI `401` auth (`Depends(require_key)`) & invalid JSON degradation `PASS`; Web `decision/route.ts` non-transactional 5-write split, raw Python exception banners & shallow health checks `FAIL`; live DB E2E `USER-RUN`. |
| **Phase 4: Security & RLS Isolation** | [`.planning/SECURITY_AUDIT.md`](SECURITY_AUDIT.md) | **`PARTIAL FAIL` / `USER-RUN`** | `0` client secrets (`39` JS files), strong CSP/headers, `rls_checks.sql` `7/7` (`PASS`); post-review `documents` `status`/`content` immutability & composite WS FKs missing (`[DEF-14]`); `decision_rls.sql` + `0003` **`USER-RUN`**. |
| **Phase 5: Decision Workflow & Integrity** | This report (`Section 4`) | **`FAIL`** (`[DEF-15]`, `[DEF-18]`) | Negative API routes (`405`/`401`/`400`/`404`) `PASS`; **Edit** bypasses Evidence gate, `edited` allowed without `suggested_text` in API, preview edits wrong duplicate span, live commit unexecuted (`USER-RUN`). |
| **Phase 6: UI, 4-Viewport & WCAG** | This report (`Section 5`) | **`FAIL` (Contrast/Skip/Nested Interactive)** | `32/32` viewports `0` horizontal overflow, reduced-motion `1e-05s`, `2px` focus rings; `--border-subtle` fails `3:1` WCAG 1.4.11 (`1.22:1`–`1.37:1`), missing skip link, nested `<article tabIndex={0}>` buttons, soft-404 `200` (`[DEF-12]`), SSR latency `2.86–4.44s` (`[DEF-11]`). |
| **Phase 7: Deployment Readiness** | [`.planning/DEPLOYMENT_READINESS.md`](DEPLOYMENT_READINESS.md) | **`PASS` (Repo) / `USER-RUN` (Live)** | `Dockerfile` non-root + clean env build `PASS`; Docker CLI absent (`USER-RUN`), Render/Railway + Vercel deploy, key rotation, Fluid Compute `60s` check & Supabase Auth URL updates `USER-RUN`. |
| **Phase 8: CI/CD Workflow Spec** | This report (`Section 6`) | **`FAIL` (Absent)** / Proposed | `.github/workflows/` does not exist in repo; reproducible CI YAML specification proposed in `Section 6`. |

---

## 3. Phase 1 — Field-by-Field Contract Matrix & Doc-vs-Code Drift

*(Verified directly against `0001_schema.sql`, `0002_rls_hardening.sql`, `ai-service/main.py`, `web/lib/types/finding.ts`, `web/lib/validators/*.ts`, and Next.js route handlers.)*

### 3.1 Schema & Transport Field Parity

| Entity & Field | SQL Type & Constraint (`0001`/`0002`) | Python Model (`ai-service/main.py`) | TypeScript Contract & Validator (`web/`) | Parity / Contract Drift |
| --- | --- | --- | --- | --- |
| **`documents.id`** | `uuid PK default gen_random_uuid()` | `ReviewRequest.document_id: str` | `string`, `isUuid()` | **Note:** Python accepts any `str` (trusts Next.js UUID check). |
| **`documents.title`** | `text not null` **(NO length CHECK)** | *Not sent* | TS: trimmed `1..200` chars, no `\u0000` (`m1.ts:70-79`) | **`[DEF-18]`:** PostgREST `INSERT`/`UPDATE` can write `""` or `>200` chars bypassing `validateDocumentInput()`. |
| **`documents.content`** | `text not null check (char_length(content) <= 6000)` | `str = Field(max_length=6000)` (`main.py:81`) | TS: `\r\n->\n`, trimmed non-empty, `<=6000` (`m1.ts:81-90`) | Parity on `6000`. Note SQL allows whitespace-only `"   "`. |
| **`documents.status`** | `text default 'draft' check (in ('draft','in_review','reviewed'))` | *Not sent* | `'draft' \| 'in_review' \| 'reviewed'` | **`[DEF-14]`:** Authenticated `creator` can `PATCH` `status` via PostgREST (`0002` only locks `workspace_id`, `created_by`). |
| **`documents.version`** | `int not null default 1` | *Not sent* | Read & displayed (`v1`), **never incremented** | **`[DEF-23]`:** Vestigial column; docs cannot be edited/versioned in MVP. |
| **`guidelines.status`** | `text default 'approved' check (in ('draft','approved','archived'))` | *Guidelines table not passed* | Ignored in `POST /api/review:174` & `/knowledge:92` | **`[DEF-17]`:** Rules under `'draft'`/`'archived'` guidelines run if `approved=true`; UI renders `'Approved'` badge unconditionally. |
| **`guideline_rules.category`** | `text check (in ('tone','terminology','fact','unsupported_claim','messaging'))` | `Rule.category: str` (`main.py:65`, validated in `check_rules` fallback to `'messaging'`) | `string` -> `Category` | Minor: `Rule` doesn't use `Category` `Literal`; unknown category silently degrades to `'messaging'`. |
| **`approved_facts.valid_from/until`** | `date null` | *Fields absent from `Fact` (`main.py:54-60`)* | Omitted from `POST /api/review:170` query | **`[DEF-17]`:** Expired facts (`status='active'` with past `valid_until`) still enforce compliance errors. |
| **`Finding.category`** | `check (in 5 categories)` (`0001:105`) | `Category` (5 values); `LlmItem` restricts to `3` (`tone\|messaging\|unsupported_claim`) | `Category` (5 values) validated in `review.ts:128-133` | Clean alignment. |
| **`Finding.severity`** | `check (in ('critical','high','medium','low'))` | `Severity` (4 values); `LlmItem` restricts to `high\|medium\|low` | `Severity` (4 values) sorted `0..3` | Clean alignment. |
| **`Finding.start_offset / end_offset`** | `int not null` **(NO `>=0` / `>` CHECK)** | `int` (Python code points; **not bounded** in model, checked in `verify()`) | `integer`, `start >= 0 && end > start` (`review.ts:151-157`) | **`[DEF-16]` & `[DEF-18]`:** Python code points vs JS UTF-16 code units cause wrong-occurrence edits; DB lacks `start_offset >= 0 AND end_offset > start_offset`. |
| **`Finding.confidence`** | `numeric(3,2) null` **(allows `-9.99..9.99`)** | `float = 0.5` (**no `ge=0, le=1`**) | Number clamped `[0..1]`, rounded 2 decimals (`review.ts:192-196`) | **`[DEF-18]`:** Missing range check in Python & PostgreSQL. |
| **`Finding.source_type / source_id`** | `text null`, `uuid null` | `Optional[str]`, `Optional[str]` | Validated set `terminology\|fact\|guideline_rule\|model\|null`; non-UUID `source_id` coerced to `null` at insert (`review/route.ts:300`) | Clean; prevents `22P02` UUID syntax failure if AI emits malformed `source_id`. |
| **`Finding.suggested_text` -> `suggestions`** | On `public.suggestions.suggested_text text null` (`0001:123`) | `Finding.suggested_text: Optional[str] = None` | `string \| null`; persisted 1-to-1 (`review/route.ts:323-327`) | Clean 1:1 mapping (`suggestions.finding_id` is `UNIQUE`). |
| **`review_runs.ai_detail`** | **Column absent on `review_runs`** (`0001:89-99`) | `ReviewResponse.ai_detail: Optional[str]` | Stored in `audit_events.metadata.ai_detail` (`review/route.ts:374`) | Fragile coupling (`[DEF-22]`): page reload recovers `ai_detail` only if matching `audit_events` row is in top 10. |
| **`review_decisions.decision`** | `check (in ('accepted','edited','rejected','dismissed'))` | *Not in Python* | Same 4 enums (`decision.ts:12-17`) | Clean enum alignment. |
| **`review_decisions.edited_text / comment`** | `text null` **(NO conditional/length CHECK)** | *Not in Python* | `<=500` trimmed; `edited` requires `edited_text`, `rejected` requires `comment` (`decision.ts:78-118`) | **`[DEF-18]`:** Direct PostgREST `INSERT` can record `'edited'` with `edited_text = NULL` or `'rejected'` with `comment = NULL`; API allows `'edited'` even when `suggested_text IS NULL`. |

### 3.2 Doc-vs-Code Drift Table (`[DEF-22]`)

| File & Line | Claimed / Displayed Text | Actual Codebase Reality |
| --- | --- | --- |
| [`web/app/page.tsx:24-25`](../web/app/page.tsx#L24-L25) | `"Automated compliance review runs and decision workflows arrive in M2–M3."` | Both M2 and M3 are **implemented in codebase**; landing page shows stale M1 copy to judges. |
| [`web/components/new-document-form.tsx:183`](../web/components/new-document-form.tsx#L183) | `"...automated compliance review launches in M2."` | Same stale M1 copy displayed above **Save document** button. |
| [`docs/features.md:17`](../docs/features.md#L17) | Calls `markRunFailed` `"atomic"` rollback | [`review/route.ts:47-55`](../web/app/api/review/route.ts#L47-L55) runs two sequential HTTP calls (`delete(findings)` then `update(review_runs)`), neither transactional nor error-checked. |
| [`ai-service/.env.example`](../ai-service/.env.example) vs [`docs/deployment.md:93`](../docs/deployment.md#L93) | `deployment.md` documents `GROQ_URL`; [`main.py:34`](../ai-service/main.py#L34) reads `os.getenv("GROQ_URL")` | `ai-service/.env.example` omits `GROQ_URL`. |
| [`web/app/(app)/knowledge/page.tsx:127`](../web/app/%28app%29/knowledge/page.tsx#L127) | `statusLabel: row.approved ? 'Approved' : 'Draft'` | Ignores joined `guidelines.status` (`archived` or `draft` parent guideline still labels rule `'Approved'`). |
| [`README.md:13-14`](../README.md#L13-L14), [`docs/contributions.md`](../docs/contributions.md) | `<WEB_URL>`, `<AI_URL>`, `[Placeholder ...]` | Intentional pre-deploy `USER-RUN` placeholders; **must** be replaced before submission. |

---

## 4. Phase 5 — Human Decision Workflow & Partial-Failure Integrity

### 4.1 Workflow State Machine & Server Persistence Trace

```text
Document:  [draft] ──(POST /api/review completes)──> [in_review] ──(all latest-run suggestions != 'pending')──> [reviewed]
Suggestion: [pending] ──(POST /api/suggestions/[id]/decision)──> [accepted | edited | rejected | dismissed] (1-time via UNIQUE)
```

1. **Non-Transactional 5-Step Commit in [`decision/route.ts:146-328`](../web/app/api/suggestions/%5Bid%5D/decision/route.ts#L146-L328) (`[DEF-15]`, P1):**
   - Step 1: `supabase` (USER RLS) inserts `review_decisions` (`suggestion_id` has `UNIQUE` constraint).
   - Step 2: `createAdminClient()` instantiates (`try/catch` returns `500` if `SUPABASE_SERVICE_ROLE_KEY` missing!).
   - Step 3: `admin` updates `suggestions.status`.
   - Step 4: `admin` inserts `audit_events` (`decision.recorded`).
   - Step 5: `admin` queries latest completed run's suggestions; if none are `'pending'`, updates `documents.status = 'reviewed'` and inserts `audit_events` (`document.reviewed`).
   - **Failure Impact:** If **Step 2, 3, 4, or 5 fails** (or `SUPABASE_SERVICE_ROLE_KEY` is missing), the API returns `HTTP 500` **after Step 1 has already committed**. Every subsequent retry by the user receives **`HTTP 409 ("This suggestion has already been decided.")`**, `suggestions.status` remains `'pending'`, UI buttons stay unlocked after refresh (`document-review-workspace.tsx` derives decision from `review_decisions`, wait: `/documents/[id]/page.tsx:245` joins `review_decisions` so card renders the decision badge, **HOWEVER** `suggestions.status` stays `'pending'`, so **`documents.status` can NEVER automatically transition to `'reviewed'`** cleanly!).
2. **Evidence Gate Bypass on **Edit** (`[DEF-18]`, P1 UX/Compliance):**
   - [`document-review-workspace.tsx:837-848`](../web/components/document-review-workspace.tsx#L837-L848) sets `acceptDisabled` to check `(isHighOrCritical && !evidenceWasOpened)`, whereas `Edit` uses `commonActionDisabled` (`:1039`) which **does not** check `evidenceWasOpened`.
   - **Impact:** A reviewer can click **Edit** on a **Critical** `"guarantee 300%..."` finding, leave **Evidence** collapsed/unread, click **Save edit**, and approve the change with zero evidence inspection.
3. **`edited` API vs UI Contract Mismatch (`[DEF-18]`, P2):**
   - When `finding.suggested_text === null` (e.g., all LLM findings or rule `001`), the UI hides both **Accept** and **Edit** (`document-review-workspace.tsx:1021`). However, [`decision/route.ts:113-124`](../web/app/api/suggestions/%5Bid%5D/decision/route.ts#L113-L124) only blocks `decision === 'accepted'` (`suggestion.suggested_text === null`), still allowing direct `POST` callers to save `decision: 'edited'`.
4. **Silent Failure in [`review/route.ts:392-400`](../web/app/api/review/route.ts#L392-L400) & [`markRunFailed:47-55`](../web/app/api/review/route.ts#L47-L55):**
   - Updating `documents.status` to `'in_review'` ignores errors (`await admin.from('documents').update(...)` return value unchecked); if a document was previously `'reviewed'`, re-running review keeps `documents.status = 'reviewed'` if `doc.status !== 'in_review'`? Wait: `'reviewed' !== 'in_review'` is true, so it DOES flip `'reviewed'` -> `'in_review'` intentionally, **unless** that un-checked update fails silently.
5. **Graceful Profile Lookup Fallback (`web/lib/profiles.ts:27-65`):**
   - Verified `loadProfileNamesMap()` gracefully falls back when `SUPABASE_SERVICE_ROLE_KEY` is absent, returning `{}` for other reviewers and falling back to `'Workspace reviewer'` / `'Workspace member'` / signed-in `email` (`PASS`).

---

## 5. Phase 6 — 4-Viewport Playwright, Accessibility, WCAG & Performance Audit

### 5.1 Playwright Multi-Viewport Matrix (`next start -p 3105`, Chromium `steps/2158/output.txt`)

All 8 routes were audited across **`1440×900` (desktop)**, **`1024×768` (laptop)**, **`768×1024` (tablet portrait)**, and **`375×812` (mobile)** against live remote Supabase auth & seeded workspace data (`Asterra (demo)`):

| Route | Viewports Tested | Navigation Timing Range (ms) | Horizontal Overflow (`scrollWidth > innerWidth`) | Landmarks, `<h1>`, Inputs, Buttons, Links, SVGs | Findings / Issues |
| --- | --- | --- | --- | --- | --- |
| **`/`** (public) | 4/4 | `542.8` (`375`) – `653.1` (`1440`) | **`0/4` (`false`)** | `lang="en"`, `1` main, `1` `<h1>`, `0` skipped headings, `0` unnamed controls, `0` unhidden SVGs | **`hasSkipLink: false`**; stale M2–M3 text (`[DEF-22]`). |
| **`/login`** (public) | 4/4 | `527.2` (`768`) – `539.9` (`1024`) | **`0/4` (`false`)** | Valid `<label>`, `Enter a valid email address.` inline alert, `0` unnamed buttons/inputs | **`hasSkipLink: false`**. |
| **`/nonexistent-audit-route-xyz`** | 4/4 | `543.4` (`768`) – `552.1` (`1440`) | **`0/4` (`false`)** | HTTP `404`, `<h1>Page not found</h1>`, clean navigation links | **`PASS`** (nonexistent paths return real `404`). |
| **`/dashboard`** (auth) | 4/4 | **`2219.9` – `3692.7`** *(warm `[4441.9, 2908.4, 3296.4, 2857.0]`)* | **`0/4` (`false`)** | `<h1>Asterra (demo)</h1>`, `1` nav, `0` unnamed links/buttons | **`[DEF-11]` (P1):** Warm SSR exceeds `3s` on 2/4 runs (sequential TLS `getUser()` in middleware + page); **`hasSkipLink: false`**. |
| **`/knowledge`** (auth) | 4/4 | `1485.4` (`375`) – `1655.6` (`1440`) | **`0/4` (`false`)** | `<h1>Brand Rules, Facts & Terminology</h1>`, **`knowledge_keyboard_tabs_ok: true`** | **`[DEF-17]`/`[DEF-22]`:** Draft/archived guideline status hidden behind `'Approved'`. |
| **`/documents/new`** (auth) | 4/4 | `1516.4` (`1440`) – `1755.6` (`375`) | **`0/4` (`false`)** | Blank submit alert `"Document title is required."`, labeled title & textarea | **`[DEF-21]`:** `Textarea` lacks `aria-[invalid=true]:border-destructive`; stale M2 copy (`:183`). |
| **`/documents/[id]`** (auth) | 4/4 | `2030.3` (`375`) – `3258.0` (`768`) | **`0/4` (`false`)** | `<h1>Asterra Flow Launch Draft</h1>`, clean empty banner before first run | **`[DEF-21]`:** `<article tabIndex={0}>` wraps interactive child buttons (`:852-858`); **`[DEF-12]`:** bad UUID returned HTTP **`200`** (`auth_soft404_probe`). |
| **`/documents/[id]/history`** (auth) | 4/4 | `1942.4` (`1440`) – `2139.5` (`375`) | **`0/4` (`false`)** | `<h1>Document Audit History</h1>`, clean empty state | **`[DEF-12]`:** missing UUID returned HTTP **`200`** (`auth_soft404_probe`). |

- **Runtime Errors During Playwright Session:** `page_errors: []`, `csp_violations: []`; the 4 `console_errors` entries in `steps/2158/output.txt:883-888` correspond 1:1 to the intentional 4-viewport `/nonexistent-audit-route-xyz` `404` probes.
- **Reduced Motion & Focus Ring (`steps/2158/output.txt:342-347`):** Verified `@media (prefers-reduced-motion: reduce)` yields `transitionDuration: "1e-05s"` (`0.01ms`) and `:focus-visible` renders `outlineStyle: "solid"`, `outlineWidth: "2px"`.

### 5.2 WCAG 2.1 AA Contrast & UI Hygiene Check (`steps/2272/output.txt`)

- **All Text & Severity Badge Pairs (`PASS`):**
  - **Light palette (`:root`):** All `16` foreground/background pairs exceed `4.5:1` (`4.84:1` `medium-fg` `#B45309` on `#FFFBEB` up to `17.96:1` `#14171C` on `#FFFFFF`). Primary teal `#FFFFFF` on `#0F6B6B` = **`6.30:1`**.
  - **Dark palette (`.dark`):** All `16` text pairs exceed `4.5:1` (`5.50:1` up to `15.76:1`). *(Note: `.dark` class toggle is unused in UI — `[DEF-23]`.)*
- **Non-Text Contrast WCAG 1.4.11 Failure (`FAIL`, `[DEF-21]`):**
  - `--border-subtle` (`#E4DFD5`, also mapped to `border-input` in [`tailwind.config.ts:43-44`](../web/tailwind.config.ts#L43-L44)) has luminance contrast of **`1.22:1`** against canvas `#F7F5F0` and **`1.33:1`** against surface `#FFFFFF` (Dark mode `#2A2F38`: **`1.37:1`** / **`1.25:1`**) — failing WCAG 2.1 **1.4.11 Non-text Contrast (`3.0:1`)** for text-input, textarea, and interactive control boundaries.
- **Additional UI/Accessibility Defects (`[DEF-21]` / `[DEF-23]`):**
  - `web/app/(app)/documents/[id]` finding card (`<article tabIndex={0}>` at lines `852-858`) creates nested interactive elements (`<article>` click/focus + inner `<button>`s).
  - Collapsed Medium/Low finding cards display `"Inspect evidence before accepting high or critical findings."` (`document-review-workspace.tsx:965-968`) even when severity is neither High nor Critical.
  - Client Reject inline form (`:1143-1194`) submits blank whitespace straight to the network (`400`) instead of validating locally first.
  - Unused UI primitives add weight/surface area without callers: `web/components/ui/dialog.tsx` (`Dialog*`, lacks focus trap) and `toast` export in `web/components/ui/toast.tsx` (`Toaster` mounted in `layout.tsx:45`). *(Removed cleanly in post-remediation `[DEF-23]`.)*
- **Bundle Footprint (`next build`):** `102 kB` shared First Load JS (`PASS`).

---

## 6. Phase 8 — Proposed GitHub Actions CI Workflow (Specification Only)

`.github/workflows/` currently does **not** exist in the repository. Per audit rules, **no workflow file was created**. Below is the recommended CI specification ready to add at `.github/workflows/ci.yml` once approved:

```yaml
name: BrandGuardian CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  ai-service:
    name: AI Service (pytest)
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ai-service
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.13"
          cache: pip
      - name: Install dependencies and test tools
        run: pip install -r requirements.txt pytest
      - name: Run Python unit & auth tests
        run: pytest -q

  web:
    name: Web App (typecheck, test, audit, clean build, secret scan)
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: web
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: pnpm
          cache-dependency-path: web/pnpm-lock.yaml
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      - name: TypeScript project typecheck
        run: pnpm typecheck
      - name: TypeScript strict unused check
        run: pnpm exec tsc --noEmit --noUnusedLocals --noUnusedParameters
      - name: Run unit & header tests
        run: pnpm test
      - name: Production build with public CI placeholders only
        env:
          NEXT_PUBLIC_SUPABASE_URL: https://example.supabase.co
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ci-public-anon-placeholder
        run: pnpm build
      - name: Security & localhost static scans
        working-directory: .
        run: |
          test -z "$(git ls-files '.env*' '**/.env*' | grep -v '\.env\.example$')"
          ! grep -rnE "localhost|127\.0\.0\.1" web/app web/components web/lib
          ! grep -rnE "SUPABASE_SERVICE_ROLE_KEY|AI_SERVICE_TOKEN|DEMO_PASSWORD|GROQ_API_KEY" web/.next/static
      - name: Dependency vulnerability check
        run: pnpm audit --audit-level=high
```

*(Note: Once `[DEF-09]` is approved and `"lint": "next lint"` is added to `web/package.json`, add a `pnpm lint` step directly after `pnpm typecheck`, and keep `pnpm audit --audit-level=high` failing builds on unpatched `postcss`/Next advisories.)*

---

## 7. Master Defect Register (All Open Defects Across Codebase)

*(Note: `[DEF-01]`–`[DEF-08]` & `[DEF-10]` were resolved and verified prior to this audit. `[DEF-13]` was reserved/unused in prior numbering; `[DEF-09]`, `[DEF-11]`, `[DEF-12]` remain deferred Tier B from prior rounds; `[DEF-14]`–`[DEF-23]` are documented by this audit.)*

| ID | Severity | Tier | Title & Primary Location | Empirical Evidence | Proposed Fix Summary |
| --- | --- | --- | --- | --- | --- |
| **`[DEF-09]`** | `P2` | Tier B | Missing ESLint script + 4 transitive `postcss@8.4.31` advisories (`web/package.json`) | `pnpm --dir web audit --json` exited `1` (`2 high`, `2 moderate`: GHSA-qx2v-qp2m-jg93, 6g55-p6wh-862q, fxqj-rqcc-2cmp, r28c-9q8g-f849). | Add `"lint": "next lint"` + `eslint` + `pnpm.overrides.postcss >= 8.5.23`. |
| **`[DEF-11]`** | `P1` | Tier B | Sequential TLS `getUser()` latency on protected SSR (`web/middleware.ts:48`, `web/lib/workspace.ts:47`) | Playwright `:3105`: `/dashboard` `3692.7 ms` initial; warm `[4441.9, 2908.4, 3296.4, 2857.0] ms`. | Use `getClaims()` with asymmetric JWTs in middleware or single verified auth check per request. |
| **`[DEF-12]`** | `P2` | Tier B | Streaming `loading.tsx` returns `HTTP 200` soft-404 on bad/missing UUIDs (`(app)/**/loading.tsx`) | `auth_soft404_probe`: `bad_uuid_status: 200`, `missing_uuid_history_status: 200`. | Remove `loading.tsx` on `[id]`, `[id]/history`, and `(app)/` group layout so `notFound()` sends `404`. |
| **`[DEF-14]`** | **`P1`** | Tier B | Post-review `documents.status`/`content` mutable via PostgREST; `0003` unapplied; composite WS FKs & `PUBLIC` revoke missing (`supabase/`) | Trigger in `0002:50-74` checks ONLY `workspace_id` & `created_by`; `0003` not applied yet (`audit_insert` active). | New `0004_integrity_and_locks.sql` locking `documents.status` & post-review `content`, adding composite WS FKs + `REVOKE FROM PUBLIC`, plus applying `0003` (`USER-RUN`). |
| **`[DEF-15]`** | **`P1`** | Tier B | Non-transactional 5-write `decision/route.ts` (`409` lockout risk) & missing `review_runs` partial unique index | Code trace of `decision/route.ts:146-328` & `review/route.ts:208-226`; no `UNIQUE (document_id) WHERE status='running'` in `0001`/`0002`. | Single Postgres `SECURITY DEFINER` RPC `record_review_decision(...)` in `0004` + `uq_review_runs_one_running` index. |
| **`[DEF-16]`** | **`P1`** | Tier B | Python code-point vs JS UTF-16 offset drift edits WRONG occurrence; repeated LLM quotes collapse (`ai-service/main.py:334`, `review.ts:405`, `decision.ts:152`) | `audit_web_drift.mjs`: `edited_wrong_occurrence: true` (`py [76,85]` snapped via `indexOf` to `[30,39]`); `duplicate_span_highlighting` rendered `1` highlight for `2` findings. | Compute UTF-16 offsets (or pass occurrence cursor `find(q, cursor)` + occurrence verification) and refuse ambiguous fallback edits. |
| **`[DEF-17]`** | **`P1`** | Tier B | `verify()` ignores semantic category/rule relevance; `/api/review` omits `valid_from`/`valid_until` & `guidelines.status`; facts/terms absent from LLM prompt (`main.py:216,266`, `review/route.ts:168-177`) | Scenario 03 `FN=2` (`0%` unpatterned fact detection), Scenario 04 `expired_fact_bypass_flagged: true`, Scenario 13 & 15_poisoned both labeled `"verified"` on wrong `rule_id`. | Check `rule.category == f.category` (plus rule-specific evidence status) in `verify()`; filter `guidelines.status = 'approved'` & active date window in `/api/review`; pass compact fact/term summary to LLM. |
| **`[DEF-18]`** | **`P1`** | Tier B/A | **Edit** bypasses High/Critical Evidence gate; `edited` API allows `suggested_text: null`; missing DB `CHECK`s (`document-review-workspace.tsx:1039`, `decision/route.ts:113`, `0001_schema.sql`) | `ts_validator_checks.edited_valid_without_suggested_text_rule: true`; schema check `document_title_sql_has_check: false`, `sql_findings_start_end_has_check: false`, `py_has_ge_le: false`; `main.py:332` silent `[:5]` drop (`0` reported). | Apply `isHighOrCritical && !evidenceWasOpened` check to **Edit** button; align `edited` / `suggested_text` policy; add DB `CHECK`s & increment `dropped` on `findings[5:]`. |
| **`[DEF-19]`** | **`P2`** | Tier B | Shallow `/api/health` & `/health`; raw Python exception class (`HTTPStatusError`/`OSError`/`ReadTimeout`) rendered in UI banner (`health/route.ts:13`, `main.py:323,364`, `ai-status-banner.tsx:75`) | `audit_phase3.py`: `04_invalid_groq_api_key` returned `ai_detail: "HTTPStatusError"` & `/health` returned `llm_configured: true`; local `/api/health` returned `ai_service_configured: true` without `AI_SERVICE_TOKEN`/`SUPABASE_SERVICE_ROLE_KEY`. | Return friendly sanitized messages (`"Upstream authentication error"`, `"Rate limit reached"`, etc.) in `main.py:323`; distinguish liveness vs readiness in `/api/health` & `/ready`. |
| **`[DEF-20]`** | **`P2`** | Tier B/A | `maxDuration = 60` vs Vercel Hobby `10s` legacy timeout; Render free-tier cold start `30–50s`; zero structured error logging or rate limiting (`review/route.ts:12`, `actions.ts`) | Verified `AbortSignal.timeout(50_000)` vs `LLM_TIMEOUT=30`+`5s` (`wait_for`) + empty `catch {}` blocks. | Verify Vercel Fluid Compute / Pro `60s`, pre-warm `/health`, add structured error logs (`console.error` with error code only, zero secrets) & rate limiting in Round 3. |
| **`[DEF-21]`** | **`P2`** | Tier A | WCAG 1.4.11 border contrast fail (`1.22:1`–`1.37:1`), no skip link, `<article tabIndex={0}>` nesting buttons, `Textarea` missing `aria-[invalid=true]:border-destructive`, misleading collapsed hint, blank Reject submit (`globals.css:15`, `textarea.tsx:11`, `document-review-workspace.tsx:852,966`) | Computed contrast matrix (`steps/2272`); `hasSkipLink: false` on `32/32` Playwright runs. | Darken `--border-subtle` / `input` border token (`>= 3.0:1`), add skip-to-main link, separate card focus from inner action buttons, add `aria-[invalid=true]` styling & client blank Reject guard. |
| **`[DEF-22]`** | **`P2`** | Tier A | Stale M2–M3 UI copy (`page.tsx:24`, `new-document-form.tsx:183`), `"atomic"` doc misstatement (`features.md:17`), `GROQ_URL` missing from `ai-service/.env.example`, `/knowledge` ignores `guidelines.status`, seed `best practices` FP (`seed.sql:39`) | Direct file reads (`0001`, `seed.sql`, `page.tsx`, `new-document-form.tsx`, `knowledge/page.tsx`) + `phase2_metrics.py` (`det_false_positives: 1`). | Update stale copy & docs, add `GROQ_URL=` to `.env.example`, reflect parent guideline status in `/knowledge`, tighten `"best"` regex heuristic (`(?!\s+practices)` or require comparative context). |
| **`[DEF-23]`** | **`P3`** | Tier B/A | Dead surfaces: `public.comments` table (`0001:138`), unused `documents.version` (`0001:84`), unused `.dark` tokens (`globals.css:49`), unused `Dialog` (`dialog.tsx`, no focus trap) & `toast` (`toast.tsx`) | Verified via `git grep` & feature inventory. | Keep or remove cleanly in Round 3 (ensure `Dialog` gets focus-trap before any future modal use). |

---

## 8. Fresh Command Verification Ledger (Re-Run `2026-11-10`, Agent)

| Check | Exact Command | Outcome | Exit Code |
| --- | --- | --- | --- |
| **Python Unit & Auth Tests** | `.\ai-service\.venv\Scripts\python.exe -m pytest -q ai-service` | `12 passed, 1 warning in 0.39s` | **`0` (`PASS`)** |
| **TypeScript Typecheck** | `pnpm --dir web typecheck` | Clean compile (`tsc --noEmit`) | **`0` (`PASS`)** |
| **TypeScript Unused Audit** | `pnpm --dir web exec tsc --noEmit --noUnusedLocals --noUnusedParameters` | Clean compile (`0` unused locals/params) | **`0` (`PASS`)** |
| **Web Validator & Security Unit Tests** | `pnpm --dir web test` | `17 passed, 0 failed in 194.9ms` | **`0` (`PASS`)** |
| **Web Production Build** | `pnpm --dir web build` | Clean (`102 kB` shared JS, `7/7` static routes) | **`0` (`PASS`)** |
| **Dependency Advisory Audit** | `pnpm --dir web audit --json` | `4` transitive `next > postcss@8.4.31` advisories (`2 high`, `2 moderate`) | **`1` (`FAIL` — `[DEF-09]`)** |
| **Tracked Secret & Client Bundle Scan** | `git ls-files ".env*" "**/.env*"` & `39` `.next/static/**/*.js` files | Only `.env.example` tracked; `0` secret hits in client JS | **`0` (`PASS`)** |
| **4-Viewport Playwright Audit** | `steps/2158/output.txt` (`next start -p 3105`) | `32/32` viewports `0` overflow, `0` page/CSP errors; `hasSkipLink: false`, soft-404 `200`, SSR warm `2.86–4.44s` | **`0`** *(findings logged)* |
| **Synthetic Phase 2 & 3 Harnesses** | `steps/2272/output.txt` (`phase2_metrics.py`, `audit_phase3.py`, `audit_web_drift.mjs`) | FastAPI auth/schema `PASS`; `[DEF-16]`–`[DEF-19]` defects reproduced empirically | **`0`** *(findings logged)* |
| **Live Groq / DB Write / Docker / Cloud** | N/A | **Not executed by agent** (missing server secrets locally, Docker CLI absent, no cloud host credentials) | **`USER-RUN`** |

