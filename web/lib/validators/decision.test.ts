import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_DECISION_TEXT_LENGTH,
  applyAcceptedEditsToDocument,
  canAcceptOrEditFinding,
  validateDecisionInput,
} from './decision.ts';

test('validateDecisionInput validates decision enums and conditional required fields', () => {
  assert.equal(MAX_DECISION_TEXT_LENGTH, 500);

  const accepted = validateDecisionInput({ decision: 'accepted' });
  assert.equal(accepted.ok, true);
  if (accepted.ok) {
    assert.equal(accepted.data.decision, 'accepted');
    assert.equal(accepted.data.editedText, null);
    assert.equal(accepted.data.comment, null);
  }

  const edited = validateDecisionInput({
    decision: 'edited',
    editedText: '  customers  ',
    comment: 'Use approved glossary.',
  });
  assert.equal(edited.ok, true);
  if (edited.ok) {
    assert.equal(edited.data.editedText, 'customers');
    assert.equal(edited.data.comment, 'Use approved glossary.');
  }

  assert.equal(
    validateDecisionInput({ decision: 'edited', editedText: '   ' }).ok,
    false
  );
  assert.equal(
    validateDecisionInput({ decision: 'rejected', comment: '' }).ok,
    false
  );
  assert.equal(
    validateDecisionInput({ decision: 'approved_by_ai' }).ok,
    false
  );
  assert.equal(
    validateDecisionInput({
      decision: 'rejected',
      comment: 'x'.repeat(501),
    }).ok,
    false
  );
  assert.equal(
    validateDecisionInput({
      decision: 'edited',
      editedText: 'ok\u0000bad',
    }).ok,
    false
  );
});

test('applyAcceptedEditsToDocument applies accepted and edited replacements back-to-front cleanly', () => {
  const original =
    'Our consumers enjoy Asterra Flow. We were founded in 2019.';
  const preview = applyAcceptedEditsToDocument(original, [
    {
      id: 's1',
      severity: 'medium',
      matched_text: 'consumers',
      start_offset: original.indexOf('consumers'),
      end_offset: original.indexOf('consumers') + 'consumers'.length,
      decision: 'accepted',
      replacementText: 'clients',
    },
    {
      id: 's2',
      severity: 'high',
      matched_text: 'founded in 2019',
      start_offset: original.indexOf('founded in 2019'),
      end_offset: original.indexOf('founded in 2019') + 'founded in 2019'.length,
      decision: 'edited',
      replacementText: 'founded in 2021 (audited)',
    },
  ]);

  assert.equal(
    preview.text,
    'Our clients enjoy Asterra Flow. We were founded in 2021 (audited).'
  );
  assert.equal(preview.appliedCount, 2);
  assert.equal(preview.skippedOverlapCount, 0);
  assert.equal(preview.skippedUnmatchedCount, 0);
});

test('applyAcceptedEditsToDocument handles emoji UTF-16 offset drift via indexOf fallback and ignores rejected/dismissed items', () => {
  const original = '🚀 Our consumers love it and we were founded in 2019.';
  const pyConsumersStart = [...'🚀 Our '].length;
  const preview = applyAcceptedEditsToDocument(original, [
    {
      id: 's-emoji',
      severity: 'medium',
      matched_text: 'consumers',
      start_offset: pyConsumersStart, // deliberately 1 less than UTF-16 offset
      end_offset: pyConsumersStart + 'consumers'.length,
      decision: 'accepted',
      replacementText: 'customers',
    },
    {
      id: 's-rejected',
      severity: 'high',
      matched_text: 'founded in 2019',
      start_offset: 0,
      end_offset: 10,
      decision: 'rejected',
      replacementText: 'founded in 2021',
    },
  ]);

  assert.equal(
    preview.text,
    '🚀 Our customers love it and we were founded in 2019.'
  );
  assert.equal(preview.appliedCount, 1);
});

test('applyAcceptedEditsToDocument skips overlapping replacements without corrupting text', () => {
  const original = 'This is the cheapest and best service.';
  const preview = applyAcceptedEditsToDocument(original, [
    {
      id: 's-high',
      severity: 'high',
      matched_text: 'cheapest and best',
      start_offset: original.indexOf('cheapest and best'),
      end_offset:
        original.indexOf('cheapest and best') + 'cheapest and best'.length,
      decision: 'accepted',
      replacementText: 'leading',
    },
    {
      id: 's-overlap',
      severity: 'low',
      matched_text: 'best',
      start_offset: original.indexOf('best'),
      end_offset: original.indexOf('best') + 'best'.length,
      decision: 'edited',
      replacementText: 'top',
    },
  ]);

  assert.equal(preview.text, 'This is the leading service.');
  assert.equal(preview.appliedCount, 1);
  assert.equal(preview.skippedOverlapCount, 1);
});

test('applyAcceptedEditsToDocument edits the 2nd repeated occurrence under legacy surrogate shift and refuses ambiguous duplicates', () => {
  const doc = '🚀🎉 First consumers read this, second consumers buy this.';
  const secondIdx = doc.lastIndexOf('consumers');
  const legacyShifted = secondIdx - 2;

  const fixed = applyAcceptedEditsToDocument(doc, [
    {
      id: 's-2nd',
      severity: 'medium',
      matched_text: 'consumers',
      start_offset: legacyShifted,
      end_offset: legacyShifted + 'consumers'.length,
      decision: 'accepted',
      replacementText: 'customers',
    },
  ]);

  assert.equal(
    fixed.text,
    '🚀🎉 First consumers read this, second customers buy this.'
  );
  assert.equal(fixed.appliedCount, 1);
  assert.equal(fixed.skippedUnmatchedCount, 0);

  const ambiguous = applyAcceptedEditsToDocument(
    'consumers here and consumers there.',
    [
      {
        id: 's-ambig',
        severity: 'medium',
        matched_text: 'consumers',
        start_offset: 50,
        end_offset: 59,
        decision: 'accepted',
        replacementText: 'customers',
      },
    ]
  );

  assert.equal(ambiguous.text, 'consumers here and consumers there.');
  assert.equal(ambiguous.appliedCount, 0);
  assert.equal(ambiguous.skippedUnmatchedCount, 1);
});

test('canAcceptOrEditFinding enforces High/Critical evidence gate and blocks null suggested_text', () => {
  assert.equal(
    canAcceptOrEditFinding({
      severity: 'critical',
      evidenceWasOpened: false,
      suggestedText: 'revised',
    }),
    false
  );
  assert.equal(
    canAcceptOrEditFinding({
      severity: 'high',
      evidenceWasOpened: false,
      suggestedText: 'revised',
    }),
    false
  );
  assert.equal(
    canAcceptOrEditFinding({
      severity: 'high',
      evidenceWasOpened: true,
      suggestedText: null,
    }),
    false
  );
  assert.equal(
    canAcceptOrEditFinding({
      severity: 'high',
      evidenceWasOpened: true,
      suggestedText: 'revised',
    }),
    true
  );
  assert.equal(
    canAcceptOrEditFinding({
      severity: 'medium',
      evidenceWasOpened: false,
      suggestedText: 'revised',
    }),
    true
  );
});

