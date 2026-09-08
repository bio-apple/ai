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
      const el = document.querySelector('.site-search-input');
      return el && el.dataset.searchStatus && el.dataset.searchStatus !== 'loading';
    },
    null,
    { timeout: 15000 },
  );
  const input = page.locator('.site-search-input').first();
  const ready = await input.getAttribute('data-search-ready');
  const status = await input.getAttribute('data-search-status');
  if (ready !== '1') {
    throw new Error(`搜索索引未就绪: ready=${ready} status=${status}`);
  }
}

async function waitHomeOps(page) {
  await expect(page.locator('#home-ops')).toBeVisible();
  await expect
    .poll(async () => (await page.locator('#ops-views').textContent())?.trim() !== '—', {
      timeout: 15000,
    })
    .toBeTruthy();
}

test.describe('AI 导航 关键路径', () => {
  test('首页主路径：推荐 · 简报 · 独立专区入口', async ({ page }) => {
    await gotoHome(page);
    await expect(page.locator('h1')).toContainText('先说要做什么');
    await expect(page.locator('#home-ai-map')).toBeVisible();
    await expect(page.locator('#home-ai-map .ai-map')).toBeVisible();
    await expect(page.locator('#home-ai-map a.ai-map-node[data-map-node="dl"]')).toBeVisible();
    await expect(page.locator('#home-ai-map .ai-map-legend')).toBeVisible();
    await expect(page.locator('#home-ai-map a.ai-map-btn[data-map-node="dl"]')).toBeVisible();
    await expect(page.locator('.skip-link')).toHaveAttribute('href', '#main-content');
    await expect(page.locator('main#main-content')).toHaveCount(1);
    await expect(page.locator('.hero-brand')).toContainText('AI 导航');
    await expect(page.locator('.hero-ledger-date')).toContainText('更新于');
    await expect(page.locator('.home-quick-filters')).toHaveCount(0);
    await expect(page.locator('#home-recommend')).toBeVisible();
    await expect(page.locator('#home-daily')).toBeVisible();
    await expect(page.locator('#home-ops')).toBeVisible();
    await expect(page.locator('#home-ops .section-title')).toContainText('热门排行榜');
    await expect(page.locator('#home-ops-wrap')).toHaveCount(0);
    await expect(page.locator('#daily-github-list a').first()).toBeVisible();
    await expect(page.locator('#home-daily .news-source-chip').first()).toBeVisible();
    await expect(page.locator('#home-daily .news-source-logo').first()).toHaveAttribute(
      'src',
      /source-logos\/.+\.svg/,
    );
    await expect(page.locator('#home-daily .daily-item-date').first()).toBeVisible();
    await expect(page.locator('#daily-github-list')).not.toContainText('暂无 GitHub 动态');
    await expect(page.locator('#home-video-picks')).toBeVisible();
    await expect(page.locator('.daily-panel--videos .daily-panel-title')).toContainText(
      '近一个月高播放精选',
    );
    const homeTeasers = page.locator('#home-video-picks .home-video-teaser');
    await expect(homeTeasers.first()).toBeVisible();
    expect(await homeTeasers.count()).toBeLessThanOrEqual(3);
    await expect(page.locator('.daily-panel--videos .daily-more')).toHaveAttribute(
      'href',
      /videos\.html$/,
    );
    await expect(page.locator('.daily-panel--videos .daily-more')).toContainText('查看全部');
    await expect(page.locator('#section-oss')).toHaveCount(0);
    await expect(page.locator('#section-courses')).toHaveCount(0);
    await expect(page.locator('.nav-link-page', { hasText: '开源精选' })).toHaveAttribute(
      'href',
      /oss\.html$/,
    );
    await expect(page.locator('.nav-link-page', { hasText: '课程资源' })).toHaveAttribute(
      'href',
      /courses\.html$/,
    );
    await expect(page.locator('.nav-link-page', { hasText: '新闻热点' })).toHaveAttribute(
      'href',
      /news\/daily-ai-news\.html$/,
    );
    await expect(page.locator('.nav-link-page', { hasText: 'AI 视频' })).toHaveAttribute(
      'href',
      /videos\.html$/,
    );
    await expect(page.locator('#home-community a[href$="oss.html"]')).toBeVisible();
    await expect(page.locator('#home-community a[href$="tools/shelf.html"]')).toBeVisible();
    await expect(page.locator('#home-faq')).toBeVisible();
    await expect(page.locator('#faq-cursor-vs-copilot')).toBeVisible();
    await expect(page.locator('#knowledge-fab')).toHaveCount(0);
    await expect(page.locator('#knowledge-panel')).toHaveCount(1);
    await expect(page.locator('#knowledge-panel')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /AI 导航/);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      'content',
      /^https:\/\//,
    );
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
      'href',
      /manifest\.webmanifest/,
    );
  });

  test('FAQ 展开后可跳到对比页', async ({ page }) => {
    await gotoHome(page, '#faq-cursor-vs-copilot');
    const item = page.locator('#faq-cursor-vs-copilot');
    await expect(item).toHaveJSProperty('open', true);
    await expect(item.locator('.home-faq-link')).toHaveAttribute(
      'href',
      /compare\/cursor-vs-copilot\.html$/,
    );
    await item.locator('.home-faq-link').click();
    await expect(page).toHaveURL(/compare\/cursor-vs-copilot\.html/);
    await expect(page.locator('h1')).toBeVisible();
  });

  test('知识版图点击跳到对应课程列表', async ({ page }) => {
    await gotoHome(page);
    await expect(page.locator('#home-ai-map a.ai-map-node[data-map-node="nlp"]')).toHaveAttribute(
      'href',
      /courses\.html#llm$/,
    );
    await expect(page.locator('#home-ai-map a.ai-map-btn[data-map-node="nlp"]')).toHaveAttribute(
      'href',
      /courses\.html#llm$/,
    );
    await page.locator('#home-ai-map a.ai-map-btn[data-map-node="dl"]').hover();
    await expect(page.locator('#home-ai-map .ai-map-hint-item[data-map-hint="dl"]')).toBeVisible();
    await page.locator('#home-ai-map a.ai-map-btn[data-map-node="dl"]').click();
    await expect(page).toHaveURL(/courses\.html#dl/);
    await expect(page.locator('#courses-list .course-card').first()).toBeVisible();
    await expect.poll(async () => page.locator('#courses-list .course-card').count()).toBe(2);
    await expect(page.locator('#courses-toolbar [data-course-track="深度学习"]')).toHaveClass(
      /active/,
    );
  });

  test('热门排行榜默认可见并加载数据', async ({ page }) => {
    await gotoHome(page);
    await waitHomeOps(page);
    await expect(page.locator('#ops-views')).not.toHaveText('—');
    await expect(
      page.locator('#ops-trend-list .ops-trend-item, #ops-trend-list li').first(),
    ).toBeVisible();
  });

  test('推荐助手文本流', async ({ page }) => {
    await gotoHome(page, '#home-recommend');
    await expect
      .poll(async () => page.locator('#recommend-form').isVisible(), { timeout: 15000 })
      .toBeTruthy();
    await page.fill('#recommend-input', '我想开发一个网站写代码');
    await page.click('#recommend-form button[type="submit"]');
    const result = page.locator('#recommend-result');
    await expect(result).toBeVisible();
    await expect(result).toContainText(/Cursor|Copilot|Codex/);
    await expect(result.locator('.recommend-next a[data-track="recommend_goto_learning"]')).toHaveCount(
      0,
    );
    await expect(
      result.locator('.recommend-next a[data-track="recommend_guide_query"]'),
    ).toHaveAttribute('href', /guides\/advanced\.html$/);
  });

  test('旧 hash 专区重定向到独立页', async ({ page }) => {
    await page.route('**/*fonts.googleapis.com/**', (route) => route.abort());
    await page.goto('index.html#section-videos', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/videos\.html/);
    await expect(page.locator('#daily-video-stream [data-ssr-videos]')).toBeVisible();
    await expect(page.locator('#video-preview-form')).toBeVisible();
  });

  test('专区独立页 SSG + 面包屑', async ({ page }) => {
    await page.route('**/*fonts.googleapis.com/**', (route) => route.abort());
    await page.goto('oss.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.breadcrumb')).toContainText('开源精选');
    await expect(page.locator('#oss-toolbar .oss-filter').first()).toBeVisible();
    await expect(page.locator('#oss-list .oss-card-item').first()).toBeVisible();
    await expect
      .poll(async () => page.locator('#oss-list .oss-card-item').count())
      .toBeGreaterThanOrEqual(6);
    await expect(page.locator('#oss-list .oss-cat-block-title').first()).toBeVisible();
    await expect(page.locator('#oss-list .oss-card-stars').first()).toBeVisible();
    await expect(page.locator('#oss-list .oss-audience').first()).toBeVisible();
    await expect(page.locator('#oss-list .oss-card-heat').first()).toBeVisible();
    const mcpFilter = page.locator('#oss-toolbar .oss-filter[data-oss-category="mcp"]');
    if (await mcpFilter.count()) {
      await mcpFilter.click();
      await expect(page).toHaveURL(/oss\.html#mcp/);
      await expect(page.locator('#oss-list .oss-card-item').first()).toBeVisible();
      await expect(page.locator('#oss-list [data-oss-cat="mcp"]').first()).toBeVisible();
    }

    await page.goto('courses.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.breadcrumb')).toContainText('课程资源');
    await expect(page.locator('#courses-list .course-card').first()).toBeVisible();

    await page.goto('videos.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.breadcrumb')).toContainText('AI 视频');
    await expect(page.locator('h1')).toContainText('AI 视频');
    await expect(page.locator('.standalone-lead')).toContainText('近 1 个月');
    const videoCards = page.locator('#daily-video-stream .video-card');
    await expect(videoCards.first()).toBeVisible();
    expect(await videoCards.count()).toBeLessThanOrEqual(6);
    expect(
      await page.locator('[data-video-grid="youtube"] .video-card').count(),
    ).toBeLessThanOrEqual(3);
    expect(
      await page.locator('[data-video-grid="bilibili"] .video-card').count(),
    ).toBeLessThanOrEqual(3);
    await expect(page.locator('#video-preview-form')).toBeVisible();
    await expect(page.locator('#daily-video-list')).not.toContainText('加载本机预览');
    await expect(
      page
        .locator('#daily-video-list .video-card, #daily-video-list [data-video-fallback]')
        .first(),
    ).toBeVisible();

    await page.goto('news/daily-ai-news.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.breadcrumb')).toContainText('新闻热点');
    await expect(page.locator('#daily-news-list .news-row').first()).toBeVisible();
  });

  test('独立页面包屑', async ({ page }) => {
    await page.route('**/*fonts.googleapis.com/**', (route) => route.abort());
    await page.goto('tools/hub.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toHaveCount(1);
    const hubCrumb = page.locator('.breadcrumb');
    await expect(hubCrumb).toContainText('首页');
    await expect(hubCrumb).toContainText('工具中心');

    await page.goto('tools/chatgpt.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.breadcrumb')).toContainText('ChatGPT');
  });

  test('站内搜索与规则产物', async ({ page }) => {
    await gotoHome(page);
    await expect.poll(async () => (await page.request.get('search-index.json')).ok()).toBeTruthy();
    await page.locator('#nav-site-search').focus();
    await waitSearchReady(page);
    await page.locator('#nav-site-search').fill('ChatGPT');
    const navResults = page.locator('#nav-site-search-results');
    await expect(navResults.locator('a.search-hit').first()).toHaveAttribute(
      'href',
      /tools\/chatgpt\.html/,
    );
    await page.locator('#nav-site-search').press('Enter');
    await expect(page).toHaveURL(/tools\/chatgpt\.html/);
  });

  test('Cmd/Ctrl+K 打开顶栏搜索并可问知识库', async ({ page }) => {
    await gotoHome(page);
    await page.keyboard.press('Control+k');
    await expect(page.locator('#nav-site-search')).toBeFocused();
    await waitSearchReady(page);
    await page.locator('#nav-site-search').fill('Cursor 怎么写代码');
    await page.locator('#nav-site-search-results [data-action="ask-knowledge"]').click();
    await expect(page.locator('#knowledge-panel')).toHaveAttribute('aria-hidden', 'false');
    await expect(page.locator('#knowledge-messages .knowledge-msg.user')).toContainText(
      'Cursor 怎么写代码',
    );
  });

  test('顶栏工具中心', async ({ page }) => {
    await page.route('**/*fonts.googleapis.com/**', (route) => route.abort());
    await page.goto('index.html', { waitUntil: 'domcontentloaded' });
    await page.locator('.nav-link-page', { hasText: 'AI工具中心' }).click();
    await expect(page.locator('#hub-ranking')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'AI 工具中心' })).toBeVisible();
    await expect(page.locator('.nav-tabs')).not.toHaveAttribute('role', 'tablist');
    await expect(page.locator('#hub-ranking-updated')).toBeVisible();
    await expect(page.locator('#hub-ranking-updated')).toContainText('数据更新于');
    await expect(page.getByText('数据更新于')).toHaveCount(1);
    await expect(page.locator('#hub-panel-aicpb .aicpb-table-row')).toHaveCount(10);
    await expect(page.locator('#hub-panel-aicpb .aicpb-product-reason').first()).toBeVisible();
  });

  test('独立工具页与对比页', async ({ page }) => {
    await page.route('**/*fonts.googleapis.com/**', (route) => route.abort());
    await page.goto('tools/cursor.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toContainText('Cursor 使用指南');
    await expect(page).toHaveTitle(/Cursor 使用指南 \| AI 导航/);
    const fav = page.locator('[data-favorite-toggle]');
    await expect(fav).toBeVisible();
    await fav.click();
    await expect(fav).toHaveAttribute('aria-pressed', 'true');
    await page.goto('tools/shelf.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.breadcrumb')).toContainText('我的收藏');
    await expect(page.locator('#tool-shelf-favs-list')).toContainText('Cursor');
    await expect(page.locator('#tool-shelf-hist-list')).toContainText('Cursor');
    await page.goto('compare/cursor-vs-copilot.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toContainText(/Cursor|Copilot/i);
    await expect(page.locator('#compare-matrix-title')).toBeVisible();
    await expect(page.locator('.compare-matrix [data-level]').first()).toBeVisible();
    await expect(page.locator('#compare-reviews-title')).toBeVisible();
    await expect(page.locator('.compare-review-verdict').first()).toBeVisible();
  });

  test('404 页：单一 main、noindex', async ({ page }) => {
    await page.route('**/*fonts.googleapis.com/**', (route) => route.abort());
    await page.goto('404.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('main#main-content')).toHaveCount(1);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/i);
    await expect(
      page.locator('main#main-content').getByRole('link', { name: 'AI 视频' }),
    ).toBeVisible();
  });
});
