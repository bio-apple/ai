/**
 * 信息架构：顶栏独立页与页脚入口同序同文案；404 从 nav 派生。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('nav page links match footer links', () => {
  const site = JSON.parse(readFileSync(path.join(ROOT, 'data/site.json'), 'utf8'));
  const pages = site.nav.menu
    .filter((item) => item.type === 'page' && item.href)
    .map((item) => ({ label: item.label, href: item.href }));
  const footer = site.footer.links.map((item) => ({ label: item.label, href: item.href }));
  assert.deepEqual(pages, footer);
});

test('404 shortcuts are derived from nav page links', () => {
  const page = readFileSync(path.join(ROOT, 'src/pages/404.astro'), 'utf8');
  assert.match(page, /site\.nav\.menu/);
  assert.match(page, /item\.type === 'page'/);
  assert.doesNotMatch(page, /asset\('news\/daily-ai-news\.html'\)/);
});
