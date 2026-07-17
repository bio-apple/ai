import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildArtifacts } from '../../scripts/build-artifacts.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, '.tmp-search-index-test');

test('buildArtifacts expands search index with content types', () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  const { searchIndex } = buildArtifacts(OUT);
  assert.ok(searchIndex.length >= 120, `expected >=120 entries, got ${searchIndex.length}`);

  const types = new Set(searchIndex.map((item) => item.type));
  for (const expected of ['课程', '资讯', '开源', '视频', '模型']) {
    assert.ok(types.has(expected), `missing type ${expected}`);
  }

  const course = searchIndex.find((item) => item.type === '课程');
  assert.ok(course?.external && course.url?.startsWith('http'));

  fs.rmSync(OUT, { recursive: true, force: true });
});
