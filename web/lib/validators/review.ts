import type {
  AiStatus,
  Category,
  Finding,
  FindingOrigin,
  ReviewResponse,
  Severity,
  VerificationStatus,
} from '../types/finding.ts';
import { isUuid, type ValidationResult } from './m1.ts';

export const REVIEW_RUN_TIMEOUT_MS = 90_000;

const VALID_CATEGORIES = new Set<Category>([
  'tone',
  'terminology',
  'fact',
  'unsupported_claim',
  'messaging',
]);

const VALID_SEVERITIES = new Set<Severity>([
  'critical',
  'high',
  'medium',
  'low',
]);

const VALID_AI_STATUSES = new Set<AiStatus>([
  'ok',
  'unavailable',
  'invalid_output',
  'skipped',
]);

const VALID_VERIFICATION_STATUSES = new Set<VerificationStatus>([
  'verified',
  'unverified',
]);

const VALID_ORIGINS = new Set<FindingOrigin>(['deterministic', 'llm']);

const VALID_SOURCE_TYPES = new Set([
  'terminology',
  'fact',
  'guideline_rule',
  'model',
]);

const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export interface HighlightableFinding {
  id: string;
  severity: Severity;
  matched_text: string;
  start_offset: number;
  end_offset: number;
}

export interface ResolvedHighlightSpan {
  start: number;
  end: number;
  via: 'offset' | 'indexOf';
}

export type DocumentSegment =
  | {
      type: 'text';
      text: string;
    }
  | {
      type: 'highlight';
      text: string;
      findingId: string;
      findingIndex: number;
      severity: Severity;
      start: number;
      end: number;
    };

export function validateReviewRequestBody(
  payload: unknown
): ValidationResult<{ documentId: string }> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, error: 'Invalid JSON request body.' };
  }

  const record = payload as Record<string, unknown>;
  if (typeof record.documentId !== 'string' || !isUuid(record.documentId.trim())) {
    return { ok: false, error: 'A valid documentId UUID is required.' };
  }

  return {
    ok: true,
    data: {
      documentId: record.documentId.trim(),
    },
  };
}

export function sortFindingsBySeverityAndOffset<
  T extends { severity: Severity; start_offset: number },
>(findings: readonly T[]): T[] {
  return [...findings].sort((a, b) => {
    const sevDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sevDiff !== 0) {
      return sevDiff;
    }
    return a.start_offset - b.start_offset;
  });
}

