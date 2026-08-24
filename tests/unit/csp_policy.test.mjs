import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCspPolicy } from '../../scripts/csp-policy.mjs';

test('buildCspPolicy includes stricter XSS directives', () => {
  const csp = buildCspPolicy();
  assert.match(csp, /script-src-attr 'none'/);
  assert.match(csp, /frame-src 'none'/);
  assert.match(csp, /worker-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
});

test('buildCspPolicy for meta omits frame-ancestors', () => {
  const meta = buildCspPolicy({ forMeta: true });
  assert.doesNotMatch(meta, /frame-ancestors/);
  assert.match(meta, /script-src-attr 'none'/);
});

test('buildCspPolicy allows nested workers.dev sync API', () => {
  const prev = process.env.VIDEO_SYNC_API_URL;
  process.env.VIDEO_SYNC_API_URL = 'https://bioai-video-sync.fanyucai3.workers.dev';
  try {
    const csp = buildCspPolicy({ forMeta: true });
    assert.match(csp, /https:\/\/bioai-video-sync\.fanyucai3\.workers\.dev/);
    assert.match(csp, /https:\/\/\*\.fanyucai3\.workers\.dev/);
  } finally {
    if (prev === undefined) delete process.env.VIDEO_SYNC_API_URL;
    else process.env.VIDEO_SYNC_API_URL = prev;
  }
});
