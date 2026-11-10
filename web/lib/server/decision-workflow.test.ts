import test from 'node:test';
import assert from 'node:assert/strict';
import { executeDecisionWorkflow } from './decision-workflow.ts';
import { FixedWindowRateLimiter } from './rate-limit.ts';
import type { StructuredLogger } from './logger.ts';

const VALID_SUGGESTION_ID = '550e8400-e29b-41d4-a716-446655440001';
const VALID_USER_ID = '550e8400-e29b-41d4-a716-446655440002';

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

test('executeDecisionWorkflow calls atomic RPC and returns 200 on valid decision', async () => {
  const rpcCalls: Array<{ fn: string; params: Record<string, unknown> }> = [];
  const { logger, entries } = createMemoryLogger();

  const res = await executeDecisionWorkflow({
    isSupabaseConfigured: true,
    suggestionId: VALID_SUGGESTION_ID,
    body: { decision: 'edited', editedText: 'customers', comment: 'Approved glossary term' },
    logger,
    supabase: {
      auth: {
        async getUser() {
          return { data: { user: { id: VALID_USER_ID } }, error: null };
        },
      },
      async rpc(fn, params) {
        rpcCalls.push({ fn, params });
        return {
          data: [
            {
              decision_id: '550e8400-e29b-41d4-a716-446655440099',
              decision: 'edited',
              edited_text: 'customers',
              comment: 'Approved glossary term',
              created_at: '2026-11-10T10:00:00Z',
              document_status: 'reviewed',
            },
          ],
          error: null,
        };
      },
    },
  });

  assert.equal(res.status, 200);
  assert.equal(rpcCalls.length, 1);
  assert.equal(rpcCalls[0].fn, 'record_review_decision');
  assert.deepEqual(rpcCalls[0].params, {
    p_suggestion_id: VALID_SUGGESTION_ID,
    p_decision: 'edited',
    p_edited_text: 'customers',
    p_comment: 'Approved glossary term',
  });
  assert.deepEqual(res.body, {
    decisionId: '550e8400-e29b-41d4-a716-446655440099',
    decision: 'edited',
    editedText: 'customers',
    comment: 'Approved glossary term',
    createdAt: '2026-11-10T10:00:00Z',
    documentStatus: 'reviewed',
  });
  assert.equal(entries.some((e) => e.event === 'decision.recorded'), true);
});

test('executeDecisionWorkflow maps atomic RPC errors accurately without split-write fallbacks', async () => {
  const cases: Array<{
    code: string;
    message: string;
    expectedStatus: number;
    expectedFragment: string;
  }> = [
    {
      code: '23505',
      message: 'duplicate key value violates unique constraint',
      expectedStatus: 409,
      expectedFragment: 'already been decided',
    },
    {
      code: '42501',
      message: 'Your role cannot record decisions',
      expectedStatus: 403,
      expectedFragment: 'role cannot record',
    },
    {
      code: 'P0002',
      message: 'Suggestion not found',
      expectedStatus: 404,
      expectedFragment: 'not found',
    },
    {
      code: '22023',
      message: 'Cannot accept or edit a finding without a suggested revision.',
      expectedStatus: 400,
      expectedFragment: 'without a suggested revision',
    },
    {
      code: 'PGRST202',
      message: 'Could not find the function public.record_review_decision',
      expectedStatus: 503,
      expectedFragment: '0004',
    },
    {
      code: 'XX000',
      message: 'simulated internal failure after insert rolled back',
      expectedStatus: 500,
      expectedFragment: 'No partial changes were committed',
    },
  ];

  for (const item of cases) {
    const { logger, entries } = createMemoryLogger();
    const res = await executeDecisionWorkflow({
      isSupabaseConfigured: true,
      suggestionId: VALID_SUGGESTION_ID,
      body: { decision: 'edited', editedText: 'manual fix' },
      logger,
      supabase: {
        auth: {
          async getUser() {
            return { data: { user: { id: VALID_USER_ID } }, error: null };
          },
        },
        async rpc() {
          return {
            data: null,
            error: { code: item.code, message: item.message },
          };
        },
      },
    });

    assert.equal(res.status, item.expectedStatus, `Failed for SQLSTATE ${item.code}`);
    assert.match(String(res.body.error), new RegExp(item.expectedFragment, 'i'));
    if (item.expectedStatus >= 500) {
      assert.equal(entries.some((e) => e.level === 'error'), true);
    }
  }
});

test('executeDecisionWorkflow enforces per-user rate limiting cleanly (HTTP 429)', async () => {
  let now = 1_000_000;
  const limiter = new FixedWindowRateLimiter({
    maxRequests: 2,
    windowMs: 60_000,
    nowMs: () => now,
  });

  const { logger } = createMemoryLogger();

  const makeInput = () => ({
    isSupabaseConfigured: true,
    suggestionId: VALID_SUGGESTION_ID,
    body: { decision: 'dismissed' },
    rateLimiter: limiter,
    logger,
    supabase: {
      auth: {
        async getUser() {
          return { data: { user: { id: VALID_USER_ID } }, error: null };
        },
      },
      async rpc() {
        return {
          data: [
            {
              decision_id: '550e8400-e29b-41d4-a716-446655440099',
              decision: 'dismissed',
              edited_text: null,
              comment: null,
              created_at: '2026-11-10T10:00:00Z',
              document_status: null,
            },
          ],
          error: null,
        };
      },
    },
  });

  assert.equal((await executeDecisionWorkflow(makeInput())).status, 200);
  assert.equal((await executeDecisionWorkflow(makeInput())).status, 200);
  const blocked = await executeDecisionWorkflow(makeInput());
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers?.['Retry-After']) >= 1);

  now += 60_001;
  assert.equal((await executeDecisionWorkflow(makeInput())).status, 200);
});
