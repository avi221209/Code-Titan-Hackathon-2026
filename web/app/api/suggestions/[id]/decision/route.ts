import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { validateDecisionInput } from '@/lib/validators/decision';
import { isUuid } from '@/lib/validators/m1';

interface SuggestionLookupRow {
  id: string;
  workspace_id: string;
  suggested_text: string | null;
  findings:
    | {
        id: string;
        review_run_id: string;
        review_runs:
          | { id: string; document_id: string }
          | { id: string; document_id: string }[]
          | null;
      }
    | {
        id: string;
        review_run_id: string;
        review_runs:
          | { id: string; document_id: string }
          | { id: string; document_id: string }[]
          | null;
      }[]
    | null;
}

interface LatestRunFindingsRow {
  id: string;
  suggestions:
    | { id: string; status: string }
    | { id: string; status: string }[]
    | null;
}

function isSupabasePublicConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
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

  const { id: suggestionId } = await context.params;
  if (!isUuid(suggestionId)) {
    return NextResponse.json(
      { error: 'A valid suggestion ID UUID is required.' },
      { status: 400 }
    );
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

  const parsed = validateDecisionInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { data: suggestionData, error: lookupError } = await supabase
    .from('suggestions')
    .select(
      'id, workspace_id, suggested_text, findings!inner(id, review_run_id, review_runs!inner(id, document_id))'
    )
    .eq('id', suggestionId)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json(
      { error: 'Unable to verify suggestion access.' },
      { status: 500 }
    );
  }

  if (!suggestionData) {
    return NextResponse.json(
      { error: 'Suggestion not found.' },
      { status: 404 }
    );
  }

  const suggestion = suggestionData as SuggestionLookupRow;
  if (
    parsed.data.decision === 'accepted' &&
    suggestion.suggested_text === null
  ) {
    return NextResponse.json(
      {
        error:
          'Cannot accept a finding without a suggested revision. Use Reject or Dismiss instead.',
      },
      { status: 400 }
    );
  }

  const findingRelation = Array.isArray(suggestion.findings)
    ? suggestion.findings[0]
    : suggestion.findings;
  const runRelation = findingRelation?.review_runs
    ? Array.isArray(findingRelation.review_runs)
      ? findingRelation.review_runs[0]
      : findingRelation.review_runs
    : null;

  const reviewRunId = findingRelation?.review_run_id ?? null;
  const documentId = runRelation?.document_id ?? null;

  if (!reviewRunId || !documentId) {
    return NextResponse.json(
      { error: 'Unable to resolve parent document for this suggestion.' },
      { status: 500 }
    );
  }

  // Insert review decision with the USER client so Supabase RLS and unique checks enforce access.
  const { data: insertedDecision, error: decisionError } = await supabase
    .from('review_decisions')
    .insert({
      workspace_id: suggestion.workspace_id,
      suggestion_id: suggestion.id,
      reviewer_id: user.id,
      decision: parsed.data.decision,
      edited_text: parsed.data.editedText,
      comment: parsed.data.comment,
    })
    .select('id, decision, edited_text, comment, created_at')
    .single();

  if (decisionError) {
    if (decisionError.code === '23505') {
      return NextResponse.json(
        { error: 'This suggestion has already been decided.' },
        { status: 409 }
      );
    }
    if (decisionError.code === '42501') {
      return NextResponse.json(
        { error: 'Your role cannot record decisions.' },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: 'Unable to save review decision.' },
      { status: 500 }
    );
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      {
        error:
          'Decision was recorded, but server configuration is incomplete to update suggestion status and audit log.',
      },
      { status: 500 }
    );
  }

  const { error: statusUpdateError } = await admin
    .from('suggestions')
    .update({ status: parsed.data.decision })
    .eq('id', suggestion.id)
    .eq('workspace_id', suggestion.workspace_id);

  if (statusUpdateError) {
    return NextResponse.json(
      {
        error:
          'Decision recorded, but updating suggestion status failed.',
      },
      { status: 500 }
    );
  }

  const { error: auditInsertError } = await admin.from('audit_events').insert({
    workspace_id: suggestion.workspace_id,
    actor_id: user.id,
    action: 'decision.recorded',
    entity_type: 'suggestion',
    entity_id: suggestion.id,
    metadata: {
      decision: parsed.data.decision,
      document_id: documentId,
      review_run_id: reviewRunId,
      ...(parsed.data.comment ? { comment: parsed.data.comment } : {}),
    },
  });

  if (auditInsertError) {
    return NextResponse.json(
      {
        error:
          'Decision recorded, but writing the audit event failed.',
      },
      { status: 500 }
    );
  }

  let nextDocumentStatus: 'in_review' | 'reviewed' | null = null;
  const { data: latestRun, error: latestRunError } = await admin
    .from('review_runs')
    .select('id')
    .eq('document_id', documentId)
    .eq('workspace_id', suggestion.workspace_id)
    .eq('status', 'completed')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestRunError) {
    return NextResponse.json(
      {
        error:
          'Decision recorded, but verifying document completion status failed.',
      },
      { status: 500 }
    );
  }

  if (latestRun && latestRun.id === reviewRunId) {
    const { data: runFindings, error: runFindingsError } = await admin
      .from('findings')
      .select('id, suggestions(id, status)')
      .eq('review_run_id', latestRun.id)
      .eq('workspace_id', suggestion.workspace_id);

    if (runFindingsError || !Array.isArray(runFindings)) {
      return NextResponse.json(
        {
          error:
            'Decision recorded, but loading run suggestions for completion check failed.',
        },
        { status: 500 }
      );
    }

    const allSuggestions: Array<{ id: string; status: string }> = [];
    for (const f of runFindings as LatestRunFindingsRow[]) {
      if (!f.suggestions) {
        continue;
      }
      if (Array.isArray(f.suggestions)) {
        allSuggestions.push(...f.suggestions);
      } else {
        allSuggestions.push(f.suggestions);
      }
    }

    if (
      allSuggestions.length > 0 &&
      allSuggestions.every((s) => s.status !== 'pending')
    ) {
      const nowIso = new Date().toISOString();
      const { error: docUpdateError } = await admin
        .from('documents')
        .update({ status: 'reviewed', updated_at: nowIso })
        .eq('id', documentId)
        .eq('workspace_id', suggestion.workspace_id);

      if (docUpdateError) {
        return NextResponse.json(
          {
            error:
              'Decision recorded, but updating document status to reviewed failed.',
          },
          { status: 500 }
        );
      }

      const { error: docAuditError } = await admin
        .from('audit_events')
        .insert({
          workspace_id: suggestion.workspace_id,
          actor_id: user.id,
          action: 'document.reviewed',
          entity_type: 'document',
          entity_id: documentId,
          metadata: {
            review_run_id: latestRun.id,
            decided_count: allSuggestions.length,
          },
        });

      if (docAuditError) {
        return NextResponse.json(
          {
            error:
              'Document status updated, but recording the document.reviewed audit event failed.',
          },
          { status: 500 }
        );
      }

      nextDocumentStatus = 'reviewed';
    }
  }

  return NextResponse.json(
    {
      decisionId: insertedDecision.id,
      decision: insertedDecision.decision,
      editedText: insertedDecision.edited_text,
      comment: insertedDecision.comment,
      createdAt: insertedDecision.created_at,
      documentStatus: nextDocumentStatus,
    },
    { status: 200 }
  );
}
