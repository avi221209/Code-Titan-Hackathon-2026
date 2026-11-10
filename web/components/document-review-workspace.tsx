'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  BookOpenCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  Loader2,
  Pencil,
  Play,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { AiStatusBanner } from '@/components/ai-status-banner';
import { SeverityBadge } from '@/components/severity-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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
  MAX_DECISION_TEXT_LENGTH,
  applyAcceptedEditsToDocument,
  canAcceptOrEditFinding,
  canRoleRecordDecision,
  validateDecisionInput,
  type DecisionType,
} from '@/lib/validators/decision';
import {
  buildHighlightedDocumentSegments,
  isStaleRunningReview,
  sortFindingsBySeverityAndOffset,
} from '@/lib/validators/review';
import type { WorkspaceRole } from '@/lib/workspace';

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

export interface PersistedDecisionInfo {
  id: string;
  decision: DecisionType;
  editedText: string | null;
  comment: string | null;
  reviewerName: string;
  createdAt: string;
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
  decision: PersistedDecisionInfo | null;
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
  workspaceRole: WorkspaceRole | null;
  currentUserLabel: string;
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

function formatDecisionLabel(decision: DecisionType): string {
  switch (decision) {
    case 'accepted':
      return 'Accepted';
    case 'edited':
      return 'Edited';
    case 'rejected':
      return 'Rejected';
    case 'dismissed':
      return 'Dismissed';
  }
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
  workspaceRole,
  currentUserLabel,
  completedRun,
  latestAttempt,
  findings,
  evidence,
}: DocumentReviewWorkspaceProps) {
  const router = useRouter();
  const [localDecisions, setLocalDecisions] = React.useState<
    Record<string, PersistedDecisionInfo>
  >({});

  React.useEffect(() => {
    setLocalDecisions({});
  }, [completedRun?.id]);

  const effectiveFindings = React.useMemo(
    () =>
      findings.map((finding) => ({
        ...finding,
        decision: localDecisions[finding.id] ?? finding.decision,
      })),
    [findings, localDecisions]
  );

  const sortedFindings = React.useMemo(
    () => sortFindingsBySeverityAndOffset(effectiveFindings),
    [effectiveFindings]
  );
  const segments = React.useMemo(
    () => buildHighlightedDocumentSegments(content, sortedFindings),
    [content, sortedFindings]
  );

  const previewResult = React.useMemo(
    () =>
      applyAcceptedEditsToDocument(
        content,
        sortedFindings.map((item) => ({
          id: item.id,
          severity: item.severity,
          matched_text: item.matched_text,
          start_offset: item.start_offset,
          end_offset: item.end_offset,
          decision: item.decision?.decision ?? null,
          replacementText:
            item.decision?.decision === 'edited'
              ? item.decision.editedText
              : item.decision?.decision === 'accepted'
                ? item.suggested_text
                : null,
        }))
      ),
    [content, sortedFindings]
  );

  const canDecide = canRoleRecordDecision(workspaceRole);
  const serverRunning =
    latestAttempt?.status === 'running' &&
    !isStaleRunningReview(latestAttempt.startedAt);

  const [isSubmittingReview, setIsSubmittingReview] = React.useState(false);
  const inFlightReviewRef = React.useRef(false);
  const [reviewError, setReviewError] = React.useState<string | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = React.useState('');
  const [selectedFindingId, setSelectedFindingId] = React.useState<
    string | null
  >(() => sortedFindings[0]?.id ?? null);

  // Evidence disclosure & gate state (High/Critical start collapsed until clicked)
  const [openedEvidenceIds, setOpenedEvidenceIds] = React.useState<
    Record<string, boolean>
  >({});
  const [expandedEvidenceIds, setExpandedEvidenceIds] = React.useState<
    Record<string, boolean>
  >({});

  // Inline decision editing / rejection state
  const [activeEditor, setActiveEditor] = React.useState<{
    findingId: string;
    mode: 'edit' | 'reject';
    text: string;
  } | null>(null);
  const [submittingFindingId, setSubmittingFindingId] = React.useState<
    string | null
  >(null);
  const [decisionErrors, setDecisionErrors] = React.useState<
    Record<string, string>
  >({});

  // Final-text read-only preview & copy state
  const [showPreview, setShowPreview] = React.useState(false);
  const [copyFeedback, setCopyFeedback] = React.useState<string | null>(null);

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

  function toggleEvidencePanel(finding: PersistedFindingItem, currentlyOpen: boolean) {
    const nextOpen = !currentlyOpen;
    setExpandedEvidenceIds((prev) => ({ ...prev, [finding.id]: nextOpen }));
    if (nextOpen) {
      setOpenedEvidenceIds((prev) => ({ ...prev, [finding.id]: true }));
    }
  }

  async function handleRunReview() {
    if (inFlightReviewRef.current || isSubmittingReview || serverRunning) {
      return;
    }

    inFlightReviewRef.current = true;
    setIsSubmittingReview(true);
    setReviewError(null);
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
        setReviewError(errText);
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
      setReviewError(msg);
      setLiveAnnouncement(msg);
    } finally {
      inFlightReviewRef.current = false;
      setIsSubmittingReview(false);
    }
  }

  async function submitDecision(
    finding: PersistedFindingItem,
    decision: DecisionType,
    extra?: { editedText?: string; comment?: string }
  ) {
    if (!finding.suggestion_id || submittingFindingId) {
      return;
    }

    const clientCheck = validateDecisionInput({
      decision,
      ...(extra?.editedText !== undefined
        ? { editedText: extra.editedText }
        : {}),
      ...(extra?.comment !== undefined ? { comment: extra.comment } : {}),
    });
    if (!clientCheck.ok) {
      setDecisionErrors((prev) => ({
        ...prev,
        [finding.id]: clientCheck.error,
      }));
      setLiveAnnouncement(clientCheck.error);
      return;
    }

    setDecisionErrors((prev) => {
      const copy = { ...prev };
      delete copy[finding.id];
      return copy;
    });
    setSubmittingFindingId(finding.id);

    try {
      const response = await fetch(
        `/api/suggestions/${finding.suggestion_id}/decision`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            decision,
            ...(extra?.editedText !== undefined
              ? { editedText: extra.editedText }
              : {}),
            ...(extra?.comment !== undefined ? { comment: extra.comment } : {}),
          }),
        }
      );

      const payload = (await response.json().catch(() => ({}))) as {
        decisionId?: string;
        decision?: DecisionType;
        editedText?: string | null;
        comment?: string | null;
        createdAt?: string;
        error?: string;
      };

      if (!response.ok) {
        const msg = payload.error ?? 'Failed to record review decision.';
        setDecisionErrors((prev) => ({ ...prev, [finding.id]: msg }));
        setLiveAnnouncement(msg);
        return;
      }

      setLocalDecisions((prev) => ({
        ...prev,
        [finding.id]: {
          id: payload.decisionId ?? finding.id,
          decision: payload.decision ?? decision,
          editedText: payload.editedText ?? extra?.editedText?.trim() ?? null,
          comment: payload.comment ?? extra?.comment?.trim() ?? null,
          reviewerName: currentUserLabel,
          createdAt: payload.createdAt ?? new Date().toISOString(),
        },
      }));
      setActiveEditor(null);
      setLiveAnnouncement(
        `Recorded ${decision} decision for finding "${finding.matched_text}".`
      );
      router.refresh();
    } catch {
      const msg = 'Network error while recording decision. Please try again.';
      setDecisionErrors((prev) => ({ ...prev, [finding.id]: msg }));
      setLiveAnnouncement(msg);
    } finally {
      setSubmittingFindingId(null);
    }
  }

  async function handleCopyPreview() {
    setCopyFeedback(null);
    try {
      await navigator.clipboard.writeText(previewResult.text);
      setCopyFeedback('Copied preview text to clipboard.');
      setLiveAnnouncement('Copied preview text to clipboard.');
    } catch {
      setCopyFeedback('Clipboard copy failed in this browser context.');
    }
  }

  const isBusy = isSubmittingReview || serverRunning;
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

          <div className="flex flex-wrap items-center gap-2">
            {completedRun ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowPreview((v) => !v)}
                aria-expanded={showPreview}
              >
                <Eye className="size-4" aria-hidden="true" />
                <span>
                  {showPreview ? 'Hide final text' : 'Preview final text'}
                </span>
              </Button>
            ) : null}

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
        </div>

        {reviewError ? (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-md border border-severity-critical-border bg-severity-critical-bg px-4 py-3 text-sm text-severity-critical-fg"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{reviewError}</span>
          </div>
        ) : null}

        {latestRunFailed && !reviewError ? (
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

      {showPreview ? (
        <section
          aria-labelledby="final-preview-heading"
          className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6 shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <div>
              <h2
                id="final-preview-heading"
                className="font-serif text-lg font-semibold tracking-tight text-foreground"
              >
                Preview Final Text (Read-only)
              </h2>
              <p className="text-xs text-muted-foreground">
                Applies {previewResult.appliedCount} accepted/edited{' '}
                {previewResult.appliedCount === 1 ? 'change' : 'changes'} from
                end to start; stored document draft remains untouched.
                {previewResult.skippedOverlapCount > 0
                  ? ` Skipped ${previewResult.skippedOverlapCount} overlapping edit(s).`
                  : ''}
                {previewResult.skippedUnmatchedCount > 0
                  ? ` Skipped ${previewResult.skippedUnmatchedCount} ambiguous or unmatched edit(s).`
                  : ''}
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyPreview}
            >
              <Copy className="size-3.5" aria-hidden="true" />
              <span>Copy</span>
            </Button>
          </div>

          {copyFeedback ? (
            <p role="status" className="text-xs font-medium text-primary">
              {copyFeedback}
            </p>
          ) : null}

          <p className="max-w-[65ch] whitespace-pre-wrap rounded-md border border-border bg-background p-4 text-sm leading-relaxed text-foreground">
            {previewResult.text}
          </p>
        </section>
      ) : null}

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
                const hasHighlight = segments.some(
                  (seg) =>
                    seg.type === 'highlight' && seg.findingId === finding.id
                );
                const confidencePct = Math.round(finding.confidence * 100);
                const isHighOrCritical =
                  finding.severity === 'high' ||
                  finding.severity === 'critical';
                const isEvidenceOpen =
                  expandedEvidenceIds[finding.id] ?? !isHighOrCritical;
                const evidenceWasOpened = Boolean(openedEvidenceIds[finding.id]);
                const hasDecision = Boolean(finding.decision);
                const isSubmittingCard = submittingFindingId === finding.id;
                const cardError = decisionErrors[finding.id];
                const isEditingThis =
                  activeEditor?.findingId === finding.id &&
                  activeEditor.mode === 'edit';
                const isRejectingThis =
                  activeEditor?.findingId === finding.id &&
                  activeEditor.mode === 'reject';

                const commonActionDisabled =
                  hasDecision ||
                  !canDecide ||
                  isSubmittingCard ||
                  !finding.suggestion_id;

                const acceptOrEditDisabled =
                  commonActionDisabled ||
                  !canAcceptOrEditFinding({
                    severity: finding.severity,
                    evidenceWasOpened,
                    suggestedText: finding.suggested_text,
                  });

                return (
                  <li key={finding.id}>
                    <article
                      onFocusCapture={() => setSelectedFindingId(finding.id)}
                      aria-current={isSelected ? 'true' : undefined}
                      className={cn(
                        'flex flex-col gap-3 rounded-lg border p-4 transition-colors duration-150 motion-reduce:transition-none',
                        isSelected
                          ? 'border-primary bg-accent/25'
                          : 'border-border bg-background hover:bg-muted/40'
                      )}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            ref={(el) => {
                              findingRefs.current[finding.id] = el;
                            }}
                            type="button"
                            onClick={() => setSelectedFindingId(finding.id)}
                            aria-pressed={isSelected}
                            className="inline-flex items-center rounded border border-border bg-card px-2 py-0.5 font-mono text-xs text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
                          >
                            <span className="sr-only">Select finding </span>#
                            {index + 1}
                          </button>
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
                          Suggested revision
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
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                            <BookOpenCheck
                              className="size-3.5 text-primary"
                              aria-hidden="true"
                            />
                            <span>Evidence</span>
                          </span>
                          <button
                            type="button"
                            aria-expanded={isEvidenceOpen}
                            onClick={() =>
                              toggleEvidencePanel(finding, isEvidenceOpen)
                            }
                            className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium text-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <span>
                              {isEvidenceOpen
                                ? 'Hide evidence'
                                : 'Inspect evidence'}
                            </span>
                            {isEvidenceOpen ? (
                              <ChevronUp
                                className="size-3.5"
                                aria-hidden="true"
                              />
                            ) : (
                              <ChevronDown
                                className="size-3.5"
                                aria-hidden="true"
                              />
                            )}
                          </button>
                        </div>
                        {isEvidenceOpen ? (
                          <div className="mt-2">
                            {renderEvidencePanel(finding, evidence)}
                          </div>
                        ) : (
                          <p className="mt-1.5 text-xs text-muted-foreground">
                            {isHighOrCritical
                              ? 'Inspect evidence before accepting or editing high or critical findings.'
                              : 'Open the evidence panel to inspect cited workspace sources.'}
                          </p>
                        )}
                      </div>

                      {finding.decision ? (
                        <div className="flex flex-col gap-1.5 rounded-md border border-primary/30 bg-accent/40 px-3 py-2.5 text-xs">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <Badge variant="secondary">
                              <CheckCircle2
                                className="size-3"
                                aria-hidden="true"
                              />
                              <span>
                                {formatDecisionLabel(finding.decision.decision)}
                              </span>
                            </Badge>
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {finding.decision.reviewerName} ·{' '}
                              {formatUtcTimestamp(finding.decision.createdAt)}{' '}
                              UTC
                            </span>
                          </div>
                          {finding.decision.editedText ? (
                            <p className="font-mono text-xs text-foreground">
                              Edited text: {finding.decision.editedText}
                            </p>
                          ) : null}
                          {finding.decision.comment ? (
                            <p className="text-foreground">
                              Comment: {finding.decision.comment}
                            </p>
                          ) : null}
                        </div>
                      ) : null}

                      {!canDecide && !hasDecision ? (
                        <p className="text-xs font-medium text-muted-foreground">
                          Your role cannot record decisions.
                        </p>
                      ) : null}

                      {!hasDecision &&
                      canDecide &&
                      finding.suggested_text &&
                      isHighOrCritical &&
                      !evidenceWasOpened ? (
                        <p className="text-xs text-muted-foreground">
                          Open the evidence panel above to enable Accept or Edit
                          on this {finding.severity} finding.
                        </p>
                      ) : null}

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {finding.suggested_text !== null ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              disabled={acceptOrEditDisabled}
                              onClick={() =>
                                submitDecision(finding, 'accepted')
                              }
                            >
                              <Check className="size-3.5" aria-hidden="true" />
                              <span>Accept</span>
                            </Button>

                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={acceptOrEditDisabled}
                              onClick={() => {
                                setDecisionErrors((prev) => {
                                  const copy = { ...prev };
                                  delete copy[finding.id];
                                  return copy;
                                });
                                setActiveEditor({
                                  findingId: finding.id,
                                  mode: 'edit',
                                  text: finding.suggested_text ?? '',
                                });
                              }}
                            >
                              <Pencil className="size-3.5" aria-hidden="true" />
                              <span>Edit</span>
                            </Button>
                          </>
                        ) : null}

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={commonActionDisabled}
                          onClick={() => {
                            setDecisionErrors((prev) => {
                              const copy = { ...prev };
                              delete copy[finding.id];
                              return copy;
                            });
                            setActiveEditor({
                              findingId: finding.id,
                              mode: 'reject',
                              text: '',
                            });
                          }}
                        >
                          <XCircle className="size-3.5" aria-hidden="true" />
                          <span>Reject</span>
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={commonActionDisabled}
                          onClick={() => submitDecision(finding, 'dismissed')}
                        >
                          <span>Dismiss</span>
                        </Button>
                      </div>

                      {isEditingThis ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            submitDecision(finding, 'edited', {
                              editedText: activeEditor.text,
                            });
                          }}
                          className="flex flex-col gap-2 rounded-md border border-border bg-card p-3"
                        >
                          <label
                            htmlFor={`edit-text-${finding.id}`}
                            className="text-xs font-medium text-foreground"
                          >
                            Edited replacement text (max{' '}
                            {MAX_DECISION_TEXT_LENGTH} chars)
                          </label>
                          <Textarea
                            id={`edit-text-${finding.id}`}
                            rows={2}
                            maxLength={MAX_DECISION_TEXT_LENGTH}
                            value={activeEditor.text}
                            aria-invalid={Boolean(cardError)}
                            aria-describedby={
                              cardError
                                ? `decision-error-${finding.id}`
                                : undefined
                            }
                            onChange={(e) => {
                              setDecisionErrors((prev) => {
                                if (!(finding.id in prev)) {
                                  return prev;
                                }
                                const copy = { ...prev };
                                delete copy[finding.id];
                                return copy;
                              });
                              setActiveEditor({
                                ...activeEditor,
                                text: e.target.value,
                              });
                            }}
                            disabled={isSubmittingCard}
                          />
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              type="submit"
                              size="sm"
                              disabled={isSubmittingCard}
                            >
                              Save edit
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={isSubmittingCard}
                              onClick={() => setActiveEditor(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </form>
                      ) : null}

                      {isRejectingThis ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            submitDecision(finding, 'rejected', {
                              comment: activeEditor.text,
                            });
                          }}
                          className="flex flex-col gap-2 rounded-md border border-border bg-card p-3"
                        >
                          <label
                            htmlFor={`reject-reason-${finding.id}`}
                            className="text-xs font-medium text-foreground"
                          >
                            Rejection reason (required, max{' '}
                            {MAX_DECISION_TEXT_LENGTH} chars)
                          </label>
                          <Textarea
                            id={`reject-reason-${finding.id}`}
                            rows={2}
                            maxLength={MAX_DECISION_TEXT_LENGTH}
                            placeholder="Explain why this finding does not apply..."
                            value={activeEditor.text}
                            aria-invalid={Boolean(cardError)}
                            aria-describedby={
                              cardError
                                ? `decision-error-${finding.id}`
                                : undefined
                            }
                            onChange={(e) => {
                              setDecisionErrors((prev) => {
                                if (!(finding.id in prev)) {
                                  return prev;
                                }
                                const copy = { ...prev };
                                delete copy[finding.id];
                                return copy;
                              });
                              setActiveEditor({
                                ...activeEditor,
                                text: e.target.value,
                              });
                            }}
                            disabled={isSubmittingCard}
                          />
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              type="submit"
                              size="sm"
                              variant="destructive"
                              disabled={isSubmittingCard}
                            >
                              Confirm reject
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={isSubmittingCard}
                              onClick={() => setActiveEditor(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </form>
                      ) : null}

                      {cardError ? (
                        <p
                          id={`decision-error-${finding.id}`}
                          role="alert"
                          className="rounded-md border border-severity-critical-border bg-severity-critical-bg px-3 py-2 text-xs text-severity-critical-fg"
                        >
                          {cardError}
                        </p>
                      ) : null}
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
