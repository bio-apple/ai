import { test, expect } from '@playwright/test';

test.describe('Bio AI Lab 关键路径', () => {
  test('首页主路径：推荐 · 简报 · 工具 · 收藏', async ({ page }) => {
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toContainText('AI 工作流');
    await expect(page.locator('#home-recommend')).toBeVisible();
    await expect(page.locator('#home-daily')).toBeVisible();
    await expect(page.locator('#home-daily .daily-cadence').first()).toBeVisible();
    await expect(page.locator('#home-tools .tool-card-v2')).toHaveCount(6, { timeout: 10000 });
    await expect(page.locator('#home-favorites')).toBeVisible();
    await expect(page.locator('#knowledge-fab')).toBeVisible();
  });

  test('推荐助手文本流', async ({ page }) => {
    await page.goto('/index.html#home-recommend', { waitUntil: 'domcontentloaded' });
    await page.fill('#recommend-input', '我想开发一个网站写代码');
    await page.click('#recommend-form button[type="submit"]');
    await expect(page.locator('#recommend-result')).toBeVisible();
    await expect(page.locator('#recommend-result')).toContainText('Cursor');
    await expect(page.locator('#recommend-result .recommend-next')).toBeVisible();
  });

  test('收藏星标与导出控件', async ({ page }) => {
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
    const star = page.locator('.tool-cards-hot .fav-star').first();
    await expect(star).toBeVisible();
    await star.click();
    await expect(page.locator('#favorites-list .favorite-chip').first()).toBeVisible();
    await expect(page.locator('#favorites-export')).toBeVisible();
  });

  test('hash 路由与简报深链', async ({ page }) => {
    await page.goto('/index.html#section-cursor');
    await expect(page.locator('#section-cursor')).toHaveClass(/active/);
    await page.goto('/index.html#home-daily');
    await expect(page.locator('#section-home')).toHaveClass(/active/);
    await expect(page.locator('#home-daily')).toBeVisible();
  });

  test('站内搜索与规则产物', async ({ page }) => {
    await page.goto('/index.html');
    const idx = await page.request.get('/search-index.json');
    expect(idx.ok()).toBeTruthy();
    const rules = await page.request.get('/recommend-rules.json');
    expect(rules.ok()).toBeTruthy();
    const body = await rules.json();
    expect(body.schema_version).toBe(1);
    expect((body.options || []).length).toBeGreaterThan(0);
    await page.fill('#site-search', 'Cursor');
    await expect(page.locator('.search-hit').first()).toBeVisible();
  });

  test('工具中心与 Labs', async ({ page }) => {
    await page.goto('/tools/hub.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toContainText('工具中心');
    await page.goto('/labs/index.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toContainText('AI Labs');
  });

  test('视频区与新闻区', async ({ page }) => {
    await page.goto('/index.html#section-videos');
    await expect(page.locator('#section-videos')).toHaveClass(/active/);
    await page.click('[data-tool="news"]');
    await expect(page.locator('#section-news')).toHaveClass(/active/);
  });

  test('独立工具页', async ({ page }) => {
    await page.goto('/tools/cursor.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toContainText('Cursor');
  });
});
