import test from 'node:test';
import assert from 'node:assert/strict';
import nextConfig from '../../next.config.mjs';

test('next.config disables X-Powered-By and sets hardened security headers', async () => {
  assert.equal(nextConfig.poweredByHeader, false);

  const headerRules = await nextConfig.headers();
  assert.ok(headerRules.length > 0);
  const rootRule = headerRules.find((r) => r.source === '/(.*)');
  assert.ok(rootRule);

  const map = new Map(
    rootRule.headers.map((h) => [h.key.toLowerCase(), h.value])
  );

  assert.equal(map.get('x-content-type-options'), 'nosniff');
  assert.equal(map.get('x-frame-options'), 'DENY');
  assert.equal(map.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert.equal(
    map.get('permissions-policy'),
    'camera=(), microphone=(), geolocation=()'
  );
  assert.equal(map.get('x-dns-prefetch-control'), 'off');

  const csp = map.get('content-security-policy');
  assert.ok(csp, 'Content-Security-Policy header must be configured');
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /form-action 'self'/);
  assert.doesNotMatch(csp, /upgrade-insecure-requests/);
});
