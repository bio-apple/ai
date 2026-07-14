import { test, expect } from '@playwright/test';

async function gotoHome(page, hash = '') {
  await page.route('**/*fonts.googleapis.com/**', (route) => route.abort());
  await page.route('**/*fonts.gstatic.com/**', (route) => route.abort());
  await page.route('**/googletagmanager.com/**', (route) => route.abort());
  await page.goto(`/index.html${hash}`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#section-home, .section.active').first()).toBeVisible();
}

async function waitSearchReady(page) {
  await expect
    .poll(async () => page.locator('#site-search').getAttribute('data-search-ready'), {
      timeout: 15000,
    })
    .toBe('1');
}

test.describe('Bio AI Lab 关键路径', () => {
  test('首页主路径：推荐 · 简报 · 工具 · 收藏', async ({ page }) => {
    await gotoHome(page);
    await expect(page.locator('h1')).toContainText('AI 工作流');
    await expect(page.locator('#home-recommend')).toBeVisible();
    await expect(page.locator('#home-daily')).toBeVisible();
    await expect(page.locator('#home-daily .daily-cadence').first()).toBeVisible();
    await expect(page.locator('#home-tools .tool-card-v2')).toHaveCount(6);
    await expect(page.locator('#home-favorites')).toBeVisible();
    await expect(page.locator('#knowledge-fab')).toBeVisible();
  });

  test('推荐助手文本流', async ({ page }) => {
    await gotoHome(page, '#home-recommend');
    await expect(page.locator('#recommend-form')).toBeVisible();
    await page.fill('#recommend-input', '我想开发一个网站写代码');
    await page.click('#recommend-form button[type="submit"]');
    const result = page.locator('#recommend-result');
    await expect(result).toBeVisible();
    await expect(result).toContainText(/Cursor|编程|学习/);
    await expect(result.locator('.recommend-next')).toBeVisible();
  });

  test('收藏星标与导出控件', async ({ page }) => {
    await gotoHome(page);
    const star = page.locator('.tool-cards-hot .fav-star').first();
    await expect(star).toBeVisible();
    await star.click();
    await expect(page.locator('#favorites-list .favorite-chip').first()).toBeVisible();
    await expect(page.locator('#favorites-export')).toBeVisible();
  });

  test('hash 路由与简报深链', async ({ page }) => {
    await page.route('**/*fonts.googleapis.com/**', (route) => route.abort());
    await page.route('**/*fonts.gstatic.com/**', (route) => route.abort());
    await page.goto('/index.html#section-cursor', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#section-cursor')).toHaveClass(/active/);
    await page.goto('/index.html#home-daily', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#section-home')).toHaveClass(/active/);
    await expect(page.locator('#home-daily')).toBeVisible();
  });

  test('站内搜索与规则产物', async ({ page }) => {
    await gotoHome(page);
    await expect.poll(async () => (await page.request.get('/search-index.json')).ok()).toBeTruthy();
    const rules = await page.request.get('/recommend-rules.json');
    expect(rules.ok()).toBeTruthy();
    const body = await rules.json();
    expect(body.schema_version).toBe(1);
    expect((body.options || []).length).toBeGreaterThan(0);

    await waitSearchReady(page);
    await page.fill('#site-search', 'Cursor');
    await expect(page.locator('.search-hit').first()).toBeVisible();
  });

  test('搜索空状态引导', async ({ page }) => {
    await gotoHome(page);
    await waitSearchReady(page);
    await page.fill('#site-search', 'zzzz-no-such-tool-xyz');
    await expect(page.locator('.search-empty-actions')).toBeVisible();
  });

  test('工具中心与 Labs', async ({ page }) => {
    await page.route('**/*fonts.googleapis.com/**', (route) => route.abort());
    await page.goto('/tools/hub.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toContainText('工具中心');
    await page.goto('/labs/index.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toContainText('AI Labs');
  });

  test('视频区与新闻区切换', async ({ page }) => {
    await page.route('**/*fonts.googleapis.com/**', (route) => route.abort());
    await page.goto('/index.html#section-videos', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#section-videos')).toHaveClass(/active/);
    await page.locator('.nav-tab[data-tool="news"]').click();
    await expect(page.locator('#section-news')).toHaveClass(/active/);
  });

  test('独立工具页', async ({ page }) => {
    await page.route('**/*fonts.googleapis.com/**', (route) => route.abort());
    await page.goto('/tools/cursor.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toContainText('Cursor');
  });
});
