import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8766';

test.describe('Bio AI Lab 冒烟测试', () => {
  test('首页加载与 Hero', async ({ page }) => {
    await page.goto(`${BASE}/index.html`);
    await expect(page.locator('h1')).toContainText('掌握 AI');
    await expect(page.locator('.tool-card-v2')).toHaveCount(20, { timeout: 10000 });
    await expect(page.locator('.ai-picker-option')).toHaveCount(5);
    await expect(page.locator('#home-news')).toBeVisible();
  });

  test('hash 路由跳转 Cursor 教程', async ({ page }) => {
    await page.goto(`${BASE}/index.html#section-cursor`);
    await expect(page.locator('#section-cursor')).toHaveClass(/active/);
    await expect(page.locator('#section-cursor h2')).toContainText('Cursor');
  });

  test('站内搜索索引', async ({ page }) => {
    await page.goto(`${BASE}/index.html`);
    const res = await page.request.get(`${BASE}/search-index.json`);
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.length).toBeGreaterThan(10);
    await page.fill('#site-search', 'Cursor');
    await expect(page.locator('.search-hit').first()).toBeVisible();
  });

  test('视频区与 JSON 数据', async ({ page }) => {
    await page.goto(`${BASE}/index.html#section-videos`);
    const res = await page.request.get(`${BASE}/daily-videos.json`);
    expect(res.ok()).toBeTruthy();
    await page.click('[data-tool="videos"]');
    await expect(page.locator('#daily-video-list .video-card, #daily-video-list .loading-hint').first()).toBeVisible();
  });

  test('AI 新闻数据与区块', async ({ page }) => {
    const res = await page.request.get(`${BASE}/ai-news.json`);
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect((data.items || []).length).toBeGreaterThan(0);
    await page.goto(`${BASE}/index.html#section-news`);
    await expect(page.locator('#section-news')).toHaveClass(/active/);
    await expect(page.locator('#daily-news-list .news-card').first()).toBeVisible({ timeout: 10000 });
  });

  test('提示词复制按钮存在', async ({ page }) => {
    await page.goto(`${BASE}/index.html#section-cases`);
    await page.locator('.case-header').first().click();
    await expect(page.locator('.prompt-block').first()).toBeVisible();
  });

  test('独立工具页可访问', async ({ page }) => {
    await page.goto(`${BASE}/tools/cursor.html`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toContainText('Cursor');
    await expect(page.locator('.logo-brand')).toContainText('Bio AI Lab');
  });

  test('排行榜与学习路线 SEO 页', async ({ page }) => {
    await page.goto(`${BASE}/ai-tools-ranking.html`);
    await expect(page.locator('h1')).toContainText('排行榜');
    await page.goto(`${BASE}/ai-learning-roadmap.html`);
    await expect(page.locator('h1')).toContainText('学习路线');
  });

  test('指南与新闻独立页', async ({ page }) => {
    await page.goto(`${BASE}/guides/beginner.html`);
    await expect(page.locator('h1')).toContainText('入门');
    await page.goto(`${BASE}/news/daily-ai-news.html`);
    await expect(page.locator('h1')).toContainText('热点');
    await expect(page.locator('#daily-news-list .news-card').first()).toBeVisible({ timeout: 10000 });
  });

  test('AI 选择助手交互', async ({ page }) => {
    await page.goto(`${BASE}/index.html`);
    await page.click('.ai-picker-option[data-picker="coding"]');
    await expect(page.locator('.ai-picker-tool-group[data-picker-result="coding"]')).toHaveClass(/active/);
    await expect(page.locator('.ai-picker-tool-group[data-picker-result="coding"] .ai-picker-tool')).toHaveCount(3);
  });
});
