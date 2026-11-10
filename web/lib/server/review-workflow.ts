import { isUuid } from '../validators/m1.ts';
import {
  classifyRunningReviews,
  validateReviewRequestBody,
  validateReviewResponse,
} from '../validators/review.ts';
import { defaultLogger, type StructuredLogger } from './logger.ts';
import { reviewRateLimiter, type RateLimiter } from './rate-limit.ts';
import type { WorkflowHttpResponse } from './decision-workflow.ts';

interface DocumentRow {
  id: string;
  workspace_id: string;
  content: string;
  status: 'draft' | 'in_review' | 'reviewed';
}

interface RunningReviewRow {
  id: string;
  started_at: string;
}

interface GuidelineRuleQueryRow {
  id: string;
  category: string;
  rule_text: string;
  severity: string;
  pattern: string | null;
  suggestion: string | null;
  guidelines?: unknown;
}

export interface ReviewServerEnvLike {
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  AI_SERVICE_URL: string;
  AI_SERVICE_TOKEN: string;
}

export interface SupabaseQueryResult<T = unknown> {
  data: T;
  error: { code?: string | null; message?: string | null } | null;
}

export interface ReviewSupabaseLike {
  auth: {
    getUser(): Promise<{
      data: { user: { id: string } | null };
      error: unknown;
    }>;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
}

export interface ReviewAdminLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
}

function describeFetchFailure(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return 'AI review service timed out before completing.';
    }
  }
  return 'AI review service is unreachable or failed unexpectedly.';
}

async function markRunFailed(
  admin: ReviewAdminLike,
  runId: string,
  errorMessage: string,
  logger: StructuredLogger
): Promise<void> {
  try {
    const { error: delError } = await admin
      .from('findings')
      .delete()
      .eq('review_run_id', runId);
    if (delError) {
      logger.warn('review.cleanup_findings_failed', {
        runId,
        code: delError.code ?? null,
      });
    }
    const { error: updError } = await admin
      .from('review_runs')
      .update({
        status: 'failed',
        error: errorMessage.slice(0, 500),
        completed_at: new Date().toISOString(),
      })
      .eq('id', runId);
    if (updError) {
      logger.warn('review.mark_failed_update_error', {
        runId,
        code: updError.code ?? null,
      });
    }
  } catch (err) {
    logger.error('review.mark_failed_exception', { runId, err });
  }
}

