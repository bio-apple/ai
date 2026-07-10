import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8766';

test.describe('AI 应用指南冒烟测试', () => {
  test('首页加载与快速入口', async ({ page }) => {
    await page.goto(`${BASE}/index.html`);
    await expect(page.locator('h1')).toContainText('学会使用 AI');
    await expect(page.locator('.quick-find-card')).toHaveCount(4);
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

  test('提示词复制按钮存在', async ({ page }) => {
    await page.goto(`${BASE}/index.html#section-cases`);
    await page.locator('.case-header').first().click();
    await expect(page.locator('.prompt-block').first()).toBeVisible();
  });

  test('独立工具页可访问', async ({ page }) => {
    await page.goto(`${BASE}/tools/cursor.html`);
    await expect(page.locator('h1')).toContainText('Cursor');
  });
});
