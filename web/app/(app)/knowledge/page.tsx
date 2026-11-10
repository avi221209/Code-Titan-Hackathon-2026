import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  KnowledgeTabs,
  type KnowledgeFactItem,
  type KnowledgeRuleItem,
  type KnowledgeTermItem,
} from '@/components/knowledge-tabs';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/server';
import type { Severity } from '@/lib/types/finding';
import { getWorkspaceContext } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Knowledge Base',
};

interface RuleQueryRow {
  id: string;
  category: string;
  rule_text: string;
  severity: Severity;
  suggestion: string | null;
  approved: boolean;
  guidelines:
    | { title: string; status: string }
    | { title: string; status: string }[]
    | null;
}

interface FactQueryRow {
  id: string;
  fact_text: string;
  topic: string | null;
  value: string | null;
  source_name: string | null;
  source_url: string | null;
  valid_from: string | null;
  valid_until: string | null;
  status: string;
}

interface TermQueryRow {
  id: string;
  term: string;
  preferred_term: string;
  notes: string | null;
}

export default async function KnowledgePage() {
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
          Approved Brand Knowledge
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Your account is signed in, but it is not assigned to any workspace yet. Ask a workspace administrator to add your user ID in workspace memberships before viewing rules, facts, or terminology.
        </p>
      </section>
    );
  }

  const supabase = await createClient();
  const workspaceId = ctx.workspace.workspaceId;

  const [rulesResult, factsResult, termsResult] = await Promise.all([
    supabase
      .from('guideline_rules')
      .select(
        'id, category, rule_text, severity, suggestion, approved, guidelines(title, status)'
      )
      .eq('workspace_id', workspaceId)
      .order('category', { ascending: true })
      .order('rule_text', { ascending: true }),
    supabase
      .from('approved_facts')
      .select(
        'id, fact_text, topic, value, source_name, source_url, valid_from, valid_until, status'
      )
      .eq('workspace_id', workspaceId)
      .order('topic', { ascending: true }),
    supabase
      .from('terminology')
      .select('id, term, preferred_term, notes')
      .eq('workspace_id', workspaceId)
      .order('term', { ascending: true }),
  ]);

  const queryFailure =
    rulesResult.error || factsResult.error || termsResult.error;

  const rules: KnowledgeRuleItem[] = (
    (rulesResult.data as RuleQueryRow[] | null) ?? []
  ).map((row) => {
    const guideline = Array.isArray(row.guidelines)
      ? row.guidelines[0]
      : row.guidelines;
    const guidelineStatus = guideline?.status ?? 'approved';
    const effectivelyApproved =
      row.approved && guidelineStatus === 'approved';
    const statusLabel = !row.approved
      ? 'Draft'
      : guidelineStatus === 'archived'
        ? 'Guideline archived'
        : guidelineStatus !== 'approved'
          ? 'Guideline draft'
          : 'Approved';

    return {
      id: row.id,
      category: row.category,
      ruleText: row.rule_text,
      severity: row.severity,
      suggestion: row.suggestion,
      sourceName: guideline?.title ?? 'Workspace guidelines',
      statusLabel,
      approved: effectivelyApproved,
    };
  });

  const facts: KnowledgeFactItem[] = (
    (factsResult.data as FactQueryRow[] | null) ?? []
  ).map((row) => ({
    id: row.id,
    factText: row.fact_text,
    topic: row.topic,
    value: row.value,
    sourceName: row.source_name,
    sourceUrl: row.source_url,
    validFrom: row.valid_from,
    validUntil: row.valid_until,
    status: row.status,
  }));

  const terminology: KnowledgeTermItem[] = (
    (termsResult.data as TermQueryRow[] | null) ?? []
  ).map((row) => ({
    id: row.id,
    term: row.term,
    preferredTerm: row.preferred_term,
    notes: row.notes,
  }));

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Approved Knowledge
            </span>
            <Badge variant="secondary">{ctx.workspace.workspaceName}</Badge>
          </div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground">
            Brand Rules, Facts &amp; Terminology
          </h1>
          <p className="max-w-[65ch] text-sm leading-relaxed text-muted-foreground">
            Read-only compliance sources enforced through Row-Level Security for your current workspace.
          </p>
        </div>

        <Link
          href="/documents/new"
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors duration-150 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
        >
          Review new content
        </Link>
      </header>

      {queryFailure ? (
        <p
          role="alert"
          className="rounded-lg border border-severity-critical-border bg-severity-critical-bg px-6 py-4 text-sm text-severity-critical-fg"
        >
          Unable to load workspace knowledge records right now. Please refresh and try again.
        </p>
      ) : (
        <KnowledgeTabs rules={rules} facts={facts} terminology={terminology} />
      )}
    </div>
  );
}
