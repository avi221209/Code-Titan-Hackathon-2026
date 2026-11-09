import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/validators/m1';
import { getWorkspaceContext } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Document Draft',
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
          Unable to load this document. Please return to the dashboard and try again.
        </p>
      </section>
    );
  }

  if (!doc) {
    notFound();
  }

  const documentRow = doc as DocumentDetailRow;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          <span>Back to dashboard</span>
        </Link>
      </div>

      <header className="flex flex-col gap-3 border-b border-border pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{formatStatusLabel(documentRow.status)}</Badge>
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

      <div
        role="status"
        className="flex items-start gap-3 rounded-lg border border-border bg-accent/50 px-4 py-3 text-sm text-foreground"
      >
        <Info
          className="mt-0.5 size-4 shrink-0 text-primary"
          aria-hidden="true"
        />
        <div>
          <p className="font-medium">Review engine arrives in M2</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            This saved draft is currently read-only. Deterministic terminology, fact, and guideline checks plus AI review findings will run here once M2 lands.
          </p>
        </div>
      </div>

      <article
        aria-label="Saved document content"
        className="rounded-lg border border-border bg-card p-6 shadow-sm sm:p-8"
      >
        <p className="max-w-[65ch] whitespace-pre-wrap text-base leading-relaxed text-foreground">
          {documentRow.content}
        </p>
      </article>
    </div>
  );
}
