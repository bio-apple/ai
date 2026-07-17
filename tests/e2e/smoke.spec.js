import { test, expect } from '@playwright/test';

/** 相对 baseURL(/ai/)，不要用以 / 开头的绝对 path，否则会丢掉 /ai 前缀 */
async function gotoHome(page, hash = '') {
  await page.route('**/*fonts.googleapis.com/**', (route) => route.abort());
  await page.route('**/*fonts.gstatic.com/**', (route) => route.abort());
  await page.route('**/googletagmanager.com/**', (route) => route.abort());
  await page.goto(`index.html${hash}`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#section-home, .section.active').first()).toBeVisible();
}

async function waitSearchReady(page) {
  await page.waitForFunction(
    () => {
      const el = document.getElementById('site-search');
      return el && el.dataset.searchStatus && el.dataset.searchStatus !== 'loading';
    },
    null,
    { timeout: 15000 },
  );
  const ready = await page.locator('#site-search').getAttribute('data-search-ready');
  const status = await page.locator('#site-search').getAttribute('data-search-status');
  if (ready !== '1') {
    throw new Error(`搜索索引未就绪: ready=${ready} status=${status}`);
  }
}

test.describe('Bio AI Lab 关键路径', () => {
  test('首页主路径：推荐 · 简报 · 开源（无热门/更多工具）', async ({ page }) => {
    await gotoHome(page);
    await expect(page.locator('h1')).toContainText('AI 工作流');
    await expect(page.locator('.skip-link')).toHaveAttribute('href', '#main-content');
    await expect(page.locator('#main-content')).toBeVisible();
    await expect(page.locator('#home-recommend')).toBeVisible();
    await expect(page.locator('#home-daily')).toBeVisible();
    await expect(page.locator('#home-daily .daily-cadence').first()).toBeVisible();
    await expect(page.locator('#home-ops')).toBeVisible();
    await expect(page.locator('#ops-views')).not.toHaveText('—');
    await expect(page.locator('#ops-trend-list .ops-trend-item').first()).toContainText('今日点击');
    await expect(page.locator('#home-tools')).toHaveCount(0);
    await expect(page.locator('#home-categories')).toHaveCount(0);
    await expect(page.locator('#home-oss')).toBeVisible();
    await expect(page.locator('#home-favorites')).toHaveCount(0);
    await expect(page.locator('#home-learning')).toHaveCount(0);
    await expect(page.locator('#knowledge-fab')).toBeVisible();
    await expect(page.locator('a.logo')).toHaveAttribute('aria-label', '返回首页');
    await expect(page.locator('a.logo')).toHaveAttribute('href', /index\.html$/);
  });

  test('推荐助手文本流', async ({ page }) => {
    await gotoHome(page, '#home-recommend');
    await expect(page.locator('#recommend-form')).toBeVisible();
    await expect(page.locator('#recommend-chips')).toBeVisible();
    await page.fill('#recommend-input', '我想开发一个网站写代码');
    await page.click('#recommend-form button[type="submit"]');
    const result = page.locator('#recommend-result');
    await expect(result).toBeVisible();
    await expect(result).toContainText(/Cursor|Copilot|Codex/);
    await expect(result.locator('.recommend-path-steps')).toBeVisible();
    await expect(result.locator('.recommend-next')).toBeVisible();
    await expect(
      result.locator('.recommend-next a[data-track="recommend_goto_learning"]'),
    ).toHaveAttribute('href', /ai-learning-roadmap\.html$/);
    await page.fill('#recommend-input', '');
    await expect(result).toBeHidden();
  });

  test('hash 路由与简报深链', async ({ page }) => {
    await page.route('**/*fonts.googleapis.com/**', (route) => route.abort());
    await page.route('**/*fonts.gstatic.com/**', (route) => route.abort());
    await page.goto('index.html#section-videos', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#section-videos')).toHaveClass(/active/);
    await page.goto('index.html#home-daily', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#section-home')).toHaveClass(/active/);
    await expect(page.locator('#home-daily')).toBeVisible();
  });

  test('站内搜索与规则产物', async ({ page }) => {
    await gotoHome(page);
    await expect.poll(async () => (await page.request.get('search-index.json')).ok()).toBeTruthy();
    const rules = await page.request.get('recommend-rules.json');
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

  test('顶栏工具中心', async ({ page }) => {
    await page.route('**/*fonts.googleapis.com/**', (route) => route.abort());
    await page.goto('index.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.nav-dropdown-trigger', { hasText: '工具' })).toHaveCount(0);
    await expect(page.locator('.nav-link-page', { hasText: 'AI工具中心' })).toBeVisible();
    await expect(page.locator('.nav-link-page', { hasText: '实战案例' })).toHaveCount(0);
    await page.locator('.nav-link-page', { hasText: 'AI工具中心' }).click();
    await expect(page.locator('h1')).toContainText('工具中心');
  });

  test('课程资源频道', async ({ page }) => {
    await page.route('**/*fonts.googleapis.com/**', (route) => route.abort());
    await page.goto('index.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.nav-tab', { hasText: '课程资源' })).toBeVisible();
    await page.locator('.nav-tab', { hasText: '课程资源' }).click();
    await expect(page.locator('#section-courses')).toHaveClass(/active/);
    await expect
      .poll(
        async () => {
          const text = (await page.locator('#courses-list').innerText()).trim();
          if (/加载课程资源/.test(text)) return false;
          return text.length > 0;
        },
        { timeout: 20000 },
      )
      .toBeTruthy();
    await expect(page.locator('#courses-list .course-card').first()).toBeVisible();
  });

  test('新闻归档页加载', async ({ page }) => {
    await page.route('**/*fonts.googleapis.com/**', (route) => route.abort());
    await page.goto('news/daily-ai-news.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toContainText('热点');
    await expect
      .poll(
        async () => {
          const text = (await page.locator('#daily-news-list').innerText()).trim();
          if (/加载 AI 新闻/.test(text)) return false;
          return text.length > 0;
        },
        { timeout: 20000 },
      )
      .toBeTruthy();
  });

  test('视频区加载态解除与新闻区切换', async ({ page }) => {
    await page.route('**/*fonts.googleapis.com/**', (route) => route.abort());
    await page.goto('index.html#section-videos', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#section-videos')).toHaveClass(/active/);
    await expect
      .poll(
        async () => {
          const list = page.locator('#daily-video-list');
          const text = (await list.innerText()).trim();
          if (/加载视频推荐/.test(text)) return false;
          return text.length > 0;
        },
        { timeout: 20000 },
      )
      .toBeTruthy();
    const meta = page.locator('#video-update-meta');
    // 成功加载时有「最近更新」；失败时空 meta 也可接受（至少列表已离开纯 loading）
    const metaText = await meta.innerText().catch(() => '');
    if (metaText) {
      expect(metaText).toMatch(/最近更新|回退/);
    }

    await page.locator('.nav-tab[data-tool="news"]').click();
    await expect(page.locator('#section-news')).toHaveClass(/active/);
    await expect
      .poll(
        async () => {
          const text = (await page.locator('#daily-news-list').innerText()).trim();
          if (/加载 AI 新闻/.test(text)) return false;
          return text.length > 0;
        },
        { timeout: 20000 },
      )
      .toBeTruthy();
  });

  test('独立工具页', async ({ page }) => {
    await page.route('**/*fonts.googleapis.com/**', (route) => route.abort());
    await page.goto('tools/cursor.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toContainText('Cursor');
  });

  test('对比专题页', async ({ page }) => {
    await page.route('**/*fonts.googleapis.com/**', (route) => route.abort());
    await page.goto('compare/cursor-vs-copilot.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1, .compare-hero h1, main h1').first()).toBeVisible();
    await expect(page.locator('body')).toContainText(/Cursor|Copilot/i);
  });

  test('视频回退标注可出现或正常加载', async ({ page }) => {
    await page.route('**/*fonts.googleapis.com/**', (route) => route.abort());
    await page.goto('index.html#section-videos', { waitUntil: 'domcontentloaded' });
    await expect
      .poll(
        async () => {
          const text = (await page.locator('#daily-video-list').innerText()).trim();
          return text.length > 0 && !/加载视频推荐/.test(text);
        },
        { timeout: 20000 },
      )
      .toBeTruthy();
    const meta = await page.locator('#video-update-meta').innerText();
    expect(meta).toMatch(/最近更新|暂无|回退/);
  });
});
