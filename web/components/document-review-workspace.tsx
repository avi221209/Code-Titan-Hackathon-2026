'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  BookOpenCheck,
  Loader2,
  Play,
  ShieldAlert,
} from 'lucide-react';
import { AiStatusBanner } from '@/components/ai-status-banner';
import { SeverityBadge } from '@/components/severity-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { VerificationBadge } from '@/components/verification-badge';
import type {
  AiStatus,
  Category,
  FindingOrigin,
  Severity,
  VerificationStatus,
} from '@/lib/types/finding';
import { cn } from '@/lib/utils';
import {
  buildHighlightedDocumentSegments,
  isStaleRunningReview,
  resolveHighlightSpan,
  sortFindingsBySeverityAndOffset,
} from '@/lib/validators/review';

export interface WorkspaceRunSummary {
  id: string;
  status: 'running' | 'completed' | 'failed';
  aiStatus: AiStatus | null;
  aiDetail: string | null;
  modelName: string | null;
  error: string | null;
  startedAt: string;
  completedAt: string | null;
}

export interface PersistedFindingItem {
  id: string;
  category: Category;
  severity: Severity;
  matched_text: string;
  start_offset: number;
  end_offset: number;
  explanation: string;
  source_type: string | null;
  source_id: string | null;
  confidence: number;
  verification_status: VerificationStatus;
  origin: FindingOrigin;
  suggested_text: string | null;
  suggestion_id: string | null;
  suggestion_status: string | null;
}

export interface EvidenceLookup {
  rules: Record<
    string,
    {
      ruleText: string;
      category: string;
      severity: Severity;
      guidelineTitle: string;
      suggestion: string | null;
    }
  >;
  facts: Record<
    string,
    {
      factText: string;
      topic: string | null;
      value: string | null;
      sourceName: string | null;
    }
  >;
  terminology: Record<
    string,
    {
      term: string;
      preferredTerm: string;
      notes: string | null;
    }
  >;
}

export interface DocumentReviewWorkspaceProps {
  documentId: string;
  content: string;
  completedRun: WorkspaceRunSummary | null;
  latestAttempt: WorkspaceRunSummary | null;
  findings: PersistedFindingItem[];
  evidence: EvidenceLookup;
}

const HIGHLIGHT_STYLES: Record<Severity, { base: string; selected: string }> = {
  critical: {
    base: 'border-b-2 border-severity-critical-border bg-severity-critical-bg text-severity-critical-fg',
    selected: 'ring-2 ring-severity-critical-fg ring-offset-1',
  },
  high: {
    base: 'border-b-2 border-severity-high-border bg-severity-high-bg text-severity-high-fg',
    selected: 'ring-2 ring-severity-high-fg ring-offset-1',
  },
  medium: {
    base: 'border-b-2 border-severity-medium-border bg-severity-medium-bg text-severity-medium-fg',
    selected: 'ring-2 ring-severity-medium-fg ring-offset-1',
  },
  low: {
    base: 'border-b-2 border-severity-low-border bg-severity-low-bg text-severity-low-fg',
    selected: 'ring-2 ring-severity-low-fg ring-offset-1',
  },
};

function formatCategoryLabel(category: Category): string {
  return category.replace(/_/g, ' ');
}

function formatUtcTimestamp(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(iso));
}

