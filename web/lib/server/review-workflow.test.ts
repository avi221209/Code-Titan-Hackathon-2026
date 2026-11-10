import test from 'node:test';
import assert from 'node:assert/strict';
import { executeReviewWorkflow } from './review-workflow.ts';
import { FixedWindowRateLimiter } from './rate-limit.ts';
import type { StructuredLogger } from './logger.ts';

const DOC_ID = '550e8400-e29b-41d4-a716-446655440010';
const WS_ID = '550e8400-e29b-41d4-a716-446655440020';
const USER_ID = '550e8400-e29b-41d4-a716-446655440030';
const RUN_ID = '550e8400-e29b-41d4-a716-446655440040';

interface CapturedFilterCall {
  table: string;
  selectCols: string;
  eqs: Array<[string, unknown]>;
  ors: string[];
}

function createMemoryLogger(): {
  logger: StructuredLogger;
  entries: Array<{ level: string; event: string; meta: Record<string, unknown> }>;
} {
  const entries: Array<{
    level: string;
    event: string;
    meta: Record<string, unknown>;
  }> = [];
  return {
    entries,
    logger: {
      info(event, meta = {}) {
        entries.push({ level: 'info', event, meta });
      },
      warn(event, meta = {}) {
        entries.push({ level: 'warn', event, meta });
      },
      error(event, meta = {}) {
        entries.push({ level: 'error', event, meta });
      },
    },
  };
}

