import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyRunningReviews,
  buildHighlightedDocumentSegments,
  resolveHighlightSpan,
  sortFindingsBySeverityAndOffset,
  validateReviewRequestBody,
  validateReviewResponse,
} from './review.ts';

test('validateReviewRequestBody accepts valid documentId UUID and rejects malformed input', () => {
  const valid = validateReviewRequestBody({
    documentId: '550e8400-e29b-41d4-a716-446655440000',
  });
  assert.equal(valid.ok, true);
  if (valid.ok) {
    assert.equal(
      valid.data.documentId,
      '550e8400-e29b-41d4-a716-446655440000'
    );
  }

  assert.equal(validateReviewRequestBody(null).ok, false);
  assert.equal(validateReviewRequestBody([]).ok, false);
  assert.equal(validateReviewRequestBody({}).ok, false);
  assert.equal(validateReviewRequestBody({ documentId: 'not-a-uuid' }).ok, false);
});

test('validateReviewResponse accepts valid AI payload, clamps confidence, and sorts findings by severity then offset', () => {
  const docId = '550e8400-e29b-41d4-a716-446655440000';
  const result = validateReviewResponse(
    {
      document_id: docId,
      model_name: 'openai/gpt-oss-20b',
      ai_status: 'ok',
      ai_detail: null,
      dropped: 1,
      elapsed_ms: 412,
      findings: [
        {
          category: 'terminology',
          severity: 'medium',
          matched_text: 'consumers',
          start_offset: 90,
          end_offset: 99,
          explanation: 'Use "customers" instead of "consumers".',
          source_type: 'terminology',
          source_id: '550e8400-e29b-41d4-a716-446655440001',
          confidence: 0.99,
          verification_status: 'verified',
          origin: 'deterministic',
          suggested_text: 'customers',
        },
        {
          category: 'unsupported_claim',
          severity: 'critical',
          matched_text: 'guarantee 300% revenue growth',
          start_offset: 70,
          end_offset: 99,
          explanation: 'No approved evidence on file.',
          source_type: 'guideline_rule',
          source_id: '550e8400-e29b-41d4-a716-446655440002',
          confidence: 0.9,
          verification_status: 'verified',
          origin: 'deterministic',
          suggested_text: null,
        },
        {
          category: 'fact',
          severity: 'high',
          matched_text: 'founded in 2019',
          start_offset: 120,
          end_offset: 135,
          explanation: 'Founded in 2021.',
          source_type: 'fact',
          source_id: '550e8400-e29b-41d4-a716-446655440003',
          confidence: 0.954,
          verification_status: 'verified',
          origin: 'deterministic',
          suggested_text: 'founded in 2021',
        },
      ],
    },
    docId
  );

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.findings.length, 3);
    assert.equal(result.data.findings[0].severity, 'critical');
    assert.equal(result.data.findings[1].severity, 'high');
    assert.equal(result.data.findings[2].severity, 'medium');
    assert.equal(result.data.findings[1].confidence, 0.95);
    assert.equal(result.data.dropped, 1);
    assert.equal(result.data.elapsed_ms, 412);
  }
});

test('validateReviewResponse rejects mismatched document_id, invalid enums, or invalid offsets', () => {
  const docId = '550e8400-e29b-41d4-a716-446655440000';

  const wrongDoc = validateReviewResponse(
    {
      document_id: '00000000-0000-0000-0000-000000000001',
      model_name: 'openai/gpt-oss-20b',
      ai_status: 'ok',
      findings: [],
    },
    docId
  );
  assert.equal(wrongDoc.ok, false);

  const badStatus = validateReviewResponse({
    document_id: docId,
    model_name: 'openai/gpt-oss-20b',
    ai_status: 'invented_status',
    findings: [],
  });
  assert.equal(badStatus.ok, false);

  const badOffset = validateReviewResponse({
    document_id: docId,
    model_name: 'openai/gpt-oss-20b',
    ai_status: 'ok',
    findings: [
      {
        category: 'tone',
        severity: 'low',
        matched_text: 'hello',
        start_offset: 10,
        end_offset: 10,
        explanation: 'Invalid empty range.',
        verification_status: 'unverified',
        origin: 'llm',
        confidence: 0.6,
      },
    ],
  });
  assert.equal(badOffset.ok, false);
});

