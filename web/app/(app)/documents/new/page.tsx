import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { NewDocumentForm } from '@/components/new-document-form';
import { Badge } from '@/components/ui/badge';
import { getWorkspaceContext } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'New Document',
};

export default async function NewDocumentPage() {
  const ctx = await getWorkspaceContext();
  if (!ctx.user) {
    redirect('/login');
  }

  if (ctx.queryError) {
    return (
      <section className="max-w-3xl">
        <p
          role="alert"
          className="rounded-lg border border-severity-critical-border bg-severity-critical-bg px-6 py-4 text-sm text-severity-critical-fg"
        >
          {ctx.queryError}
        </p>
      </section>
    );
  }

  if (!ctx.workspace) {
    return (
      <section className="max-w-3xl rounded-lg border border-dashed border-border bg-card p-8">
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-foreground">
          Submit Content for Review
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          You must belong to an active workspace before creating documents. Ask a workspace administrator to grant membership first.
        </p>
      </section>
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <header className="flex flex-col gap-2 border-b border-border pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            New Submission
          </span>
          <Badge variant="secondary">{ctx.workspace.workspaceName}</Badge>
        </div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground">
          Create Compliance Draft
        </h1>
        <p className="max-w-[65ch] text-sm leading-relaxed text-muted-foreground">
          Draft copy is saved directly to Postgres with Row-Level Security enforcing workspace ownership.
        </p>
      </header>

      <NewDocumentForm />
    </div>
  );
}