test('executeReviewWorkflow filters approved_facts by UTC validity dates and guideline_rules by guidelines.status=approved', async () => {
  const capturedQueries: CapturedFilterCall[] = [];
  let sentKnowledgePayload: Record<string, unknown> | null = null;

  const mockSupabase = {
    auth: {
      async getUser() {
        return { data: { user: { id: USER_ID } }, error: null };
      },
    },
    from(table: string) {
      const state: CapturedFilterCall = {
        table,
        selectCols: '',
        eqs: [],
        ors: [],
      };
      const chain = {
        select(cols: string) {
          state.selectCols = cols;
          return chain;
        },
        eq(col: string, val: unknown) {
          state.eqs.push([col, val]);
          return chain;
        },
        or(expr: string) {
          state.ors.push(expr);
          return chain;
        },
        async maybeSingle() {
          capturedQueries.push(state);
          return {
            data: {
              id: DOC_ID,
              workspace_id: WS_ID,
              content: 'Our consumers founded in 2021 love Asterra Flow.',
              status: 'draft',
            },
            error: null,
          };
        },
        then(resolve: (value: { data: unknown[]; error: null }) => void) {
          capturedQueries.push(state);
          if (table === 'terminology') {
            resolve({ data: [], error: null });
            return;
          }
          if (table === 'approved_facts') {
            resolve({
              data: [
                {
                  id: 'f1',
                  fact_text: 'Founded in 2021',
                  topic: 'founded',
                  value: '2021',
                  match_pattern: 'founded in (\\d{4})',
                  source_name: 'Fact sheet',
                },
              ],
              error: null,
            });
            return;
          }
          resolve({
            data: [
              {
                id: 'r1',
                category: 'messaging',
                rule_text: 'Write Asterra Flow',
                severity: 'medium',
                pattern: null,
                suggestion: null,
                guidelines: { status: 'approved' },
              },
            ],
            error: null,
          });
        },
      };
      return chain;
    },
  };

  const mockAdmin = {
    from(table: string) {
      if (table === 'review_runs') {
        let mode: 'select' | 'insert' | 'update' = 'select';
        let inserted = false;
        const chain = {
          select() {
            return chain;
          },
          insert() {
            mode = 'insert';
            inserted = true;
            return chain;
          },
          update() {
            mode = 'update';
            return chain;
          },
          eq() {
            return chain;
          },
          order() {
            return chain;
          },
          async single() {
            return {
              data: { id: RUN_ID, started_at: new Date().toISOString() },
              error: null,
            };
          },
          then(resolve: (value: { data: unknown; error: null }) => void) {
            if (mode === 'update') {
              resolve({ data: null, error: null });
              return;
            }
            resolve({
              data: inserted
                ? [{ id: RUN_ID, started_at: new Date().toISOString() }]
                : [],
              error: null,
            });
          },
        };
        return chain;
      }

      const noopChain = {
        insert() {
          return noopChain;
        },
        update() {
          return noopChain;
        },
        delete() {
          return noopChain;
        },
        select() {
          return noopChain;
        },
        eq() {
          return noopChain;
        },
        then(resolve: (value: { data: unknown[]; error: null }) => void) {
          resolve({ data: [], error: null });
        },
      };
      return noopChain;
    },
  };

  const { logger } = createMemoryLogger();

  const res = await executeReviewWorkflow({
    isSupabaseConfigured: true,
    body: { documentId: DOC_ID },
    todayUtc: '2026-11-10',
    logger,
    serverEnv: {
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
      SUPABASE_SERVICE_ROLE_KEY: 'service',
      AI_SERVICE_URL: 'https://ai.example.test',
      AI_SERVICE_TOKEN: 'secret-token-never-logged',
    },
    supabase: mockSupabase as never,
    admin: mockAdmin as never,
    fetchImpl: async (_url, init) => {
      const payload = JSON.parse(String(init?.body ?? '{}'));
      sentKnowledgePayload = payload.knowledge;
      return new Response(
        JSON.stringify({
          document_id: DOC_ID,
          model_name: 'openai/gpt-oss-20b',
          ai_status: 'ok',
          ai_detail: null,
          dropped: 0,
          elapsed_ms: 42,
          findings: [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    },
  });

  assert.equal(res.status, 200);

  const factsQuery = capturedQueries.find((q) => q.table === 'approved_facts');
  assert.ok(factsQuery);
  assert.deepEqual(factsQuery.ors, [
    'valid_from.is.null,valid_from.lte.2026-11-10',
    'valid_until.is.null,valid_until.gte.2026-11-10',
  ]);

  const rulesQuery = capturedQueries.find((q) => q.table === 'guideline_rules');
  assert.ok(rulesQuery);
  assert.match(rulesQuery.selectCols, /guidelines!inner\(status\)/);
  assert.equal(
    rulesQuery.eqs.some(
      ([col, val]) => col === 'guidelines.status' && val === 'approved'
    ),
    true
  );

  // Strip join wrapper object before posting to FastAPI RuleIn
  const sentRules = (sentKnowledgePayload as { rules?: Array<Record<string, unknown>> } | null)?.rules ?? [];
  assert.equal(sentRules.length, 1);
  assert.equal('guidelines' in sentRules[0], false);
});

test('executeReviewWorkflow maps partial unique index violation (23505) on review_runs insert to HTTP 409', async () => {
  const { logger, entries } = createMemoryLogger();

  const mockSupabase = {
    auth: {
      async getUser() {
        return { data: { user: { id: USER_ID } }, error: null };
      },
    },
    from() {
      const chain = {
        select() {
          return chain;
        },
        eq() {
          return chain;
        },
        or() {
          return chain;
        },
        async maybeSingle() {
          return {
            data: {
              id: DOC_ID,
              workspace_id: WS_ID,
              content: 'Valid content',
              status: 'draft',
            },
            error: null,
          };
        },
        then(resolve: (value: { data: unknown[]; error: null }) => void) {
          resolve({ data: [], error: null });
        },
      };
      return chain;
    },
  };

  const mockAdmin = {
    from() {
      const chain = {
        select() {
          return chain;
        },
        insert() {
          return chain;
        },
        eq() {
          return chain;
        },
        async single() {
          return {
            data: null,
            error: {
              code: '23505',
              message: 'duplicate key value violates unique constraint "uq_review_runs_one_running"',
            },
          };
        },
        then(resolve: (value: { data: unknown[]; error: null }) => void) {
          resolve({ data: [], error: null });
        },
      };
      return chain;
    },
  };

  const res = await executeReviewWorkflow({
    isSupabaseConfigured: true,
    body: { documentId: DOC_ID },
    serverEnv: {
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
      SUPABASE_SERVICE_ROLE_KEY: 'service',
      AI_SERVICE_URL: 'https://ai.example.test',
      AI_SERVICE_TOKEN: 'secret-token-never-logged',
    },
    supabase: mockSupabase as never,
    admin: mockAdmin as never,
    logger,
  });

  assert.equal(res.status, 409);
  assert.match(String(res.body.error), /already running/i);
  assert.equal(
    JSON.stringify(entries).includes('secret-token-never-logged'),
    false
  );
});

test('executeReviewWorkflow enforces rate limits and never leaks AI_SERVICE_TOKEN or content in logs', async () => {
  const { logger, entries } = createMemoryLogger();
  const limiter = new FixedWindowRateLimiter({
    maxRequests: 1,
    windowMs: 60_000,
    nowMs: () => 10_000,
  });

  const makeMockInput = () => ({
    isSupabaseConfigured: true,
    body: { documentId: DOC_ID },
    rateLimiter: limiter,
    logger,
    serverEnv: {
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
      SUPABASE_SERVICE_ROLE_KEY: 'service',
      AI_SERVICE_URL: 'https://ai.example.test',
      AI_SERVICE_TOKEN: 'super-secret-ai-token',
    },
    supabase: {
      auth: {
        async getUser() {
          return { data: { user: { id: USER_ID } }, error: null };
        },
      },
      from() {
        const chain = {
          select() {
            return chain;
          },
          eq() {
            return chain;
          },
          or() {
            return chain;
          },
          async maybeSingle() {
            return {
              data: {
                id: DOC_ID,
                workspace_id: WS_ID,
                content: 'CONFIDENTIAL_COPY_SHOULD_NOT_BE_LOGGED',
                status: 'draft',
              },
              error: null,
            };
          },
          then(resolve: (value: { data: unknown[]; error: null }) => void) {
            resolve({ data: [], error: null });
          },
        };
        return chain;
      },
    } as never,
    admin: {
      from(table: string) {
        if (table === 'review_runs') {
          let isInsert = false;
          const chain = {
            select() {
              return chain;
            },
            insert() {
              isInsert = true;
              return chain;
            },
            update() {
              return chain;
            },
            eq() {
              return chain;
            },
            order() {
              return chain;
            },
            async single() {
              return {
                data: { id: RUN_ID, started_at: '2026-11-10T09:00:00Z' },
                error: null,
              };
            },
            then(resolve: (value: { data: unknown[]; error: null }) => void) {
              resolve({ data: isInsert ? [] : [], error: null });
            },
          };
          return chain;
        }
        const noopChain = {
          insert() {
            return noopChain;
          },
          update() {
            return noopChain;
          },
          delete() {
            return noopChain;
          },
          eq() {
            return noopChain;
          },
          then(resolve: (value: { data: unknown[]; error: null }) => void) {
            resolve({ data: [], error: null });
          },
        };
        return noopChain;
      },
    } as never,
    fetchImpl: async () => new Response('upstream bad', { status: 503 }),
  });

  const first = await executeReviewWorkflow(makeMockInput());
  assert.equal(first.status, 502);
  const serializedLogs = JSON.stringify(entries);
  assert.equal(serializedLogs.includes('super-secret-ai-token'), false);
  assert.equal(serializedLogs.includes('CONFIDENTIAL_COPY_SHOULD_NOT_BE_LOGGED'), false);
  assert.equal(entries.some((e) => e.level === 'error'), true);

  const second = await executeReviewWorkflow(makeMockInput());
  assert.equal(second.status, 429);
});
