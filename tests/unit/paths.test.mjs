/**
 * 与 `src/lib/paths.ts` 的 asset/homeHref 行为对齐（Node 侧无 Astro env）。
 */
import assert from 'node:assert/strict';
import test from 'node:test';

function asset(base, path) {
  const normalizedBase = String(base || '/').replace(/\/?$/, '/');
  let cleaned = String(path || '').replace(/^\//, '');
  const baseSeg = normalizedBase.replace(/^\/|\/$/g, '');
  if (baseSeg && (cleaned === baseSeg || cleaned.startsWith(`${baseSeg}/`))) {
    cleaned = cleaned.slice(baseSeg.length).replace(/^\//, '');
  }
  return `${normalizedBase}${cleaned}`;
}

function homeHref(base, hash = '') {
  return `${asset(base, 'index.html')}${hash}`;
}

test('asset joins base and relative path', () => {
  assert.equal(asset('/ai/', 'tools/cursor.html'), '/ai/tools/cursor.html');
  assert.equal(asset('/ai', 'style.css'), '/ai/style.css');
  assert.equal(asset('/', '/app.js'), '/app.js');
});

test('asset does not double-prefix /ai', () => {
  assert.equal(asset('/ai/', '/ai/tools/hub.html'), '/ai/tools/hub.html');
  assert.equal(
    asset('/ai/', 'ai/compare/cursor-vs-copilot.html'),
    '/ai/compare/cursor-vs-copilot.html',
  );
});

test('homeHref keeps hash', () => {
  assert.equal(homeHref('/ai/', '#home-recommend'), '/ai/index.html#home-recommend');
});
