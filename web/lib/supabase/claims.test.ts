import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  clearJwksCacheForTests,
  getCachedPublicJwks,
  getVerifiedClaimsUser,
} from './claims.ts';

test('getVerifiedClaimsUser returns id and email on valid claims and null on invalid/missing claims', async () => {
  const valid = await getVerifiedClaimsUser({
    auth: {
      getClaims: async (_jwt, options) => {
        assert.deepEqual(options?.jwks, {
          keys: [{ kid: 'k1', kty: 'EC', key_ops: ['verify'] }],
        });
        return {
          data: {
            claims: {
              sub: '11111111-1111-4111-8111-111111111111',
              email: 'reviewer@asterra.demo',
            },
          },
          error: null,
        };
      },
    },
    jwks: { keys: [{ kid: 'k1', kty: 'EC', key_ops: ['verify'] }] },
  });
  assert.deepEqual(valid, {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'reviewer@asterra.demo',
  });

  const missingSub = await getVerifiedClaimsUser({
    auth: {
      getClaims: async () => ({
        data: { claims: { sub: '', email: 'x@y.com' } },
        error: null,
      }),
    },
  });
  assert.equal(missingSub, null);

  const errored = await getVerifiedClaimsUser({
    auth: {
      getClaims: async () => ({
        data: null,
        error: { message: 'Invalid JWT' },
      }),
    },
  });
  assert.equal(errored, null);
});

test('getCachedPublicJwks caches public JWKS keys across calls and degrades safely on empty/failed fetch', async () => {
  clearJwksCacheForTests();
  let calls = 0;
  const fetchOk = async () => {
    calls += 1;
    return new Response(
      JSON.stringify({ keys: [{ kid: 'key-1', kty: 'EC', crv: 'P-256' }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };

  const first = await getCachedPublicJwks('https://proj.supabase.co', 'anon', fetchOk);
  const second = await getCachedPublicJwks('https://proj.supabase.co/', 'anon', fetchOk);
  assert.equal(calls, 1);
  assert.equal(first?.keys.length, 1);
  assert.deepEqual(second, first);

  clearJwksCacheForTests();
  const empty = await getCachedPublicJwks(
    'https://hs256.supabase.co',
    'anon',
    async () => new Response(JSON.stringify({ keys: [] }), { status: 200 })
  );
  assert.equal(empty, undefined);

  clearJwksCacheForTests();
  const failed = await getCachedPublicJwks(
    'https://down.supabase.co',
    'anon',
    async () => {
      throw new Error('network down');
    }
  );
  assert.equal(failed, undefined);
});

test('parent and dynamic [id] streaming loading.tsx boundaries are removed while leaf skeletons remain (DEF-12)', () => {
  const removed = [
    'app/(app)/loading.tsx',
    'app/(app)/documents/[id]/loading.tsx',
    'app/(app)/documents/[id]/history/loading.tsx',
  ];
  for (const rel of removed) {
    assert.equal(
      fs.existsSync(path.resolve(process.cwd(), rel)),
      false,
      `${rel} must be deleted so notFound() emits true HTTP 404`
    );
  }

  const kept = [
    'app/(app)/dashboard/loading.tsx',
    'app/(app)/documents/new/loading.tsx',
    'app/(app)/knowledge/loading.tsx',
  ];
  for (const rel of kept) {
    assert.equal(
      fs.existsSync(path.resolve(process.cwd(), rel)),
      true,
      `${rel} leaf loading skeleton must be kept`
    );
  }
});

test('SSR middleware and workspace context use getClaims verification while mutating APIs retain auth.getUser (DEF-11)', () => {
  const middlewareSrc = fs.readFileSync(
    path.resolve(process.cwd(), 'middleware.ts'),
    'utf8'
  );
  const workspaceSrc = fs.readFileSync(
    path.resolve(process.cwd(), 'lib/workspace.ts'),
    'utf8'
  );
  assert.ok(
    middlewareSrc.includes('getVerifiedClaimsUser') &&
      !middlewareSrc.includes('.auth.getUser('),
    'middleware.ts should verify claims rather than hitting getUser() per navigation'
  );
  assert.ok(
    workspaceSrc.includes('getVerifiedClaimsUser') &&
      !workspaceSrc.includes('.auth.getUser('),
    'workspace.ts should verify claims cleanly alongside RLS queries'
  );

  for (const apiFile of [
    'app/api/documents/route.ts',
    'lib/server/review-workflow.ts',
    'lib/server/decision-workflow.ts',
  ]) {
    const src = fs.readFileSync(path.resolve(process.cwd(), apiFile), 'utf8');
    assert.ok(
      src.includes('.auth.getUser('),
      `${apiFile} must keep live auth.getUser() check on mutations`
    );
  }
});
