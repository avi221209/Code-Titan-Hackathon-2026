import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_DOCUMENT_CONTENT_LENGTH,
  MAX_DOCUMENT_TITLE_LENGTH,
  isAuthRoute,
  isProtectedPath,
  isUuid,
  parseLoginInput,
  validateDocumentInput,
} from './m1.ts';

test('isProtectedPath matches protected app prefixes on segment boundaries', () => {
  assert.equal(isProtectedPath('/dashboard'), true);
  assert.equal(isProtectedPath('/dashboard/settings'), true);
  assert.equal(isProtectedPath('/knowledge'), true);
  assert.equal(isProtectedPath('/documents'), true);
  assert.equal(isProtectedPath('/documents/new'), true);
  assert.equal(isProtectedPath('/documents/550e8400-e29b-41d4-a716-446655440000'), true);

  assert.equal(isProtectedPath('/'), false);
  assert.equal(isProtectedPath('/login'), false);
  assert.equal(isProtectedPath('/api/health'), false);
  assert.equal(isProtectedPath('/dashboard-preview'), false);
});

test('isAuthRoute matches /login only', () => {
  assert.equal(isAuthRoute('/login'), true);
  assert.equal(isAuthRoute('/login/'), true);
  assert.equal(isAuthRoute('/dashboard'), false);
  assert.equal(isAuthRoute('/'), false);
});

test('parseLoginInput validates and trims email while rejecting blank credentials', () => {
  const valid = parseLoginInput('  judge@brandguardian.demo ', 'secret-pass');
  assert.equal(valid.ok, true);
  if (valid.ok) {
    assert.equal(valid.data.email, 'judge@brandguardian.demo');
    assert.equal(valid.data.password, 'secret-pass');
  }

  assert.equal(parseLoginInput('', 'secret').ok, false);
  assert.equal(parseLoginInput('not-an-email', 'secret').ok, false);
  assert.equal(parseLoginInput('user@example.com', '').ok, false);
});

test('validateDocumentInput enforces required fields and 6000 char ceiling', () => {
  assert.equal(MAX_DOCUMENT_CONTENT_LENGTH, 6000);
  assert.equal(MAX_DOCUMENT_TITLE_LENGTH, 200);

  const exactLimit = 'a'.repeat(6000);
  const okRes = validateDocumentInput({
    title: '  Asterra Flow Launch Draft  ',
    content: exactLimit,
  });
  assert.equal(okRes.ok, true);
  if (okRes.ok) {
    assert.equal(okRes.data.title, 'Asterra Flow Launch Draft');
    assert.equal(okRes.data.content.length, 6000);
  }

  const overLimit = validateDocumentInput({
    title: 'Too long',
    content: 'a'.repeat(6001),
  });
  assert.equal(overLimit.ok, false);

  const blankTitle = validateDocumentInput({
    title: '   ',
    content: 'Valid copy',
  });
  assert.equal(blankTitle.ok, false);

  const blankContent = validateDocumentInput({
    title: 'Valid title',
    content: '   \n  ',
  });
  assert.equal(blankContent.ok, false);

  const badType = validateDocumentInput(null);
  assert.equal(badType.ok, false);
});

test('isUuid accepts canonical UUIDs and rejects malformed strings', () => {
  assert.equal(isUuid('550e8400-e29b-41d4-a716-446655440000'), true);
  assert.equal(isUuid('not-a-uuid'), false);
  assert.equal(isUuid(''), false);
});

