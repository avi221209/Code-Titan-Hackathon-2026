import type { Severity } from '../types/finding.ts';
import type { ValidationResult } from './m1.ts';
import {
  resolveHighlightSpan,
  sortFindingsBySeverityAndOffset,
} from './review.ts';

export const MAX_DECISION_TEXT_LENGTH = 500;

export type DecisionType = 'accepted' | 'edited' | 'rejected' | 'dismissed';

const VALID_DECISIONS = new Set<DecisionType>([
  'accepted',
  'edited',
  'rejected',
  'dismissed',
]);

const DECISION_ROLES = new Set(['approver', 'manager', 'admin']);

export interface ValidatedDecisionInput {
  decision: DecisionType;
  editedText: string | null;
  comment: string | null;
}

export interface ReplacementCandidate {
  id: string;
  severity: Severity;
  matched_text: string;
  start_offset: number;
  end_offset: number;
  decision: string | null | undefined;
  replacementText: string | null | undefined;
}

export interface AppliedPreviewResult {
  text: string;
  appliedCount: number;
  skippedOverlapCount: number;
  skippedUnmatchedCount: number;
}

export function canRoleRecordDecision(
  role: string | null | undefined
): boolean {
  return Boolean(role && DECISION_ROLES.has(role));
}

export function validateDecisionInput(
  payload: unknown
): ValidationResult<ValidatedDecisionInput> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, error: 'Invalid JSON request body.' };
  }

  const record = payload as Record<string, unknown>;
  if (
    typeof record.decision !== 'string' ||
    !VALID_DECISIONS.has(record.decision as DecisionType)
  ) {
    return {
      ok: false,
      error: 'Decision must be accepted, edited, rejected, or dismissed.',
    };
  }

  const decision = record.decision as DecisionType;

  let editedText: string | null = null;
  if (record.editedText !== undefined && record.editedText !== null) {
    if (typeof record.editedText !== 'string') {
      return { ok: false, error: 'Edited text must be a string.' };
    }
    if (record.editedText.includes('\u0000')) {
      return { ok: false, error: 'Edited text cannot contain null bytes.' };
    }
    const trimmed = record.editedText.trim();
    if (trimmed.length > MAX_DECISION_TEXT_LENGTH) {
      return {
        ok: false,
        error: `Edited text must be ${MAX_DECISION_TEXT_LENGTH} characters or fewer.`,
      };
    }
    editedText = trimmed.length > 0 ? trimmed : null;
  }

  let comment: string | null = null;
  if (record.comment !== undefined && record.comment !== null) {
    if (typeof record.comment !== 'string') {
      return { ok: false, error: 'Comment must be a string.' };
    }
    if (record.comment.includes('\u0000')) {
      return { ok: false, error: 'Comment cannot contain null bytes.' };
    }
    const trimmed = record.comment.trim();
    if (trimmed.length > MAX_DECISION_TEXT_LENGTH) {
      return {
        ok: false,
        error: `Comment must be ${MAX_DECISION_TEXT_LENGTH} characters or fewer.`,
      };
    }
    comment = trimmed.length > 0 ? trimmed : null;
  }

  if (decision === 'edited' && !editedText) {
    return {
      ok: false,
      error: 'Edited text is required when saving an edited revision.',
    };
  }

  if (decision === 'rejected' && !comment) {
    return {
      ok: false,
      error: 'A rejection reason is required when rejecting a finding.',
    };
  }

  return {
    ok: true,
    data: {
      decision,
      editedText: decision === 'edited' ? editedText : null,
      comment,
    },
  };
}

export function applyAcceptedEditsToDocument(
  content: string,
  candidates: readonly ReplacementCandidate[]
): AppliedPreviewResult {
  const actionable = sortFindingsBySeverityAndOffset(
    candidates.filter(
      (item) =>
        (item.decision === 'accepted' || item.decision === 'edited') &&
        typeof item.replacementText === 'string' &&
        item.replacementText.length > 0
    )
  );

  const selected: Array<{
    start: number;
    end: number;
    replacementText: string;
  }> = [];
  let skippedOverlapCount = 0;
  let skippedUnmatchedCount = 0;

  for (const item of actionable) {
    const span = resolveHighlightSpan(content, item);
    if (!span || content.slice(span.start, span.end) !== item.matched_text) {
      skippedUnmatchedCount += 1;
      continue;
    }

    const overlaps = selected.some(
      (existing) => span.start < existing.end && existing.start < span.end
    );
    if (overlaps) {
      skippedOverlapCount += 1;
      continue;
    }

    selected.push({
      start: span.start,
      end: span.end,
      replacementText: item.replacementText as string,
    });
  }

  // Apply from end to start so trailing replacements never shift earlier offsets.
  selected.sort((a, b) => b.start - a.start);

  let nextText = content;
  for (const edit of selected) {
    nextText =
      nextText.slice(0, edit.start) +
      edit.replacementText +
      nextText.slice(edit.end);
  }

  return {
    text: nextText,
    appliedCount: selected.length,
    skippedOverlapCount,
    skippedUnmatchedCount,
  };
}
