import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FilePlus2, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/server';
import { getWorkspaceContext } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Dashboard',
};

interface DocumentSummaryRow {
  id: string;
  title: string;
  status: 'draft' | 'in_review' | 'reviewed';
  version: number;
  updated_at: string;
}

function formatStatusLabel(status: DocumentSummaryRow['status']): string {
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

export default async function DashboardPage() {
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
          Workspace Dashboard
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Your account is authenticated, but you are not yet a member of a BrandGuardian workspace. Ask a workspace admin to grant membership so approved knowledge and documents become visible.
        </p>
      </section>
    );
  }

  const supabase = await createClient();
  const workspaceId = ctx.workspace.workspaceId;

  const [rulesCountRes, factsCountRes, termsCountRes, docsRes] =
    await Promise.all([
      supabase
        .from('guideline_rules')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId),
      supabase
        .from('approved_facts')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId),
      supabase
        .from('terminology')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId),
      supabase
        .from('documents')
        .select('id, title, status, version, updated_at')
        .eq('workspace_id', workspaceId)
        .order('updated_at', { ascending: false })
        .limit(12),
    ]);

  const queryError =
    rulesCountRes.error ||
    factsCountRes.error ||
    termsCountRes.error ||
    docsRes.error;

  const rulesCount = rulesCountRes.count ?? 0;
  const factsCount = factsCountRes.count ?? 0;
  const termsCount = termsCountRes.count ?? 0;
  const documents = (docsRes.data as DocumentSummaryRow[] | null) ?? [];

  const knowledgeLedger = [
    {
      label: 'Guideline rules',
      detail: 'Tone, messaging, and claim rules',
      count: rulesCount,
    },
    {
      label: 'Approved facts',
      detail: 'Canonical statements and source records',
      count: factsCount,
    },
    {
      label: 'Terminology',
      detail: 'Preferred and discouraged phrasing',
      count: termsCount,
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Active Workspace
            </span>
            <Badge variant="secondary" className="capitalize">
              Role: {ctx.workspace.role}
            </Badge>
          </div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground">
            {ctx.workspace.workspaceName}
          </h1>
          <p className="max-w-[65ch] text-sm leading-relaxed text-muted-foreground">
            Verified knowledge counts and recent draft submissions scoped strictly by your workspace membership.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/knowledge"
            className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
          >
            View knowledge
          </Link>
          <Link
            href="/documents/new"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors duration-150 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
          >
            <FilePlus2 className="size-4" aria-hidden="true" />
            <span>Review new content</span>
          </Link>
        </div>
      </header>

      {queryError ? (
        <p
          role="alert"
          className="rounded-lg border border-severity-critical-border bg-severity-critical-bg px-6 py-4 text-sm text-severity-critical-fg"
        >
          Unable to load workspace metrics cleanly. Refresh the page or verify your session.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[0.38fr_0.62fr] lg:items-start">
          <section aria-labelledby="knowledge-summary-heading" className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <h2
                id="knowledge-summary-heading"
                className="font-serif text-xl font-semibold tracking-tight text-foreground"
              >
                Knowledge Ledger
              </h2>
              <Link
                href="/knowledge"
                className="text-xs font-medium text-primary underline underline-offset-4 hover:opacity-80"
              >
                Inspect all
              </Link>
            </div>

            {rulesCount === 0 && factsCount === 0 && termsCount === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
                This workspace has no approved rules, facts, or terminology entries yet. Seed knowledge rows in Supabase to ground reviews.
              </div>
            ) : (
              <dl className="divide-y divide-border rounded-lg border border-border bg-card">
                {knowledgeLedger.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between gap-4 px-5 py-4"
                  >
                    <div>
                      <dt className="text-sm font-medium text-foreground">
                        {item.label}
                      </dt>
                      <dd className="text-xs text-muted-foreground">
                        {item.detail}
                      </dd>
                    </div>
                    <dd className="font-mono text-2xl font-semibold tabular-nums text-foreground">
                      {item.count}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </section>

          <section aria-labelledby="recent-docs-heading" className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <h2
                id="recent-docs-heading"
                className="font-serif text-xl font-semibold tracking-tight text-foreground"
              >
                Recent Documents
              </h2>
              <span className="font-mono text-xs text-muted-foreground">
                {documents.length} saved
              </span>
            </div>

            {documents.length === 0 ? (
              <div className="flex flex-col items-start gap-4 rounded-lg border border-dashed border-border bg-card p-6">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium text-foreground">
                    No documents submitted yet
                  </p>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Next step: open New Review to paste draft copy or load the synthetic Asterra sample and persist your first document.
                  </p>
                </div>
                <Link
                  href="/documents/new"
                  className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-background px-3.5 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
                >
                  Create first document
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                {documents.map((doc) => (
                  <li key={doc.id}>
                    <Link
                      href={`/documents/${doc.id}`}
                      className="flex flex-col gap-2 px-5 py-4 transition-colors duration-150 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:flex-row sm:items-center sm:justify-between motion-reduce:transition-none"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <FileText
                          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {doc.title}
                          </p>
                          <p className="font-mono text-xs text-muted-foreground">
                            v{doc.version} · Updated {formatDate(doc.updated_at)} UTC
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="w-fit shrink-0">
                        {formatStatusLabel(doc.status)}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
