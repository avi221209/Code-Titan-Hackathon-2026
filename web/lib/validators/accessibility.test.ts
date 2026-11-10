import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function parseCssVars(cssBlock: string): Record<string, string> {
  const vars: Record<string, string> = {};
  const re = /(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cssBlock)) !== null) {
    vars[m[1]] = m[2];
  }
  return vars;
}

function relativeLuminance(hex: string): number {
  const raw = hex.replace('#', '');
  const vals = [0, 2, 4].map((i) => {
    const c = parseInt(raw.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * vals[0] + 0.7152 * vals[1] + 0.0722 * vals[2];
}

function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

test('globals.css --border-subtle meets WCAG 1.4.11 >= 3.0:1 non-text contrast in light and dark palettes', () => {
  const cssPath = path.resolve(process.cwd(), 'app/globals.css');
  const css = fs.readFileSync(cssPath, 'utf8');

  const rootMatch = css.match(/:root\s*\{([\s\S]*?)\n\}/);
  const darkMatch = css.match(/\.dark\s*\{([\s\S]*?)\n\}/);
  assert.ok(rootMatch, ':root block missing');
  assert.ok(darkMatch, '.dark block missing');

  const light = parseCssVars(rootMatch[1]);
  const dark = parseCssVars(darkMatch[1]);

  for (const bgKey of ['--bg-surface', '--bg-canvas', '--bg-muted', '--bg-accent']) {
    const ratio = contrastRatio(light['--border-subtle'], light[bgKey]);
    assert.ok(
      ratio >= 3.0,
      `Light --border-subtle (${light['--border-subtle']}) vs ${bgKey} (${light[bgKey]}) = ${ratio.toFixed(2)} < 3.0`
    );
  }

  for (const bgKey of ['--bg-surface', '--bg-canvas', '--bg-muted']) {
    const ratio = contrastRatio(dark['--border-subtle'], dark[bgKey]);
    assert.ok(
      ratio >= 3.0,
      `Dark --border-subtle (${dark['--border-subtle']}) vs ${bgKey} (${dark[bgKey]}) = ${ratio.toFixed(2)} < 3.0`
    );
  }
});

test('primary layout shells and public entry pages include skip-to-main-content landmark links', () => {
  const files = [
    'components/app-shell.tsx',
    'app/page.tsx',
    'app/(auth)/login/page.tsx',
  ];
  for (const rel of files) {
    const src = fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8');
    assert.ok(
      src.includes('SkipLink') || src.includes('#main-content'),
      `${rel} missing SkipLink / #main-content`
    );
    assert.ok(
      src.includes('id="main-content"'),
      `${rel} missing id="main-content" target`
    );
  }
});

