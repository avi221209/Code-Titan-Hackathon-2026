import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';
import { isUuid } from '@/lib/validators/m1';
import { getWorkspaceContext } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

type DocumentStatus = 'draft' | 'in_review' | 'reviewed';

interface DocumentHistoryHeaderRow {
  id: string;
  title: string;
  status: DocumentStatus;
  version: number;
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
    .select('id, title, status, version')
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
          Unable to load document history. Please return to the dashboard and try again.
        </p>
      </section>
    );
  }

  if (!doc) {
    notFound();
  }

  const documentRow = doc as DocumentHistoryHeaderRow;

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
          <Badge variant="outline">{formatStatusLabel(documentRow.status)}</Badge>
          <Badge variant="secondary" className="font-mono text-xs">
            v{documentRow.version}
          </Badge>
        </div>

        <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground">
          Document Audit History
        </h1>

        <p className="text-sm text-muted-foreground">
          Audit record for <span className="font-medium text-foreground">{documentRow.title}</span>
        </p>
      </header>

      <Card>
        <CardContent className="flex items-start gap-3 p-6">
          <Info
            className="mt-0.5 size-4 shrink-0 text-primary"
            aria-hidden="true"
          />
          <p className="text-sm leading-relaxed text-muted-foreground">
            Displays the chronological audit timeline of review runs, human
            decisions, and actor events for this document (Coming in M3).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
