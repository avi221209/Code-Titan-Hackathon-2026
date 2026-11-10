import { validateDecisionInput } from '../validators/decision.ts';
import { isUuid } from '../validators/m1.ts';
import { defaultLogger, type StructuredLogger } from './logger.ts';
import { decisionRateLimiter, type RateLimiter } from './rate-limit.ts';

export interface DecisionRpcRow {
  decision_id: string;
  decision: string;
  edited_text: string | null;
  comment: string | null;
  created_at: string;
  document_status: string | null;
}

export interface DecisionSupabaseLike {
  auth: {
    getUser(): Promise<{
      data: { user: { id: string } | null };
      error: unknown;
    }>;
  };
  rpc(
    fn: string,
    params: Record<string, unknown>
  ): PromiseLike<{
    data: unknown;
    error: { code?: string | null; message?: string | null } | null;
  }>;
}

export interface WorkflowHttpResponse {
  status: number;
  body: Record<string, unknown>;
  headers?: Record<string, string>;
}

function mapDecisionRpcError(
  rpcError: { code?: string | null; message?: string | null },
  context: { suggestionId: string; actorId: string },
  logger: StructuredLogger
): WorkflowHttpResponse {
  const code = rpcError.code ?? '';
  const msg = rpcError.message ?? '';

  if (code === '23505') {
    return {
      status: 409,
      body: { error: 'This suggestion has already been decided.' },
    };
  }

  if (code === '42501') {
    if (/unauthorized/i.test(msg)) {
      return { status: 401, body: { error: 'Unauthorized' } };
    }
    return {
      status: 403,
      body: { error: 'Your role cannot record decisions.' },
    };
  }

  if (code === 'P0002') {
    return { status: 404, body: { error: 'Suggestion not found.' } };
  }

  if (
    code === '22023' ||
    code === '22001' ||
    code === '23514' ||
    code === '22P02'
  ) {
    if (/without a suggested revision/i.test(msg)) {
      return {
        status: 400,
        body: {
          error:
            'Cannot accept or edit a finding without a suggested revision. Use Reject or Dismiss instead.',
        },
      };
    }
    if (/edited text/i.test(msg)) {
      return {
        status: 400,
        body: {
          error: 'Edited text is required when saving an edited revision.',
        },
      };
    }
    if (/rejection reason/i.test(msg)) {
      return {
        status: 400,
        body: {
          error: 'A rejection reason is required when rejecting a finding.',
        },
      };
    }
    return {
      status: 400,
      body: { error: 'Invalid review decision request.' },
    };
  }

  if (code === 'PGRST202' || code === '42883') {
    logger.error('decision.rpc_missing', {
      code,
      suggestionId: context.suggestionId,
      actorId: context.actorId,
    });
    return {
      status: 503,
      body: {
        error:
          'Review decision workflow migration (0004) has not been applied on the database yet.',
      },
    };
  }

  logger.error('decision.rpc_failed', {
    code,
    suggestionId: context.suggestionId,
    actorId: context.actorId,
  });
  return {
    status: 500,
    body: {
      error: 'Unable to save review decision. No partial changes were committed.',
    },
  };
}

export async function executeDecisionWorkflow(input: {
  isSupabaseConfigured: boolean;
  suggestionId: string;
  body: unknown;
  supabase: DecisionSupabaseLike;
  rateLimiter?: RateLimiter | null;
  logger?: StructuredLogger;
}): Promise<WorkflowHttpResponse> {
  const logger = input.logger ?? defaultLogger;
  const limiter =
    input.rateLimiter === undefined ? decisionRateLimiter : input.rateLimiter;

  if (!input.isSupabaseConfigured) {
    return {
      status: 503,
      body: { error: 'Supabase environment variables are not configured.' },
    };
  }

  const {
    data: { user },
    error: authError,
  } = await input.supabase.auth.getUser();

  if (authError || !user) {
    return { status: 401, body: { error: 'Unauthorized' } };
  }

  if (limiter) {
    const rate = limiter.check(`decision:${user.id}`);
    if (!rate.allowed) {
      logger.warn('decision.rate_limited', {
        actorId: user.id,
        retryAfterSeconds: rate.retryAfterSeconds,
      });
      return {
        status: 429,
        headers: { 'Retry-After': String(rate.retryAfterSeconds) },
        body: {
          error: 'Too many decision requests. Please wait a moment and try again.',
        },
      };
    }
  }

  if (!isUuid(input.suggestionId)) {
    return {
      status: 400,
      body: { error: 'A valid suggestion ID UUID is required.' },
    };
  }

  const parsed = validateDecisionInput(input.body);
  if (!parsed.ok) {
    return { status: 400, body: { error: parsed.error } };
  }

  const { data: rpcData, error: rpcError } = await input.supabase.rpc(
    'record_review_decision',
    {
      p_suggestion_id: input.suggestionId,
      p_decision: parsed.data.decision,
      p_edited_text: parsed.data.editedText,
      p_comment: parsed.data.comment,
    }
  );

  if (rpcError) {
    return mapDecisionRpcError(
      rpcError,
      { suggestionId: input.suggestionId, actorId: user.id },
      logger
    );
  }

  const row = (Array.isArray(rpcData) ? rpcData[0] : rpcData) as
    | DecisionRpcRow
    | null
    | undefined;

  if (!row || !row.decision_id) {
    logger.error('decision.empty_rpc_result', {
      suggestionId: input.suggestionId,
      actorId: user.id,
    });
    return {
      status: 500,
      body: {
        error:
          'Unable to save review decision. No partial changes were committed.',
      },
    };
  }

  logger.info('decision.recorded', {
    decisionId: row.decision_id,
    decision: row.decision,
    documentStatus: row.document_status,
    suggestionId: input.suggestionId,
    actorId: user.id,
  });

  return {
    status: 200,
    body: {
      decisionId: row.decision_id,
      decision: row.decision,
      editedText: row.edited_text,
      comment: row.comment,
      createdAt: row.created_at,
      documentStatus: row.document_status,
    },
  };
}