function normalizeFinding(
  raw: unknown,
  index: number
): ValidationResult<Finding> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: `Finding at index ${index} must be an object.` };
  }

  const r = raw as Record<string, unknown>;

  if (
    typeof r.category !== 'string' ||
    !VALID_CATEGORIES.has(r.category as Category)
  ) {
    return { ok: false, error: `Finding ${index} has invalid category.` };
  }

  if (
    typeof r.severity !== 'string' ||
    !VALID_SEVERITIES.has(r.severity as Severity)
  ) {
    return { ok: false, error: `Finding ${index} has invalid severity.` };
  }

  if (
    typeof r.matched_text !== 'string' ||
    r.matched_text.length === 0 ||
    r.matched_text.includes('\u0000')
  ) {
    return { ok: false, error: `Finding ${index} has invalid matched_text.` };
  }

  if (
    typeof r.start_offset !== 'number' ||
    !Number.isInteger(r.start_offset) ||
    r.start_offset < 0 ||
    typeof r.end_offset !== 'number' ||
    !Number.isInteger(r.end_offset) ||
    r.end_offset <= r.start_offset
  ) {
    return { ok: false, error: `Finding ${index} has invalid offsets.` };
  }

  if (
    typeof r.explanation !== 'string' ||
    r.explanation.trim().length === 0 ||
    r.explanation.includes('\u0000')
  ) {
    return { ok: false, error: `Finding ${index} has invalid explanation.` };
  }

  let sourceType: string | null = null;
  if (r.source_type !== undefined && r.source_type !== null) {
    if (
      typeof r.source_type !== 'string' ||
      !VALID_SOURCE_TYPES.has(r.source_type)
    ) {
      return { ok: false, error: `Finding ${index} has invalid source_type.` };
    }
    sourceType = r.source_type;
  }

  let sourceId: string | null = null;
  if (r.source_id !== undefined && r.source_id !== null) {
    if (
      typeof r.source_id !== 'string' ||
      r.source_id.trim().length === 0 ||
      r.source_id.includes('\u0000')
    ) {
      return { ok: false, error: `Finding ${index} has invalid source_id.` };
    }
    sourceId = r.source_id.trim();
  }

  if (typeof r.confidence !== 'number' || !Number.isFinite(r.confidence)) {
    return { ok: false, error: `Finding ${index} has invalid confidence.` };
  }
  const clampedConfidence = Math.min(1, Math.max(0, r.confidence));
  const roundedConfidence = Math.round(clampedConfidence * 100) / 100;

  if (
    typeof r.verification_status !== 'string' ||
    !VALID_VERIFICATION_STATUSES.has(
      r.verification_status as VerificationStatus
    )
  ) {
    return {
      ok: false,
      error: `Finding ${index} has invalid verification_status.`,
    };
  }

  if (
    typeof r.origin !== 'string' ||
    !VALID_ORIGINS.has(r.origin as FindingOrigin)
  ) {
    return { ok: false, error: `Finding ${index} has invalid origin.` };
  }

  let suggestedText: string | null = null;
  if (r.suggested_text !== undefined && r.suggested_text !== null) {
    if (
      typeof r.suggested_text !== 'string' ||
      r.suggested_text.includes('\u0000')
    ) {
      return {
        ok: false,
        error: `Finding ${index} has invalid suggested_text.`,
      };
    }
    suggestedText = r.suggested_text;
  }

  return {
    ok: true,
    data: {
      category: r.category as Category,
      severity: r.severity as Severity,
      matched_text: r.matched_text,
      start_offset: r.start_offset,
      end_offset: r.end_offset,
      explanation: r.explanation.trim(),
      source_type: sourceType,
      source_id: sourceId,
      confidence: roundedConfidence,
      verification_status: r.verification_status as VerificationStatus,
      origin: r.origin as FindingOrigin,
      suggested_text: suggestedText,
    },
  };
}

export function validateReviewResponse(
  payload: unknown,
  expectedDocumentId?: string
): ValidationResult<ReviewResponse> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, error: 'AI service returned a non-object response.' };
  }

  const record = payload as Record<string, unknown>;

  if (
    typeof record.document_id !== 'string' ||
    record.document_id.trim().length === 0
  ) {
    return { ok: false, error: 'AI service response is missing document_id.' };
  }
  const documentId = record.document_id.trim();
  if (expectedDocumentId && documentId !== expectedDocumentId) {
    return {
      ok: false,
      error: 'AI service response document_id does not match requested document.',
    };
  }

  if (
    typeof record.model_name !== 'string' ||
    record.model_name.trim().length === 0 ||
    record.model_name.includes('\u0000')
  ) {
    return { ok: false, error: 'AI service response has invalid model_name.' };
  }
  const modelName = record.model_name.trim().slice(0, 200);

  if (
    typeof record.ai_status !== 'string' ||
    !VALID_AI_STATUSES.has(record.ai_status as AiStatus)
  ) {
    return { ok: false, error: 'AI service response has invalid ai_status.' };
  }

  let aiDetail: string | null = null;
  if (record.ai_detail !== undefined && record.ai_detail !== null) {
    if (
      typeof record.ai_detail !== 'string' ||
      record.ai_detail.includes('\u0000')
    ) {
      return { ok: false, error: 'AI service response has invalid ai_detail.' };
    }
    const trimmedDetail = record.ai_detail.trim().slice(0, 500);
    aiDetail = trimmedDetail.length > 0 ? trimmedDetail : null;
  }

  let dropped = 0;
  if (record.dropped !== undefined) {
    if (
      typeof record.dropped !== 'number' ||
      !Number.isInteger(record.dropped) ||
      record.dropped < 0
    ) {
      return { ok: false, error: 'AI service response has invalid dropped count.' };
    }
    dropped = record.dropped;
  }

  let elapsedMs = 0;
  if (record.elapsed_ms !== undefined) {
    if (
      typeof record.elapsed_ms !== 'number' ||
      !Number.isInteger(record.elapsed_ms) ||
      record.elapsed_ms < 0
    ) {
      return { ok: false, error: 'AI service response has invalid elapsed_ms.' };
    }
    elapsedMs = record.elapsed_ms;
  }

  if (!Array.isArray(record.findings)) {
    return { ok: false, error: 'AI service response findings must be an array.' };
  }

  const normalizedFindings: Finding[] = [];
  for (let i = 0; i < record.findings.length; i += 1) {
    const parsed = normalizeFinding(record.findings[i], i);
    if (!parsed.ok) {
      return parsed;
    }
    normalizedFindings.push(parsed.data);
  }

  return {
    ok: true,
    data: {
      document_id: documentId,
      model_name: modelName,
      ai_status: record.ai_status as AiStatus,
      ai_detail: aiDetail,
      findings: sortFindingsBySeverityAndOffset(normalizedFindings),
      dropped,
      elapsed_ms: elapsedMs,
    },
  };
}

