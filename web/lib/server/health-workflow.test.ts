import test from 'node:test';
import assert from 'node:assert/strict';
import { executeHealthCheck } from './health-workflow.ts';

test('executeHealthCheck refuses ai_service_configured=true unless URL, token, and service role are all set', async () => {
  const missingToken = await executeHealthCheck({
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
      AI_SERVICE_URL: 'https://ai.example.test',
      AI_SERVICE_TOKEN: '',
      SUPABASE_SERVICE_ROLE_KEY: 'service',
    },
    probeUpstream: false,
  });

  assert.equal(missingToken.status, 200);
  assert.equal(missingToken.body.supabase_configured, true);
  assert.equal(missingToken.body.ai_service_configured, false);
  assert.equal(missingToken.body.status, 'degraded');

  const complete = await executeHealthCheck({
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
      AI_SERVICE_URL: 'https://ai.example.test',
      AI_SERVICE_TOKEN: 'token',
      SUPABASE_SERVICE_ROLE_KEY: 'service',
    },
    probeUpstream: false,
  });

  assert.equal(complete.status, 200);
  assert.equal(complete.body.ai_service_configured, true);
  assert.equal(complete.body.status, 'ok');
});

test('executeHealthCheck active readiness probe checks AI /ready and returns 503 when upstream is not ready', async () => {
  const failProbe = await executeHealthCheck({
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
      AI_SERVICE_URL: 'https://ai.example.test',
      AI_SERVICE_TOKEN: 'token',
      SUPABASE_SERVICE_ROLE_KEY: 'service',
    },
    probeUpstream: true,
    fetchImpl: async () =>
      new Response(JSON.stringify({ status: 'not_ready' }), { status: 503 }),
  });

  assert.equal(failProbe.status, 503);
  assert.equal(failProbe.body.status, 'degraded');
  assert.equal(failProbe.body.upstream_ready, false);

  const okProbe = await executeHealthCheck({
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
      AI_SERVICE_URL: 'https://ai.example.test',
      AI_SERVICE_TOKEN: 'token',
      SUPABASE_SERVICE_ROLE_KEY: 'service',
    },
    probeUpstream: true,
    fetchImpl: async () =>
      new Response(JSON.stringify({ status: 'ready' }), { status: 200 }),
  });

  assert.equal(okProbe.status, 200);
  assert.equal(okProbe.body.status, 'ok');
  assert.equal(okProbe.body.upstream_ready, true);
});