test('classifyRunningReviews marks runs older than 90s as stale and keeps recent runs active', () => {
  const now = Date.parse('2026-11-10T10:00:00.000Z');
  const classified = classifyRunningReviews(
    [
      { id: 'recent-90s', started_at: '2026-11-10T09:58:30.000Z' },
      { id: 'active-30s', started_at: '2026-11-10T09:59:30.000Z' },
      { id: 'stale-91s', started_at: '2026-11-10T09:58:29.000Z' },
      { id: 'invalid-ts', started_at: 'not-a-timestamp' },
    ],
    now
  );

  assert.deepEqual(classified.activeIds, ['recent-90s', 'active-30s']);
  assert.deepEqual(classified.staleIds, ['stale-91s', 'invalid-ts']);
});

test('resolveHighlightSpan falls back to indexOf when emoji surrogate pairs shift Python code-point offsets vs JS UTF-16 offsets', () => {
  const content = '🚀✨ Launch update: our consumers love Asterra Flow!';
  const target = 'consumers';
  // Python code-point offset: '🚀' = 1, '✨' = 1 => index 22
  const pyStart = [...'🚀✨ Launch update: our '].length;
  const pyEnd = pyStart + [...target].length;
  assert.notEqual(content.slice(pyStart, pyEnd), target);

  const resolved = resolveHighlightSpan(content, {
    matched_text: target,
    start_offset: pyStart,
    end_offset: pyEnd,
  });

  assert.deepEqual(resolved, {
    start: content.indexOf(target),
    end: content.indexOf(target) + target.length,
    via: 'indexOf',
  });
  if (resolved) {
    assert.equal(content.slice(resolved.start, resolved.end), target);
  }
});

test('resolveHighlightSpan returns null when neither offset slice nor matched_text exists in content', () => {
  const content = 'Asterra Flow helps small teams ship brand copy.';
  const missing = resolveHighlightSpan(content, {
    matched_text: 'hallucinated phrase',
    start_offset: 0,
    end_offset: 10,
  });
  assert.equal(missing, null);
});

test('buildHighlightedDocumentSegments preserves exact document text with emoji fallback and non-overlapping spans', () => {
  const content = '🚀 Our cheapest and best consumers tool.';
  const findings = sortFindingsBySeverityAndOffset([
    {
      id: 'f-med',
      severity: 'medium' as const,
      matched_text: 'consumers',
      start_offset: 23, // shifted by surrogate pair in Python
      end_offset: 32,
    },
    {
      id: 'f-high',
      severity: 'high' as const,
      matched_text: 'cheapest and best',
      start_offset: 6, // shifted by surrogate pair in Python
      end_offset: 23,
    },
    {
      id: 'f-overlap',
      severity: 'low' as const,
      matched_text: 'best',
      start_offset: content.indexOf('best'),
      end_offset: content.indexOf('best') + 4,
    },
    {
      id: 'f-unmatched',
      severity: 'low' as const,
      matched_text: 'absent text',
      start_offset: 0,
      end_offset: 5,
    },
  ]);

  const segments = buildHighlightedDocumentSegments(content, findings);
  const reconstructed = segments.map((seg) => seg.text).join('');
  assert.equal(reconstructed, content);

  const highlightedIds = segments
    .filter((seg) => seg.type === 'highlight')
    .map((seg) => seg.findingId);

  assert.deepEqual(highlightedIds, ['f-high', 'f-med']);
});

test('resolveHighlightSpan disambiguates repeated substrings by surrogate-bounded distance and rejects ambiguous duplicates', () => {
  const doc =
    '🚀🎉 Intro consumers enjoy it, and later consumers return.';
  const secondUtf16 = doc.lastIndexOf('consumers');
  // Simulated legacy Python code-point offset shifted by 2 astral emojis (-2 code units):
  const shiftedSecond = secondUtf16 - 2;

  const resolvedSecond = resolveHighlightSpan(doc, {
    matched_text: 'consumers',
    start_offset: shiftedSecond,
    end_offset: shiftedSecond + 'consumers'.length,
  });

  assert.deepEqual(resolvedSecond, {
    start: secondUtf16,
    end: secondUtf16 + 'consumers'.length,
    via: 'indexOf',
  });

  // Ambiguous offset outside surrogate shift bounds across duplicate matches must return null
  const ambiguous = resolveHighlightSpan('consumers one and consumers two', {
    matched_text: 'consumers',
    start_offset: 12,
    end_offset: 21,
  });
  assert.equal(ambiguous, null);
});

