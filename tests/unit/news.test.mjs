/**
 * 新闻页：量子位官网热门并入既有分类，不单独成块。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const newsJs = readFileSync(path.join(ROOT, 'news.js'), 'utf8');
const newsPage = readFileSync(path.join(ROOT, 'src/pages/news/daily-ai-news.astro'), 'utf8');

test('news page has no standalone qbitai hot section', () => {
  assert.doesNotMatch(newsPage, /量子位热门文章/);
  assert.doesNotMatch(newsPage, /qbitai-hot-list/);
  assert.match(newsPage, /id="daily-news-list"/);
  assert.match(newsPage, /hotPayload\.items/);
});

test('week filter keeps qbitai hot items via per-item window_hours', () => {
  const document = {
    readyState: 'loading',
    addEventListener() {},
    getElementById() {
      return null;
    },
  };
  const sandbox = {
    window: { BioAI: {}, document },
    document,
    Date,
    Number,
    String,
    Array,
    Map,
    Set,
    Math,
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(
    `${newsJs}\nthis.mergeNewsPayload = mergeNewsPayload;\nthis.filterByTimeWindow = filterByTimeWindow;\nthis.newsState = newsState;`,
    sandbox,
  );
  const merged = sandbox.mergeNewsPayload({
    window_hours: 168,
    items: [
      {
        title: 'RSS 量子位',
        url: 'https://www.qbitai.com/2026/09/rss.html',
        source: '量子位',
        category: '中文资讯',
        published_at: '2026-09-08T10:00:00+08:00',
      },
    ],
    qbitai_hot: {
      window_days: 30,
      items: [
        {
          title: '阿里更新旗舰模型Qwen3.8-Max，前端编程能力跃居全球第一',
          url: 'https://www.qbitai.com/2026/09/483101.html',
          source: '量子位',
          category: '新模型发布',
          published_at: '2026-08-20T00:00:00+08:00',
        },
      ],
    },
  });
  assert.equal(merged.length, 2);
  const hot = merged.find((i) => i.url.includes('483101'));
  assert.equal(hot.category, '新模型发布');
  assert.equal(hot.window_hours, 720);
  sandbox.newsState.windowHours = 168;
  const week = sandbox.filterByTimeWindow(merged, 'week');
  assert.ok(week.some((i) => i.url.includes('483101')));
  assert.ok(week.some((i) => i.url.includes('rss.html')));
});
