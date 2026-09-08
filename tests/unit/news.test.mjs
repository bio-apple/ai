/**
 * 新闻页：量子位热门专区独立于 7×24h 主列表。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const newsJs = readFileSync(path.join(ROOT, 'news.js'), 'utf8');
const newsPage = readFileSync(path.join(ROOT, 'src/pages/news/daily-ai-news.astro'), 'utf8');

test('qbitai hot section sits above daily-news-list', () => {
  assert.match(newsPage, /id="qbitai-hot-title"/);
  assert.match(newsPage, /量子位热门文章/);
  const hotIdx = newsPage.indexOf('id="qbitai-hot-list"');
  const dailyIdx = newsPage.indexOf('id="daily-news-list"');
  assert.ok(hotIdx > 0 && dailyIdx > hotIdx);
});

test('7-day filter does not rewrite the qbitai hot list', () => {
  const paintNews = newsJs.slice(
    newsJs.indexOf('function paintNewsList()'),
    newsJs.indexOf('function paintQbitaiHot('),
  );
  assert.match(paintNews, /getElementById\('daily-news-list'\)/);
  assert.match(paintNews, /filterByTimeWindow/);
  assert.doesNotMatch(paintNews, /qbitai-hot-list/);

  const paintHot = newsJs.slice(
    newsJs.indexOf('function paintQbitaiHot('),
    newsJs.indexOf('function fetchNewsData('),
  );
  assert.match(paintHot, /getElementById\('qbitai-hot-list'\)/);
  assert.doesNotMatch(paintHot, /filterByTimeWindow/);
  assert.doesNotMatch(paintHot, /windowHours/);
});
