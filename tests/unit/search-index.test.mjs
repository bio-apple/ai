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
  assert.ok(searchIndex.length >= 110, `expected >=110 entries, got ${searchIndex.length}`);

  const types = new Set(searchIndex.map((item) => item.type));
  for (const expected of ['课程', '资讯', '实战案例', '开源精选', '视频', '模型']) {
    assert.ok(types.has(expected), `missing type ${expected}`);
  }

  const course = searchIndex.find((item) => item.type === '课程');
  assert.ok(course?.external && course.url?.startsWith('http'));

  const chatgpt = searchIndex.find((item) => item.label === 'ChatGPT' && item.type === '工具');
  assert.equal(chatgpt?.url, 'tools/chatgpt.html');
  assert.equal(
    searchIndex.filter(
      (item) => item.label === 'ChatGPT' && /hub\.html#hub-compare/i.test(String(item.url || '')),
    ).length,
    0,
    'ChatGPT must not map to hub compare anchor',
  );

  const newsChannels = searchIndex.filter(
    (item) => item.type === '频道' && String(item.url || '').includes('news/daily-ai-news.html'),
  );
  assert.equal(newsChannels.length, 1);
  assert.equal(newsChannels[0].label, 'AI 新闻热点');
  assert.equal(searchIndex.filter((item) => item.label === '一周内 AI 热点').length, 0);

  const videoChannel = searchIndex.find(
    (item) => item.type === '频道' && item.url === 'videos.html',
  );
  assert.equal(videoChannel?.label, 'AI 视频');
  assert.doesNotMatch(String(videoChannel?.keywords || ''), /100天|Top4/);

  fs.rmSync(OUT, { recursive: true, force: true });
});
