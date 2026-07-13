import { test, expect } from '@playwright/test';

test.describe('Bio AI Lab 冒烟测试', () => {
  test('首页四块：工具 · 开源 · 新闻 · 视频', async ({ page }) => {
    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toContainText('掌握 AI');
    await expect(page.locator('#section-home .tool-cards-hot .tool-card-v2')).toHaveCount(6, { timeout: 10000 });
    await expect(page.locator('#home-categories .tool-card-v2').first()).toBeVisible();
    await expect(page.locator('#home-compare .compare-table tbody tr')).toHaveCount(6);
    await expect(page.locator('#home-news .news-card').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#home-oss .oss-card').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#home-video-preview .video-card').first()).toBeVisible({ timeout: 5000 });
  });

  test('hash 路由跳转 Cursor 教程', async ({ page }) => {
    await page.goto('/index.html#section-cursor');
    await expect(page.locator('#section-cursor')).toHaveClass(/active/);
    await expect(page.locator('#section-cursor h2')).toContainText('Cursor');
  });

  test('站内搜索索引', async ({ page }) => {
    await page.goto('/index.html');
    const res = await page.request.get('/search-index.json');
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(data.length).toBeGreaterThan(10);
    await page.fill('#site-search', 'Cursor');
    await expect(page.locator('.search-hit').first()).toBeVisible();
    await page.fill('#site-search', '开源');
    await expect(page.locator('.search-hit').first()).toBeVisible();
  });

  test('P0 UX：主题切换与返回顶部', async ({ page }) => {
    await page.goto('/index.html');
    await expect(page.locator('.theme-toggle')).toBeVisible();
    await page.locator('.theme-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.evaluate(() => window.scrollTo(0, 1200));
    await expect(page.locator('.back-to-top')).toHaveClass(/visible/);
    await expect(page.locator('.reading-progress-bar')).toBeVisible();
  });

  test('左侧 TOC 桌面导航', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/index.html');
    await expect(page.locator('#page-toc')).toBeVisible();
    await page.locator('#page-toc .page-toc-link[data-section="section-chatgpt"]').click();
    await expect(page.locator('#section-chatgpt')).toHaveClass(/active/);
  });

  test('视频区与 JSON 数据', async ({ page }) => {
    await page.goto('/index.html#section-videos');
    const res = await page.request.get('/daily-videos.json');
    expect(res.ok()).toBeTruthy();
    await page.click('[data-tool="videos"]');
    await expect(page.locator('#daily-video-list .video-card, #daily-video-list .loading-hint').first()).toBeVisible();
  });

  test('AI 新闻数据与区块', async ({ page }) => {
    const res = await page.request.get('/ai-news.json');
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect((data.items || []).length).toBeGreaterThan(0);
    await page.goto('/index.html#section-news');
    await expect(page.locator('#section-news')).toHaveClass(/active/);
    await expect(page.locator('#daily-news-list .news-card').first()).toBeVisible({ timeout: 10000 });
  });

  test('独立工具页可访问', async ({ page }) => {
    await page.goto('/tools/cursor.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toContainText('Cursor');
    await expect(page.locator('.logo-brand')).toContainText('Bio AI Lab');
  });

  test('排行榜 SEO 页', async ({ page }) => {
    await page.goto('/ai-tools-ranking.html');
    await expect(page.locator('h1')).toContainText('排行榜');
  });

  test('新闻独立页', async ({ page }) => {
    await page.goto('/news/daily-ai-news.html');
    await expect(page.locator('h1')).toContainText('热点');
    await expect(page.locator('#daily-news-list .news-card').first()).toBeVisible({ timeout: 10000 });
  });

  test('视频筛选工具栏', async ({ page }) => {
    await page.goto('/index.html#section-videos');
    await expect(page.locator('#video-toolbar')).toBeVisible();
    await page.click('[data-video-sort="recent"]');
    await expect(page.locator('#daily-video-list .video-card, #daily-video-list .loading-hint').first()).toBeVisible();
  });

  test('开源精选与工具对比表', async ({ page }) => {
    const res = await page.request.get('/oss-projects.json');
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect((data.domains || []).length).toBeGreaterThanOrEqual(6);

    await page.goto('/index.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#home-compare')).toBeVisible();
    await expect(page.locator('#home-oss')).toBeVisible();

    await page.click('[data-tool="oss"]');
    await expect(page.locator('#section-oss')).toHaveClass(/active/);
    await expect(page.locator('#oss-project-list .oss-card').first()).toBeVisible({ timeout: 15000 });

    await page.click('[data-tool="news"]');
    await expect(page.locator('#section-news')).toHaveClass(/active/);
    await expect(page.locator('#daily-news-list .news-card').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#news-watch-sources .news-watch-panel')).toBeVisible({ timeout: 15000 });
  });

  test('analytics 配置可访问', async ({ page }) => {
    const cfg = await page.request.get('/analytics-config.json');
    expect(cfg.ok()).toBeTruthy();
    const analytics = await cfg.json();
    expect(analytics).toHaveProperty('track_engagement');
    await page.goto('/index.html');
    await expect(page.locator('#knowledge-fab')).toHaveCount(0);
  });
});