export function isStaleRunningReview(
  startedAtIso: string,
  nowMs = Date.now(),
  timeoutMs = REVIEW_RUN_TIMEOUT_MS
): boolean {
  const startedMs = Date.parse(startedAtIso);
  if (!Number.isFinite(startedMs)) {
    return true;
  }
  return nowMs - startedMs > timeoutMs;
}

export function classifyRunningReviews(
  runs: readonly { id: string; started_at: string }[],
  nowMs = Date.now(),
  timeoutMs = REVIEW_RUN_TIMEOUT_MS
): { staleIds: string[]; activeIds: string[] } {
  const staleIds: string[] = [];
  const activeIds: string[] = [];

  for (const run of runs) {
    if (isStaleRunningReview(run.started_at, nowMs, timeoutMs)) {
      staleIds.push(run.id);
    } else {
      activeIds.push(run.id);
    }
  }

  return { staleIds, activeIds };
}

export function resolveHighlightSpan(
  content: string,
  finding: Pick<HighlightableFinding, 'matched_text' | 'start_offset' | 'end_offset'>
): ResolvedHighlightSpan | null {
  const { matched_text, start_offset, end_offset } = finding;

  if (
    Number.isInteger(start_offset) &&
    Number.isInteger(end_offset) &&
    start_offset >= 0 &&
    end_offset > start_offset &&
    end_offset <= content.length &&
    content.slice(start_offset, end_offset) === matched_text
  ) {
    return {
      start: start_offset,
      end: end_offset,
      via: 'offset',
    };
  }

  if (matched_text.length > 0) {
    const idx = content.indexOf(matched_text);
    if (idx >= 0) {
      return {
        start: idx,
        end: idx + matched_text.length,
        via: 'indexOf',
      };
    }
  }

  return null;
}

export function buildHighlightedDocumentSegments(
  content: string,
  sortedFindings: readonly HighlightableFinding[]
): DocumentSegment[] {
  if (content.length === 0) {
    return [];
  }

  const chosen: Array<{
    findingId: string;
    findingIndex: number;
    severity: Severity;
    start: number;
    end: number;
  }> = [];

  for (let i = 0; i < sortedFindings.length; i += 1) {
    const finding = sortedFindings[i];
    const span = resolveHighlightSpan(content, finding);
    if (!span) {
      continue;
    }

    const overlapsExisting = chosen.some(
      (existing) => span.start < existing.end && existing.start < span.end
    );
    if (overlapsExisting) {
      continue;
    }

    chosen.push({
      findingId: finding.id,
      findingIndex: i,
      severity: finding.severity,
      start: span.start,
      end: span.end,
    });
  }

  chosen.sort((a, b) => a.start - b.start);

  const segments: DocumentSegment[] = [];
  let cursor = 0;

  for (const span of chosen) {
    if (span.start > cursor) {
      segments.push({
        type: 'text',
        text: content.slice(cursor, span.start),
      });
    }
    segments.push({
      type: 'highlight',
      text: content.slice(span.start, span.end),
      findingId: span.findingId,
      findingIndex: span.findingIndex,
      severity: span.severity,
      start: span.start,
      end: span.end,
    });
    cursor = span.end;
  }

  if (cursor < content.length) {
    segments.push({
      type: 'text',
      text: content.slice(cursor),
    });
  }

  return segments;
}

