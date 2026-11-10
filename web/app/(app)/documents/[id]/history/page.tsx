import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Clock, FileCheck2, Play } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { loadProfileNamesMap } from '@/lib/profiles';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/validators/m1';
import { getWorkspaceContext } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Document History',
};

type DocumentStatus = 'draft' | 'in_review' | 'reviewed';

interface DocumentHistoryHeaderRow {
  id: string;
  workspace_id: string;
  title: string;
  status: DocumentStatus;
  version: number;
}

interface AuditEventRow {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

function formatStatusLabel(status: DocumentStatus): string {
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

function formatActionTitle(action: string): string {
  switch (action) {
    case 'review.completed':
      return 'Compliance review completed';
    case 'decision.recorded':
      return 'Human decision recorded';
    case 'document.reviewed':
      return 'Document marked reviewed';
    default:
      return action;
  }
}

function renderActionIcon(action: string) {
  switch (action) {
    case 'review.completed':
      return <Play className="size-4 text-primary" aria-hidden="true" />;
    case 'decision.recorded':
      return <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />;
    case 'document.reviewed':
      return <FileCheck2 className="size-4 text-primary" aria-hidden="true" />;
    default:
      return (
        <Clock className="size-4 text-muted-foreground" aria-hidden="true" />
      );
  }
}

function buildDetailItems(
  metadata: Record<string, unknown> | null
): Array<{ label: string; value: string }> {
  if (!metadata) {
    return [];
  }

  const details: Array<{ label: string; value: string }> = [];

  if (typeof metadata.ai_status === 'string') {
    details.push({ label: 'AI status', value: metadata.ai_status });
  }
  if (typeof metadata.model_name === 'string') {
    details.push({ label: 'Model', value: metadata.model_name });
  }
  if (typeof metadata.total_findings === 'number') {
    details.push({ label: 'Findings', value: String(metadata.total_findings) });
  }
  if (typeof metadata.verified_count === 'number') {
    details.push({ label: 'Verified', value: String(metadata.verified_count) });
  }
  if (typeof metadata.dropped === 'number' && metadata.dropped > 0) {
    details.push({ label: 'Dropped', value: String(metadata.dropped) });
  }
  if (typeof metadata.elapsed_ms === 'number') {
    details.push({ label: 'Elapsed', value: `${metadata.elapsed_ms} ms` });
  }
  if (typeof metadata.decision === 'string') {
    details.push({ label: 'Decision', value: metadata.decision });
  }
  if (typeof metadata.comment === 'string' && metadata.comment.length > 0) {
    details.push({ label: 'Comment', value: metadata.comment });
  }
  if (typeof metadata.decided_count === 'number') {
    details.push({
      label: 'Decisions completed',
      value: String(metadata.decided_count),
    });
  }

  return details;
}

export default async function DocumentHistoryPage({
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
    .select('id, workspace_id, title, status, version')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return (
      <section className="mx-auto flex max-w-4xl flex-col gap-6">
        <Link
          href="/dashboard"
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          <span>Back to dashboard</span>
        </Link>
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground">
          Document Audit History
        </h1>
        <p
          role="alert"
          className="rounded-lg border border-severity-critical-border bg-severity-critical-bg px-6 py-4 text-sm text-severity-critical-fg"
        >
          Unable to load document history. Please return to the dashboard and
          try again.
        </p>
      </section>
    );
  }

  if (!doc) {
    notFound();
  }

  const documentRow = doc as DocumentHistoryHeaderRow;

  const { data: auditData, error: auditError } = await supabase
    .from('audit_events')
    .select(
      'id, actor_id, action, entity_type, entity_id, metadata, created_at'
    )
    .eq('workspace_id', documentRow.workspace_id)
    .or(
      `entity_id.eq.${documentRow.id},metadata->>document_id.eq.${documentRow.id}`
    )
    .order('created_at', { ascending: false })
    .limit(200);

  const events = (auditData as AuditEventRow[] | null) ?? [];
  const profileNames = await loadProfileNamesMap(
    events.map((event) => event.actor_id)
  );

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <Link
          href={`/documents/${documentRow.id}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          <span>Back to document</span>
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
        </div>

        <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground">
          Document Audit History
        </h1>

        <p className="text-sm text-muted-foreground">
          Chronological audit trail for{' '}
          <span className="font-medium text-foreground">
            {documentRow.title}
          </span>
        </p>
      </header>

      {auditError ? (
        <p
          role="alert"
          className="rounded-lg border border-severity-critical-border bg-severity-critical-bg px-6 py-4 text-sm text-severity-critical-fg"
        >
          Unable to load audit events for this document.
        </p>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm leading-relaxed text-muted-foreground">
              No audit events recorded for this document yet. Run a compliance
              review on the document page to log the first timeline event.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ol className="divide-y divide-border rounded-lg border border-border bg-card">
          {events.map((event) => {
            const actorLabel = event.actor_id
              ? (profileNames[event.actor_id] ??
                (event.actor_id === ctx.user?.id
                  ? ctx.user.email ?? 'Signed-in user'
                  : 'Workspace member'))
              : 'System';
            const details = buildDetailItems(event.metadata);

            return (
              <li
                key={event.id}
                className="flex flex-col gap-2.5 px-6 py-5 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {renderActionIcon(event.action)}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {formatActionTitle(event.action)}
                      </span>
                      <Badge variant="outline" className="font-mono text-xs">
                        {event.action}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Actor:{' '}
                      <span className="font-medium text-foreground">
                        {actorLabel}
                      </span>
                    </p>
                    {details.length > 0 ? (
                      <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {details.map((item) => (
                          <div key={item.label} className="flex gap-1">
                            <dt className="font-medium text-foreground">
                              {item.label}:
                            </dt>
                            <dd className="font-mono">{item.value}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                  </div>
                </div>

                <time
                  dateTime={event.created_at}
                  className="shrink-0 font-mono text-xs text-muted-foreground"
                >
                  {formatDate(event.created_at)} UTC
                </time>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
