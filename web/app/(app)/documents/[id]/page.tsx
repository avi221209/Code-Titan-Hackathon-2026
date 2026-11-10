import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, History } from 'lucide-react';
import {
  DocumentReviewWorkspace,
  type EvidenceLookup,
  type PersistedFindingItem,
  type WorkspaceRunSummary,
} from '@/components/document-review-workspace';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/server';
import type {
  AiStatus,
  Category,
  FindingOrigin,
  Severity,
  VerificationStatus,
} from '@/lib/types/finding';
import { isUuid } from '@/lib/validators/m1';
import { getWorkspaceContext } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Document Review',
};

interface DocumentDetailRow {
  id: string;
  workspace_id: string;
  title: string;
  content: string;
  status: 'draft' | 'in_review' | 'reviewed';
  version: number;
  created_at: string;
  updated_at: string;
}

interface ReviewRunRow {
  id: string;
  status: 'running' | 'completed' | 'failed';
  ai_status: AiStatus | null;
  model_name: string | null;
  error: string | null;
  started_at: string;
  completed_at: string | null;
}

interface FindingQueryRow {
  id: string;
  category: Category;
  severity: Severity;
  matched_text: string;
  start_offset: number;
  end_offset: number;
  explanation: string;
  source_type: string | null;
  source_id: string | null;
  confidence: number | string | null;
  verification_status: VerificationStatus;
  origin: FindingOrigin;
  suggestions:
    | { id: string; suggested_text: string | null; status: string }
    | { id: string; suggested_text: string | null; status: string }[]
    | null;
}

interface RuleEvidenceRow {
  id: string;
  category: string;
  rule_text: string;
  severity: Severity;
  suggestion: string | null;
  guidelines: { title: string } | { title: string }[] | null;
}

interface FactEvidenceRow {
  id: string;
  fact_text: string;
  topic: string | null;
  value: string | null;
  source_name: string | null;
}

interface TermEvidenceRow {
  id: string;
  term: string;
  preferred_term: string;
  notes: string | null;
}

interface AuditReviewRow {
  metadata: Record<string, unknown> | null;
}

function formatStatusLabel(status: DocumentDetailRow['status']): string {
  switch (status) {
    case 'in_review':
      return 'In review';
    case 'reviewed':
      return 'Reviewed';
    default:
      return 'Draft';
  }
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(iso));
}

