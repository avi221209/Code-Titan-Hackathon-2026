'use client';

import { ArrowRight } from 'lucide-react';
import { SeverityBadge } from '@/components/severity-badge';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Severity } from '@/lib/types/finding';

export interface KnowledgeRuleItem {
  id: string;
  category: string;
  ruleText: string;
  severity: Severity;
  suggestion: string | null;
  sourceName: string;
  statusLabel: string;
  approved: boolean;
}

export interface KnowledgeFactItem {
  id: string;
  factText: string;
  topic: string | null;
  value: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  validFrom: string | null;
  validUntil: string | null;
  status: string;
}

export interface KnowledgeTermItem {
  id: string;
  term: string;
  preferredTerm: string;
  notes: string | null;
}

export interface KnowledgeTabsProps {
  rules: KnowledgeRuleItem[];
  facts: KnowledgeFactItem[];
  terminology: KnowledgeTermItem[];
}

function isSafeHttpUrl(rawUrl: string | null): boolean {
  if (!rawUrl) {
    return false;
  }
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function KnowledgeTabs({
  rules,
  facts,
  terminology,
}: KnowledgeTabsProps) {
  return (
    <Tabs defaultValue="rules" className="gap-6">
      <TabsList aria-label="Knowledge categories">
        <TabsTrigger value="rules">
          <span>Rules</span>
          <span className="font-mono text-xs text-muted-foreground">
            {rules.length}
          </span>
        </TabsTrigger>
        <TabsTrigger value="facts">
          <span>Facts</span>
          <span className="font-mono text-xs text-muted-foreground">
            {facts.length}
          </span>
        </TabsTrigger>
        <TabsTrigger value="terminology">
          <span>Terminology</span>
          <span className="font-mono text-xs text-muted-foreground">
            {terminology.length}
          </span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="rules">
        {rules.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card px-6 py-10 text-sm text-muted-foreground">
            No guideline rules are registered for this workspace yet. Add rules in Supabase or seed the Asterra dataset to inspect compliance criteria here.
          </div>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border bg-card">
            {rules.map((rule) => (
              <article
                key={rule.id}
                className="flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <SeverityBadge severity={rule.severity} />
                    <Badge variant="outline" className="font-mono text-xs">
                      {rule.category}
                    </Badge>
                    <Badge variant={rule.approved ? 'secondary' : 'outline'}>
                      {rule.statusLabel}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium leading-relaxed text-foreground">
                    {rule.ruleText}
                  </p>
                  {rule.suggestion ? (
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      <span className="font-medium text-foreground">
                        Guidance:
                      </span>{' '}
                      {rule.suggestion}
                    </p>
                  ) : null}
                </div>

                <div className="shrink-0 text-left sm:text-right">
                  <p className="text-xs font-medium text-foreground">
                    {rule.sourceName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Source guideline
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="facts">
        {facts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card px-6 py-10 text-sm text-muted-foreground">
            No approved facts are recorded for this workspace yet. Approved facts anchor claim verification without inventing external numbers.
          </div>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border bg-card">
            {facts.map((fact) => (
              <article
                key={fact.id}
                className="flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={fact.status === 'active' ? 'secondary' : 'outline'}
                      className="capitalize"
                    >
                      {fact.status}
                    </Badge>
                    {fact.topic ? (
                      <Badge variant="outline" className="font-mono text-xs">
                        {fact.topic}
                      </Badge>
                    ) : null}
                    {fact.value ? (
                      <code className="rounded-sm bg-muted px-2 py-0.5 font-mono text-xs text-foreground">
                        {fact.value}
                      </code>
                    ) : null}
                  </div>
                  <p className="text-sm font-medium leading-relaxed text-foreground">
                    {fact.factText}
                  </p>
                </div>

                <div className="shrink-0 text-left sm:text-right">
                  <p className="text-xs font-medium text-foreground">
                    {fact.sourceUrl && isSafeHttpUrl(fact.sourceUrl) ? (
                      <a
                        href={fact.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline decoration-border underline-offset-4 hover:text-primary"
                      >
                        {fact.sourceName ?? 'Source link'}
                      </a>
                    ) : (
                      (fact.sourceName ?? 'Workspace record')
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {fact.validFrom || fact.validUntil
                      ? `${fact.validFrom ?? 'Open'} – ${fact.validUntil ?? 'Ongoing'}`
                      : 'No expiry set'}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="terminology">
        {terminology.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card px-6 py-10 text-sm text-muted-foreground">
            No controlled terminology entries exist for this workspace yet.
          </div>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border bg-card">
            {terminology.map((entry) => (
              <article
                key={entry.id}
                className="flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="rounded-sm border border-severity-medium-border bg-severity-medium-bg px-2 py-0.5 font-mono text-xs text-severity-medium-fg">
                      {entry.term}
                    </code>
                    <ArrowRight
                      className="size-3.5 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <code className="rounded-sm border border-border bg-accent px-2 py-0.5 font-mono text-xs text-foreground">
                      {entry.preferredTerm}
                    </code>
                    <Badge variant="secondary">Active</Badge>
                  </div>
                  {entry.notes ? (
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {entry.notes}
                    </p>
                  ) : null}
                </div>

                <div className="shrink-0 text-left sm:text-right">
                  <p className="text-xs font-medium text-foreground">
                    Workspace glossary
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Deterministic match
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}

