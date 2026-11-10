import { NextResponse } from 'next/server';
import { getServerEnv } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/validators/m1';
import {
  classifyRunningReviews,
  validateReviewRequestBody,
  validateReviewResponse,
} from '@/lib/validators/review';

export const maxDuration = 60;

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

function isSupabasePublicConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
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
  admin: ReturnType<typeof createAdminClient>,
  runId: string,
  errorMessage: string
) {
  await admin.from('findings').delete().eq('review_run_id', runId);
  await admin
    .from('review_runs')
    .update({
      status: 'failed',
      error: errorMessage.slice(0, 500),
      completed_at: new Date().toISOString(),
    })
    .eq('id', runId);
}

export async function POST(request: Request) {
  if (!isSupabasePublicConfigured()) {
    return NextResponse.json(
      { error: 'Supabase environment variables are not configured.' },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON request body.' },
      { status: 400 }
    );
  }

  const parsedBody = validateReviewRequestBody(body);
  if (!parsedBody.ok) {
    return NextResponse.json({ error: parsedBody.error }, { status: 400 });
  }

  const { documentId } = parsedBody.data;

  const { data: docData, error: docError } = await supabase
    .from('documents')
    .select('id, workspace_id, content, status')
    .eq('id', documentId)
    .maybeSingle();

  if (docError) {
    return NextResponse.json(
      { error: 'Unable to load document for review.' },
      { status: 500 }
    );
  }

  if (!docData) {
    return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
  }

  const doc = docData as DocumentRow;

  let serverEnv: ReturnType<typeof getServerEnv>;
  try {
    serverEnv = getServerEnv();
  } catch {
    return NextResponse.json(
      {
        error:
          'Review engine environment variables are not configured on the server yet.',
      },
      { status: 503 }
    );
  }

  const admin = createAdminClient();

  const { data: existingRunning, error: runningError } = await admin
    .from('review_runs')
    .select('id, started_at')
    .eq('document_id', doc.id)
    .eq('status', 'running');

  if (runningError) {
    return NextResponse.json(
      { error: 'Unable to verify active review runs.' },
      { status: 500 }
    );
  }

  const classified = classifyRunningReviews(
    (existingRunning as RunningReviewRow[] | null) ?? []
  );

  if (classified.staleIds.length > 0) {
    await admin
      .from('review_runs')
      .update({
        status: 'failed',
        error: 'timed out',
        completed_at: new Date().toISOString(),
      })
      .in('id', classified.staleIds)
      .eq('status', 'running');
  }

  if (classified.activeIds.length > 0) {
    return NextResponse.json(
      { error: 'A review is already running for this document.' },
      { status: 409 }
    );
  }

  const [termsRes, factsRes, rulesRes] = await Promise.all([
    supabase
      .from('terminology')
      .select('id, term, preferred_term, notes')
      .eq('workspace_id', doc.workspace_id),
    supabase
      .from('approved_facts')
      .select('id, fact_text, topic, value, match_pattern, source_name')
      .eq('workspace_id', doc.workspace_id)
      .eq('status', 'active'),
    supabase
      .from('guideline_rules')
      .select('id, category, rule_text, severity, pattern, suggestion')
      .eq('workspace_id', doc.workspace_id)
      .eq('approved', true),
  ]);

  if (termsRes.error || factsRes.error || rulesRes.error) {
    return NextResponse.json(
      { error: 'Unable to load workspace knowledge for review.' },
      { status: 500 }
    );
  }

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

  if (insertRunError || !insertedRun) {
    return NextResponse.json(
      { error: 'Failed to create review run record.' },
      { status: 500 }
    );
  }

  const runId = insertedRun.id as string;

  try {
    const { data: postInsertRunning } = await admin
      .from('review_runs')
      .select('id, started_at')
      .eq('document_id', doc.id)
      .eq('status', 'running')
      .order('started_at', { ascending: true })
      .order('id', { ascending: true });

    const activeWinner = classifyRunningReviews(
      (postInsertRunning as RunningReviewRow[] | null) ?? []
    ).activeIds[0];

    if (activeWinner && activeWinner !== runId) {
      await markRunFailed(admin, runId, 'concurrent duplicate request');
      return NextResponse.json(
        { error: 'A review is already running for this document.' },
        { status: 409 }
      );
    }

    const aiEndpoint = new URL('/review', serverEnv.AI_SERVICE_URL).toString();
    let aiHttpResponse: Response;
    try {
      aiHttpResponse = await fetch(aiEndpoint, {
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
            rules: rulesRes.data ?? [],
          },
          use_llm: true,
        }),
        signal: AbortSignal.timeout(50_000),
      });
    } catch (fetchErr) {
      const msg = describeFetchFailure(fetchErr);
      await markRunFailed(admin, runId, msg);
      return NextResponse.json({ error: msg, runId }, { status: 502 });
    }

    if (!aiHttpResponse.ok) {
      const msg =
        aiHttpResponse.status === 401
          ? 'AI service rejected server authentication token.'
          : `AI service returned HTTP ${aiHttpResponse.status}.`;
      await markRunFailed(admin, runId, msg);
      return NextResponse.json({ error: msg, runId }, { status: 502 });
    }

    let rawAiJson: unknown;
    try {
      rawAiJson = await aiHttpResponse.json();
    } catch {
      const msg = 'AI service returned invalid JSON.';
      await markRunFailed(admin, runId, msg);
      return NextResponse.json({ error: msg, runId }, { status: 502 });
    }

    const parsedAi = validateReviewResponse(rawAiJson, doc.id);
    if (!parsedAi.ok) {
      await markRunFailed(admin, runId, parsedAi.error);
      return NextResponse.json(
        {
          error: 'AI service returned an unexpected response structure.',
          runId,
        },
        { status: 502 }
      );
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
        await markRunFailed(admin, runId, msg);
        return NextResponse.json({ error: msg, runId }, { status: 502 });
      }

      const suggestionRows = insertedFindings.map((row, index) => ({
        workspace_id: doc.workspace_id,
        finding_id: row.id as string,
        suggested_text: review.findings[index].suggested_text ?? null,
      }));

      const { error: suggestionsError } = await admin
        .from('suggestions')
        .insert(suggestionRows);

      if (suggestionsError) {
        const msg = 'Failed to store suggested revisions.';
        await markRunFailed(admin, runId, msg);
        return NextResponse.json({ error: msg, runId }, { status: 502 });
      }
    }

    const completedAt = new Date().toISOString();
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
      await markRunFailed(admin, runId, msg);
      return NextResponse.json({ error: msg, runId }, { status: 502 });
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
      await markRunFailed(admin, runId, msg);
      return NextResponse.json({ error: msg, runId }, { status: 502 });
    }

    if (doc.status !== 'in_review') {
      await admin
        .from('documents')
        .update({
          status: 'in_review',
          updated_at: completedAt,
        })
        .eq('id', doc.id);
    }

    return NextResponse.json(
      {
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
      { status: 200 }
    );
  } catch (err) {
    const msg = describeFetchFailure(err);
    await markRunFailed(admin, runId, msg);
    return NextResponse.json({ error: msg, runId }, { status: 502 });
  }
}