export async function executeReviewWorkflow(input: {
  isSupabaseConfigured: boolean;
  body: unknown;
  supabase: ReviewSupabaseLike;
  admin?: ReviewAdminLike;
  createAdminClient?: () => ReviewAdminLike;
  serverEnv?: ReviewServerEnvLike;
  getServerEnv?: () => ReviewServerEnvLike;
  fetchImpl?: typeof fetch;
  rateLimiter?: RateLimiter | null;
  logger?: StructuredLogger;
  todayUtc?: string;
}): Promise<WorkflowHttpResponse> {
  const logger = input.logger ?? defaultLogger;
  const limiter =
    input.rateLimiter === undefined ? reviewRateLimiter : input.rateLimiter;
  const fetchFn = input.fetchImpl ?? fetch;

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
    const rate = limiter.check(`review:${user.id}`);
    if (!rate.allowed) {
      logger.warn('review.rate_limited', {
        actorId: user.id,
        retryAfterSeconds: rate.retryAfterSeconds,
      });
      return {
        status: 429,
        headers: { 'Retry-After': String(rate.retryAfterSeconds) },
        body: {
          error: 'Too many review requests. Please wait a moment and try again.',
        },
      };
    }
  }

  const parsedBody = validateReviewRequestBody(input.body);
  if (!parsedBody.ok) {
    return { status: 400, body: { error: parsedBody.error } };
  }

  const { documentId } = parsedBody.data;

  const { data: docData, error: docError } = await input.supabase
    .from('documents')
    .select('id, workspace_id, content, status')
    .eq('id', documentId)
    .maybeSingle();

  if (docError) {
    logger.error('review.document_lookup_failed', {
      documentId,
      actorId: user.id,
      code: docError.code ?? null,
    });
    return {
      status: 500,
      body: { error: 'Unable to load document for review.' },
    };
  }

  if (!docData) {
    return { status: 404, body: { error: 'Document not found.' } };
  }

  const doc = docData as DocumentRow;

  let serverEnv: ReviewServerEnvLike;
  try {
    if (input.serverEnv) {
      serverEnv = input.serverEnv;
    } else if (input.getServerEnv) {
      serverEnv = input.getServerEnv();
    } else {
      throw new Error('Missing serverEnv provider');
    }
  } catch {
    logger.error('review.env_incomplete', {
      documentId: doc.id,
      actorId: user.id,
    });
    return {
      status: 503,
      body: {
        error:
          'Review engine environment variables are not configured on the server yet.',
      },
    };
  }

  const admin = input.admin ?? input.createAdminClient?.();
  if (!admin) {
    return {
      status: 503,
      body: {
        error:
          'Review engine environment variables are not configured on the server yet.',
      },
    };
  }

  const { data: existingRunning, error: runningError } = await admin
    .from('review_runs')
    .select('id, started_at')
    .eq('document_id', doc.id)
    .eq('status', 'running');

  if (runningError) {
    logger.error('review.running_check_failed', {
      documentId: doc.id,
      code: runningError.code ?? null,
    });
    return {
      status: 500,
      body: { error: 'Unable to verify active review runs.' },
    };
  }

  const classified = classifyRunningReviews(
    (existingRunning as RunningReviewRow[] | null) ?? []
  );

  if (classified.staleIds.length > 0) {
    const { error: staleErr } = await admin
      .from('review_runs')
      .update({
        status: 'failed',
        error: 'timed out',
        completed_at: new Date().toISOString(),
      })
      .in('id', classified.staleIds)
      .eq('status', 'running');

    if (staleErr) {
      logger.error('review.stale_cleanup_error', {
        documentId: doc.id,
        code: staleErr.code ?? null,
      });
      return {
        status: 500,
        body: { error: 'Unable to clear timed out review runs.' },
      };
    }
  }

  if (classified.activeIds.length > 0) {
    return {
      status: 409,
      body: { error: 'A review is already running for this document.' },
    };
  }

  const todayUtc = input.todayUtc ?? new Date().toISOString().slice(0, 10);

  const [termsRes, factsRes, rulesRes] = await Promise.all([
    input.supabase
      .from('terminology')
      .select('id, term, preferred_term, notes')
      .eq('workspace_id', doc.workspace_id),
    input.supabase
      .from('approved_facts')
      .select('id, fact_text, topic, value, match_pattern, source_name')
      .eq('workspace_id', doc.workspace_id)
      .eq('status', 'active')
      .or(`valid_from.is.null,valid_from.lte.${todayUtc}`)
      .or(`valid_until.is.null,valid_until.gte.${todayUtc}`),
    input.supabase
      .from('guideline_rules')
      .select(
        'id, category, rule_text, severity, pattern, suggestion, guidelines!inner(status)'
      )
      .eq('workspace_id', doc.workspace_id)
      .eq('approved', true)
      .eq('guidelines.status', 'approved'),
  ]);

  if (termsRes.error || factsRes.error || rulesRes.error) {
    logger.error('review.knowledge_load_failed', {
      documentId: doc.id,
      workspaceId: doc.workspace_id,
      termsCode: termsRes.error?.code ?? null,
      factsCode: factsRes.error?.code ?? null,
      rulesCode: rulesRes.error?.code ?? null,
    });
    return {
      status: 500,
      body: { error: 'Unable to load workspace knowledge for review.' },
    };
  }

  const normalizedRules = ((rulesRes.data as GuidelineRuleQueryRow[] | null) ?? []).map(
    (row) => ({
      id: row.id,
      category: row.category,
      rule_text: row.rule_text,
      severity: row.severity,
      pattern: row.pattern,
      suggestion: row.suggestion,
    })
  );

  const { data: insertedRun, error: insertRunError } = await admin
    .from('review_runs')
    .insert({
      workspace_id: doc.workspace_id,
      document_id: doc.id,
      model_name: null,
      status: 'running',
    })
    .select('id, started_at')
    .single();

  if (insertRunError) {
    if (insertRunError.code === '23505') {
      logger.info('review.concurrent_duplicate_blocked', {
        documentId: doc.id,
        actorId: user.id,
      });
      return {
        status: 409,
        body: { error: 'A review is already running for this document.' },
      };
    }
    logger.error('review.create_run_failed', {
      documentId: doc.id,
      code: insertRunError.code ?? null,
    });
    return {
      status: 500,
      body: { error: 'Failed to create review run record.' },
    };
  }

  if (!insertedRun) {
    logger.error('review.create_run_empty', { documentId: doc.id });
    return {
      status: 500,
      body: { error: 'Failed to create review run record.' },
    };
  }

  const runId = insertedRun.id as string;

  try {
    const { data: postInsertRunning, error: tieErr } = await admin
      .from('review_runs')
      .select('id, started_at')
      .eq('document_id', doc.id)
      .eq('status', 'running')
      .order('started_at', { ascending: true })
      .order('id', { ascending: true });

    if (tieErr) {
      logger.warn('review.tie_check_failed', { runId, code: tieErr.code ?? null });
    }

    const activeWinner = classifyRunningReviews(
      (postInsertRunning as RunningReviewRow[] | null) ?? []
    ).activeIds[0];

    if (activeWinner && activeWinner !== runId) {
      await markRunFailed(admin, runId, 'concurrent duplicate request', logger);
      return {
        status: 409,
        body: { error: 'A review is already running for this document.' },
      };
    }

    const aiEndpoint = new URL('/review', serverEnv.AI_SERVICE_URL).toString();
    let aiHttpResponse: Response;
    try {
      aiHttpResponse = await fetchFn(aiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': serverEnv.AI_SERVICE_TOKEN,
        },
        body: JSON.stringify({
          document_id: doc.id,
          workspace_id: doc.workspace_id,
          content: doc.content,
          knowledge: {
            terminology: termsRes.data ?? [],
            facts: factsRes.data ?? [],
            rules: normalizedRules,
          },
          use_llm: true,
        }),
        signal: AbortSignal.timeout(50_000),
      });
    } catch (fetchErr) {
      const msg = describeFetchFailure(fetchErr);
      logger.error('review.ai_fetch_failed', {
        runId,
        documentId: doc.id,
        err: fetchErr,
      });
      await markRunFailed(admin, runId, msg, logger);
      return { status: 502, body: { error: msg, runId } };
    }

    if (!aiHttpResponse.ok) {
      const msg =
        aiHttpResponse.status === 401
          ? 'AI service rejected server authentication token.'
          : `AI service returned HTTP ${aiHttpResponse.status}.`;
      logger.error('review.ai_http_error', {
        runId,
        documentId: doc.id,
        httpStatus: aiHttpResponse.status,
      });
      await markRunFailed(admin, runId, msg, logger);
      return { status: 502, body: { error: msg, runId } };
    }

    let rawAiJson: unknown;
    try {
      rawAiJson = await aiHttpResponse.json();
    } catch {
      const msg = 'AI service returned invalid JSON.';
      logger.error('review.ai_invalid_json', { runId, documentId: doc.id });
      await markRunFailed(admin, runId, msg, logger);
      return { status: 502, body: { error: msg, runId } };
    }

    const parsedAi = validateReviewResponse(rawAiJson, doc.id);
    if (!parsedAi.ok) {
      logger.error('review.ai_schema_mismatch', {
        runId,
        documentId: doc.id,
        reason: parsedAi.error,
      });
      await markRunFailed(admin, runId, parsedAi.error, logger);
      return {
        status: 502,
        body: {
          error: 'AI service returned an unexpected response structure.',
          runId,
        },
      };
    }

    const review = parsedAi.data;

    if (review.findings.length > 0) {
      const findingRows = review.findings.map((finding) => ({
        workspace_id: doc.workspace_id,
        review_run_id: runId,
        category: finding.category,
        severity: finding.severity,
        matched_text: finding.matched_text,
        start_offset: finding.start_offset,
        end_offset: finding.end_offset,
        explanation: finding.explanation,
        source_type: finding.source_type,
        source_id:
          finding.source_id && isUuid(finding.source_id)
            ? finding.source_id
            : null,
        confidence: finding.confidence,
        verification_status: finding.verification_status,
        origin: finding.origin,
      }));

      const { data: insertedFindings, error: findingsError } = await admin
        .from('findings')
        .insert(findingRows)
        .select('id');

      if (
        findingsError ||
        !insertedFindings ||
        insertedFindings.length !== review.findings.length
      ) {
        const msg = 'Failed to store compliance findings.';
        logger.error('review.store_findings_failed', {
          runId,
          documentId: doc.id,
          code: findingsError?.code ?? null,
        });
        await markRunFailed(admin, runId, msg, logger);
        return { status: 502, body: { error: msg, runId } };
      }

      const suggestionRows = insertedFindings.map(
        (row: { id: string }, index: number) => ({
          workspace_id: doc.workspace_id,
          finding_id: row.id,
          suggested_text: review.findings[index].suggested_text ?? null,
        })
      );

      const { error: suggestionsError } = await admin
        .from('suggestions')
        .insert(suggestionRows);

      if (suggestionsError) {
        const msg = 'Failed to store suggested revisions.';
        logger.error('review.store_suggestions_failed', {
          runId,
          documentId: doc.id,
          code: suggestionsError.code ?? null,
        });
        await markRunFailed(admin, runId, msg, logger);
        return { status: 502, body: { error: msg, runId } };
      }
    }

    const completedAt = new Date().toISOString();

    if (doc.status !== 'in_review') {
      const { error: docUpdateError } = await admin
        .from('documents')
        .update({
          status: 'in_review',
          updated_at: completedAt,
        })
        .eq('id', doc.id);

      if (docUpdateError) {
        const msg = 'Failed to transition document status to in_review.';
        logger.error('review.document_status_update_failed', {
          runId,
          documentId: doc.id,
          code: docUpdateError.code ?? null,
        });
        await markRunFailed(admin, runId, msg, logger);
        return { status: 502, body: { error: msg, runId } };
      }
    }

    const { error: updateRunError } = await admin
      .from('review_runs')
      .update({
        status: 'completed',
        ai_status: review.ai_status,
        model_name: review.model_name,
        error: null,
        completed_at: completedAt,
      })
      .eq('id', runId);

    if (updateRunError) {
      const msg = 'Failed to finalize review run status.';
      logger.error('review.finalize_run_failed', {
        runId,
        documentId: doc.id,
        code: updateRunError.code ?? null,
      });
      await markRunFailed(admin, runId, msg, logger);
      return { status: 502, body: { error: msg, runId } };
    }

    const verifiedCount = review.findings.filter(
      (f) => f.verification_status === 'verified'
    ).length;
    const unverifiedCount = review.findings.length - verifiedCount;
    const llmCount = review.findings.filter((f) => f.origin === 'llm').length;
    const deterministicCount = review.findings.length - llmCount;

    const { error: auditError } = await admin.from('audit_events').insert({
      workspace_id: doc.workspace_id,
      actor_id: user.id,
      action: 'review.completed',
      entity_type: 'document',
      entity_id: doc.id,
      metadata: {
        review_run_id: runId,
        ai_status: review.ai_status,
        ai_detail: review.ai_detail,
        total_findings: review.findings.length,
        verified_count: verifiedCount,
        unverified_count: unverifiedCount,
        deterministic_count: deterministicCount,
        llm_count: llmCount,
        dropped: review.dropped,
        elapsed_ms: review.elapsed_ms,
        model_name: review.model_name,
      },
    });

    if (auditError) {
      const msg = 'Review completed but failed to record audit event.';
      logger.error('review.audit_insert_failed', {
        runId,
        documentId: doc.id,
        code: auditError.code ?? null,
      });
      await markRunFailed(admin, runId, msg, logger);
      return { status: 502, body: { error: msg, runId } };
    }

    logger.info('review.completed', {
      runId,
      documentId: doc.id,
      aiStatus: review.ai_status,
      totalFindings: review.findings.length,
      verifiedCount,
      unverifiedCount,
      dropped: review.dropped,
      elapsedMs: review.elapsed_ms,
    });

    return {
      status: 200,
      body: {
        runId,
        status: 'completed',
        ai_status: review.ai_status,
        ai_detail: review.ai_detail,
        model_name: review.model_name,
        total_findings: review.findings.length,
        verified_count: verifiedCount,
        unverified_count: unverifiedCount,
        dropped: review.dropped,
        elapsed_ms: review.elapsed_ms,
      },
    };
  } catch (err) {
    const msg = describeFetchFailure(err);
    logger.error('review.unhandled_exception', {
      runId,
      documentId: doc.id,
      err,
    });
    await markRunFailed(admin, runId, msg, logger);
    return { status: 502, body: { error: msg, runId } };
  }
}