function toRunSummary(
  row: ReviewRunRow,
  aiDetail: string | null
): WorkspaceRunSummary {
  return {
    id: row.id,
    status: row.status,
    aiStatus: row.ai_status,
    aiDetail,
    modelName: row.model_name,
    error: row.error,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) {
    notFound();
  }

  const ctx = await getWorkspaceContext();
  if (!ctx.user) {
    redirect('/login');
  }

  const supabase = await createClient();
  const { data: doc, error } = await supabase
    .from('documents')
    .select(
      'id, workspace_id, title, content, status, version, created_at, updated_at'
    )
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return (
      <section className="max-w-3xl">
        <p
          role="alert"
          className="rounded-lg border border-severity-critical-border bg-severity-critical-bg px-6 py-4 text-sm text-severity-critical-fg"
        >
          Unable to load this document. Please return to the dashboard and try
          again.
        </p>
      </section>
    );
  }

  if (!doc) {
    notFound();
  }

  const documentRow = doc as DocumentDetailRow;

  const [runsRes, rulesRes, factsRes, termsRes, auditRes] = await Promise.all([
    supabase
      .from('review_runs')
      .select(
        'id, status, ai_status, model_name, error, started_at, completed_at'
      )
      .eq('document_id', documentRow.id)
      .order('started_at', { ascending: false })
      .limit(10),
    supabase
      .from('guideline_rules')
      .select('id, category, rule_text, severity, suggestion, guidelines(title)')
      .eq('workspace_id', documentRow.workspace_id),
    supabase
      .from('approved_facts')
      .select('id, fact_text, topic, value, source_name')
      .eq('workspace_id', documentRow.workspace_id),
    supabase
      .from('terminology')
      .select('id, term, preferred_term, notes')
      .eq('workspace_id', documentRow.workspace_id),
    supabase
      .from('audit_events')
      .select('metadata')
      .eq('entity_id', documentRow.id)
      .eq('action', 'review.completed')
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const runRows = (runsRes.data as ReviewRunRow[] | null) ?? [];
  const latestAttemptRow = runRows[0] ?? null;
  const completedRunRow = runRows.find((r) => r.status === 'completed') ?? null;

  let completedAiDetail: string | null = null;
  if (completedRunRow && Array.isArray(auditRes.data)) {
    for (const entry of auditRes.data as AuditReviewRow[]) {
      const meta = entry.metadata;
      if (meta && meta.review_run_id === completedRunRow.id) {
        if (typeof meta.ai_detail === 'string' && meta.ai_detail.length > 0) {
          completedAiDetail = meta.ai_detail;
        }
        break;
      }
    }
  }

  let findings: PersistedFindingItem[] = [];
  if (completedRunRow) {
    const { data: findingsData } = await supabase
      .from('findings')
      .select(
        'id, category, severity, matched_text, start_offset, end_offset, explanation, source_type, source_id, confidence, verification_status, origin, suggestions(id, suggested_text, status)'
      )
      .eq('review_run_id', completedRunRow.id);

    findings = ((findingsData as FindingQueryRow[] | null) ?? []).map((row) => {
      const suggestion = Array.isArray(row.suggestions)
        ? row.suggestions[0] ?? null
        : row.suggestions;
      const numericConfidence =
        typeof row.confidence === 'number'
          ? row.confidence
          : typeof row.confidence === 'string'
            ? Number.parseFloat(row.confidence)
            : 0.5;

      return {
        id: row.id,
        category: row.category,
        severity: row.severity,
        matched_text: row.matched_text,
        start_offset: row.start_offset,
        end_offset: row.end_offset,
        explanation: row.explanation,
        source_type: row.source_type,
        source_id: row.source_id,
        confidence: Number.isFinite(numericConfidence) ? numericConfidence : 0.5,
        verification_status: row.verification_status,
        origin: row.origin,
        suggested_text: suggestion?.suggested_text ?? null,
        suggestion_id: suggestion?.id ?? null,
        suggestion_status: suggestion?.status ?? null,
      };
    });
  }

  const evidence: EvidenceLookup = {
    rules: {},
    facts: {},
    terminology: {},
  };

  for (const r of (rulesRes.data as RuleEvidenceRow[] | null) ?? []) {
    const guideline = Array.isArray(r.guidelines)
      ? r.guidelines[0]
      : r.guidelines;
    evidence.rules[r.id] = {
      ruleText: r.rule_text,
      category: r.category,
      severity: r.severity,
      guidelineTitle: guideline?.title ?? 'Workspace guidelines',
      suggestion: r.suggestion,
    };
  }

  for (const f of (factsRes.data as FactEvidenceRow[] | null) ?? []) {
    evidence.facts[f.id] = {
      factText: f.fact_text,
      topic: f.topic,
      value: f.value,
      sourceName: f.source_name,
    };
  }

  for (const t of (termsRes.data as TermEvidenceRow[] | null) ?? []) {
    evidence.terminology[t.id] = {
      term: t.term,
      preferredTerm: t.preferred_term,
      notes: t.notes,
    };
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          <span>Back to dashboard</span>
        </Link>

        <Link
          href={`/documents/${documentRow.id}/history`}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
        >
          <History className="size-3.5 text-primary" aria-hidden="true" />
          <span>Audit history</span>
        </Link>
      </div>

      <header className="flex flex-col gap-3 border-b border-border pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            {formatStatusLabel(documentRow.status)}
          </Badge>
          <Badge variant="secondary" className="font-mono text-xs">
            v{documentRow.version}
          </Badge>
          <span className="font-mono text-xs text-muted-foreground">
            {documentRow.content.length.toLocaleString('en-US')} chars
          </span>
        </div>

        <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground">
          {documentRow.title}
        </h1>

        <p className="font-mono text-xs text-muted-foreground">
          Saved {formatDate(documentRow.created_at)} UTC · Document ID{' '}
          {documentRow.id}
        </p>
      </header>

      <DocumentReviewWorkspace
        documentId={documentRow.id}
        content={documentRow.content}
        completedRun={
          completedRunRow
            ? toRunSummary(completedRunRow, completedAiDetail)
            : null
        }
        latestAttempt={
          latestAttemptRow
            ? toRunSummary(
                latestAttemptRow,
                latestAttemptRow.id === completedRunRow?.id
                  ? completedAiDetail
                  : null
              )
            : null
        }
        findings={findings}
        evidence={evidence}
      />
    </div>
  );
}
