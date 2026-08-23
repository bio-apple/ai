/**
 * 视频预览模块关键契约（转义、外链 rel、截图 URL 编码）。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const previewSrc = readFileSync(path.join(ROOT, 'lib/video-preview.js'), 'utf8');
const videosSrc = readFileSync(path.join(ROOT, 'videos.js'), 'utf8');
const syncSrc = readFileSync(path.join(ROOT, 'lib/video-preview-sync.js'), 'utf8');

test('video-preview uses DOM textContent escape, not raw String()', () => {
  assert.match(previewSrc, /d\.textContent = s/);
  assert.doesNotMatch(previewSrc, /BioAI\?\.escapeHtml/);
});

test('user-generated preview links include ugc nofollow', () => {
  assert.match(previewSrc, /ugc nofollow/);
});

test('thum.io screenshot URLs are encoded', () => {
  assert.match(videosSrc, /encodeURIComponent\(url\)/);
});

test('videos empty state does not use loading-hint CLS placeholder', () => {
  assert.match(videosSrc, /daily-empty/);
  assert.doesNotMatch(videosSrc, /loading-hint/);
});

test('video-preview-sync supports merge and BIOAI1 payload', () => {
  assert.match(syncSrc, /mergeHistories/);
  assert.match(syncSrc, /BIOAI1:/);
  assert.match(syncSrc, /initPage/);
});