function renderEvidencePanel(
  finding: PersistedFindingItem,
  evidence: EvidenceLookup
): React.ReactNode {
  if (finding.source_type === 'guideline_rule' && finding.source_id) {
    const rule = evidence.rules[finding.source_id];
    if (rule) {
      return (
        <div className="flex flex-col gap-1 text-xs">
          <p className="font-medium text-foreground">{rule.ruleText}</p>
          <p className="text-muted-foreground">
            Source: {rule.guidelineTitle} · Category:{' '}
            <span className="font-mono">{rule.category}</span>
          </p>
        </div>
      );
    }
  }

  if (finding.source_type === 'fact' && finding.source_id) {
    const fact = evidence.facts[finding.source_id];
    if (fact) {
      return (
        <div className="flex flex-col gap-1 text-xs">
          <p className="font-medium text-foreground">{fact.factText}</p>
          <p className="text-muted-foreground">
            {fact.value ? (
              <>
                Canonical value:{' '}
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">
                  {fact.value}
                </code>
                {' · '}
              </>
            ) : null}
            Source: {fact.sourceName ?? 'Approved workspace record'}
          </p>
        </div>
      );
    }
  }

  if (finding.source_type === 'terminology' && finding.source_id) {
    const entry = evidence.terminology[finding.source_id];
    if (entry) {
      return (
        <div className="flex flex-col gap-1 text-xs">
          <p className="font-medium text-foreground">
            Approved terminology:{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono">
              {entry.preferredTerm}
            </code>{' '}
            instead of{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono">
              {entry.term}
            </code>
          </p>
          {entry.notes ? (
            <p className="text-muted-foreground">{entry.notes}</p>
          ) : null}
        </div>
      );
    }
  }

  return (
    <p className="text-xs text-muted-foreground">
      No matching approved workspace source is linked to this finding. Treat as
      unverified and check manually against approved materials.
    </p>
  );
}

export function DocumentReviewWorkspace({
  documentId,
  content,
  completedRun,
  latestAttempt,
  findings,
  evidence,
}: DocumentReviewWorkspaceProps) {
  const router = useRouter();
  const sortedFindings = React.useMemo(
    () => sortFindingsBySeverityAndOffset(findings),
    [findings]
  );
  const segments = React.useMemo(
    () => buildHighlightedDocumentSegments(content, sortedFindings),
    [content, sortedFindings]
  );

  const serverRunning =
    latestAttempt?.status === 'running' &&
    !isStaleRunningReview(latestAttempt.startedAt);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const inFlightRef = React.useRef(false);
  const [requestError, setRequestError] = React.useState<string | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = React.useState('');
  const [selectedFindingId, setSelectedFindingId] = React.useState<
    string | null
  >(() => sortedFindings[0]?.id ?? null);

  const findingRefs = React.useRef<Record<string, HTMLElement | null>>({});

  React.useEffect(() => {
    if (sortedFindings.length === 0) {
      setSelectedFindingId(null);
      return;
    }
    setSelectedFindingId((current) => {
      if (current && sortedFindings.some((f) => f.id === current)) {
        return current;
      }
      return sortedFindings[0].id;
    });
  }, [sortedFindings]);

  const selectFindingByIndex = React.useCallback(
    (nextIndex: number) => {
      if (sortedFindings.length === 0) {
        return;
      }
      const clamped = Math.max(
        0,
        Math.min(nextIndex, sortedFindings.length - 1)
      );
      const target = sortedFindings[clamped];
      if (!target) {
        return;
      }
      setSelectedFindingId(target.id);
      const node = findingRefs.current[target.id];
      if (node) {
        node.focus();
        node.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    },
    [sortedFindings]
  );

  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          target.isContentEditable
        ) {
          return;
        }
      }

      if (sortedFindings.length === 0) {
        return;
      }

      if (event.key === 'j' || event.key === 'k') {
        event.preventDefault();
        const currentIdx = sortedFindings.findIndex(
          (item) => item.id === selectedFindingId
        );
        const baseIdx = currentIdx < 0 ? 0 : currentIdx;
        const delta = event.key === 'j' ? 1 : -1;
        selectFindingByIndex(baseIdx + delta);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedFindingId, selectFindingByIndex, sortedFindings]);

  async function handleRunReview() {
    if (inFlightRef.current || isSubmitting || serverRunning) {
      return;
    }

    inFlightRef.current = true;
    setIsSubmitting(true);
    setRequestError(null);
    setLiveAnnouncement('Compliance review started.');

    try {
      const response = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        ai_status?: AiStatus;
        total_findings?: number;
      };

      if (!response.ok) {
        const errText =
          payload.error ??
          'Compliance review failed before completion. Please try again.';
        setRequestError(errText);
        setLiveAnnouncement(`Compliance review failed: ${errText}`);
        router.refresh();
        return;
      }

      const count = payload.total_findings ?? 0;
      const statusLabel = payload.ai_status ?? 'ok';
      setLiveAnnouncement(
        `Compliance review complete: ${count} finding${count === 1 ? '' : 's'} recorded. AI status: ${statusLabel}.`
      );
      router.refresh();
    } catch {
      const msg = 'Network error while running compliance review.';
      setRequestError(msg);
      setLiveAnnouncement(msg);
    } finally {
      inFlightRef.current = false;
      setIsSubmitting(false);
    }
  }

  const isBusy = isSubmitting || serverRunning;
  const latestRunFailed =
    latestAttempt?.status === 'failed' &&
    (!completedRun ||
      Date.parse(latestAttempt.startedAt) >= Date.parse(completedRun.startedAt));

  return (
    <div className="flex flex-col gap-6">
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {liveAnnouncement}
      </div>

      <section
        aria-label="Review controls"
        className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="font-serif text-xl font-semibold tracking-tight text-foreground">
              Compliance Review
            </h2>
            <p className="text-xs text-muted-foreground">
              Runs deterministic workspace rules, fact checks, and terminology
              matching alongside grounded AI inspection.
            </p>
          </div>

          <Button
            type="button"
            onClick={handleRunReview}
            disabled={isBusy}
            aria-busy={isBusy}
            className="w-full sm:w-auto"
          >
            {isBusy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Play className="size-4" aria-hidden="true" />
            )}
            <span>{isBusy ? 'Running review…' : 'Run review'}</span>
          </Button>
        </div>

        {requestError ? (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-md border border-severity-critical-border bg-severity-critical-bg px-4 py-3 text-sm text-severity-critical-fg"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{requestError}</span>
          </div>
        ) : null}

        {latestRunFailed && !requestError ? (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-md border border-severity-critical-border bg-severity-critical-bg px-4 py-3 text-sm text-severity-critical-fg"
          >
            <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div className="flex flex-col gap-0.5">
              <p className="font-medium">
                Latest review attempt failed (
                {formatUtcTimestamp(latestAttempt.startedAt)} UTC)
              </p>
              <p className="text-xs">
                {latestAttempt.error ?? 'Unknown error recorded during review.'}
              </p>
            </div>
          </div>
        ) : null}

        {serverRunning ? (
          <p
            role="status"
            className="rounded-md border border-border bg-muted px-4 py-3 text-xs text-foreground"
          >
            A review run started at{' '}
            {formatUtcTimestamp(latestAttempt.startedAt)} UTC is still in
            progress. Refresh shortly for results.
          </p>
        ) : null}

        {completedRun && completedRun.aiStatus ? (
          <AiStatusBanner
            aiStatus={completedRun.aiStatus}
            aiDetail={completedRun.aiDetail}
            modelName={completedRun.modelName ?? undefined}
          />
        ) : !latestRunFailed && !serverRunning ? (
          <p
            role="status"
            className="rounded-md border border-dashed border-border bg-background px-4 py-3 text-xs text-muted-foreground"
          >
            No completed review yet. Click <strong>Run review</strong> to scan
            this document against your workspace knowledge.
          </p>
        ) : null}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
        <article
          aria-labelledby="document-copy-heading"
          className="rounded-lg border border-border bg-card p-6 shadow-sm"
        >
          <div className="mb-4 flex items-center justify-between gap-2 border-b border-border pb-3">
            <h2
              id="document-copy-heading"
              className="font-serif text-lg font-semibold tracking-tight text-foreground"
            >
              Document Copy
            </h2>
            <span className="font-mono text-xs text-muted-foreground">
              {content.length.toLocaleString('en-US')} chars
            </span>
          </div>

          <p className="max-w-[65ch] whitespace-pre-wrap text-base leading-relaxed text-foreground">
            {segments.map((segment, index) => {
              if (segment.type === 'text') {
                return (
                  <React.Fragment key={`t-${index}`}>
                    {segment.text}
                  </React.Fragment>
                );
              }

              const isSelected = selectedFindingId === segment.findingId;
              const style = HIGHLIGHT_STYLES[segment.severity];

              return (
                <button
                  key={`h-${segment.findingId}-${index}`}
                  type="button"
                  onClick={() => selectFindingByIndex(segment.findingIndex)}
                  aria-pressed={isSelected}
                  aria-label={`Select finding ${segment.findingIndex + 1}: ${segment.text}`}
                  className={cn(
                    'inline rounded-sm px-0.5 text-left transition-shadow duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none',
                    style.base,
                    isSelected ? style.selected : null
                  )}
                >
                  {segment.text}
                </button>
              );
            })}
          </p>
        </article>

        <section
          aria-labelledby="findings-heading"
          className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6 shadow-sm"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-3">
            <div>
              <h2
                id="findings-heading"
                className="font-serif text-lg font-semibold tracking-tight text-foreground"
              >
                Findings
              </h2>
              <p className="text-xs text-muted-foreground">
                Sorted by severity then offset · Keys{' '}
                <kbd className="rounded border border-border bg-muted px-1 font-mono text-[11px]">
                  j
                </kbd>{' '}
                /{' '}
                <kbd className="rounded border border-border bg-muted px-1 font-mono text-[11px]">
                  k
                </kbd>{' '}
                navigate
              </p>
            </div>
            <span className="font-mono text-xs text-muted-foreground">
              {sortedFindings.length}{' '}
              {sortedFindings.length === 1 ? 'finding' : 'findings'}
            </span>
          </div>

          {!completedRun ? (
            <p className="rounded-md border border-dashed border-border bg-background px-4 py-6 text-sm text-muted-foreground">
              Findings, verification status, confidence estimates, and linked
              evidence will appear here after the first review completes.
            </p>
          ) : sortedFindings.length === 0 ? (
            <p className="rounded-md border border-dashed border-border bg-background px-4 py-6 text-sm text-muted-foreground">
              No compliance issues were flagged in this review run.
            </p>
          ) : (
            <ol className="flex flex-col gap-4">
              {sortedFindings.map((finding, index) => {
                const isSelected = selectedFindingId === finding.id;
                const hasHighlight =
                  resolveHighlightSpan(content, finding) !== null;
                const confidencePct = Math.round(finding.confidence * 100);

                return (
                  <li key={finding.id}>
                    <article
                      ref={(el) => {
                        findingRefs.current[finding.id] = el;
                      }}
                      tabIndex={0}
                      onClick={() => setSelectedFindingId(finding.id)}
                      onFocus={() => setSelectedFindingId(finding.id)}
                      aria-current={isSelected ? 'true' : undefined}
                      className={cn(
                        'flex flex-col gap-3 rounded-lg border p-4 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none',
                        isSelected
                          ? 'border-primary bg-accent/25'
                          : 'border-border bg-background hover:bg-muted/40'
                      )}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">
                            #{index + 1}
                          </span>
                          <SeverityBadge severity={finding.severity} />
                          <Badge
                            variant="outline"
                            className="font-mono text-xs"
                          >
                            {formatCategoryLabel(finding.category)}
                          </Badge>
                        </div>

                        <VerificationBadge
                          verificationStatus={finding.verification_status}
                          origin={finding.origin}
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <code className="w-fit max-w-full break-words rounded-sm border border-border bg-muted px-2 py-1 font-mono text-xs text-foreground">
                          {finding.matched_text}
                        </code>
                        {!hasHighlight ? (
                          <span className="text-[11px] text-muted-foreground">
                            Inline text span not highlighted (exact offset match
                            unavailable).
                          </span>
                        ) : null}
                      </div>

                      <p className="text-sm leading-relaxed text-foreground">
                        {finding.explanation}
                      </p>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="font-mono tabular-nums">
                          Confidence: {confidencePct}% (estimate)
                        </span>
                      </div>

                      <div className="rounded-md border border-border bg-card px-3 py-2.5">
                        <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                          Suggested revision (read-only)
                        </p>
                        {finding.suggested_text ? (
                          <p className="font-mono text-xs text-foreground">
                            {finding.suggested_text}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            No automatic rewrite on file — human verification or
                            removal needed.
                          </p>
                        )}
                      </div>

                      <div className="rounded-md border border-border bg-card px-3 py-2.5">
                        <p className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                          <BookOpenCheck
                            className="size-3.5 text-primary"
                            aria-hidden="true"
                          />
                          <span>Evidence</span>
                        </p>
                        {renderEvidencePanel(finding, evidence)}
                      </div>
                    </article>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
