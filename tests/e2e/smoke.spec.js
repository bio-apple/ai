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

test.describe('Bio AI Lab 关键路径', () => {
  test('首页主路径：推荐 · 简报 · 本地部署入口（无热门/更多工具）', async ({ page }) => {
    await gotoHome(page);
    await expect(page.locator('h1')).toContainText('AI 工作流');
    await expect(page.locator('#home-ai-map')).toBeVisible();
    await expect(page.locator('#home-ai-map .ai-map')).toBeVisible();
    await expect(page.locator('#home-ai-map .ai-map')).toHaveAttribute(
      'aria-label',
      /AI 领域关系图/,
    );
    await expect(page.locator('#home-ai-map .ai-map-svg')).toBeVisible();
    await expect(page.locator('#home-ai-map .ai-map-svg ellipse')).toHaveCount(12);
    await expect(page.locator('#home-ai-map .ai-map-svg circle')).toHaveCount(1);
    await expect(page.locator('#home-ai-map .ai-map-svg')).toContainText('人工智能');
    await expect(page.locator('.skip-link')).toHaveAttribute('href', '#main-content');
    await expect(page.locator('.hero-brand')).toContainText('Bio AI Lab');
    await expect(page.locator('.hero-ai-map')).toHaveCount(0);
    await expect(page.locator('.hero-content-scrim')).toHaveCount(0);
    await expect(page.locator('#main-content')).toBeVisible();
    await expect(page.locator('#home-recommend')).toBeVisible();
    await expect(page.locator('#home-daily')).toBeVisible();
    await expect(page.locator('#home-daily .daily-cadence').first()).toBeVisible();
    await expect(page.locator('#daily-github-list')).toBeVisible();
    await expect(page.locator('#home-ops')).toBeVisible();
    await expect(page.locator('#ops-views')).not.toHaveText('—');
    await expect(page.locator('#ops-trend-list .ops-trend-item').first()).toContainText('今日点击');
    await expect(page.locator('#ops-updated-text')).toContainText(/同步|实时/);
    await expect(page.locator('.ops-live-dot')).toBeVisible();
    await expect(page.locator('#home-tools')).toHaveCount(0);
    await expect(page.locator('#home-categories')).toHaveCount(0);
    await expect(page.locator('#home-oss')).toHaveCount(0);
    await expect(page.locator('#section-oss')).toHaveCount(0);
    await expect(page.locator('#home-favorites')).toHaveCount(0);
    await expect(page.locator('#home-learning')).toHaveCount(0);
    await expect(page.locator('#knowledge-fab')).toBeVisible();
    await expect(page.locator('a.logo')).toHaveAttribute('aria-label', '返回首页');
    await expect(page.locator('a.logo')).toHaveAttribute('href', /index\.html$/);
  });

  test('今日热度本机实时累加', async ({ page }) => {
    await gotoHome(page, '#home-ops');
    await expect(page.locator('#ops-clicks')).not.toHaveText('—');
    const before = Number(
      (await page.locator('#ops-clicks').textContent())?.replace(/,/g, '') || 0,
    );
    await page.locator('#ops-trend-list .ops-trend-item').first().click();
    await expect
      .poll(async () => {
        const now = Number(
          (await page.locator('#ops-clicks').textContent())?.replace(/,/g, '') || 0,
        );
        return now > before;
      })
      .toBe(true);
    await expect(page.locator('#ops-updated-text')).toContainText('本机实时累加');
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
    await expect(result.locator('.recommend-examples')).toBeVisible();
    await expect(result.locator('.recommend-example-list li').first()).toBeVisible();
    await expect(result.locator('.recommend-path-steps')).toBeVisible();
    await expect(result.locator('.recommend-next')).toBeVisible();
    await expect(
      result.locator('.recommend-next a[data-track="recommend_goto_learning"]'),
    ).toHaveAttribute('href', /ai-learning-roadmap\.html$/);
    await page.locator('[data-picker="video"]').click();
    await expect(result.locator('.recommend-result-badge')).toContainText('做视频');
    await expect(result.locator('a[data-tool="jimeng"]')).toBeVisible();
    await expect(result.locator('.recommend-example-list')).toContainText('即梦');
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

  test('专区页面包屑', async ({ page }) => {
    await page.route('**/*fonts.googleapis.com/**', (route) => route.abort());
    await page.route('**/*fonts.gstatic.com/**', (route) => route.abort());
    await page.goto('index.html#section-local', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#section-local')).toHaveClass(/active/);
    const localCrumb = page.locator('#section-local .breadcrumb');
    await expect(localCrumb).toBeVisible();
    await expect(localCrumb).toContainText('首页');
    await expect(localCrumb).toContainText('本地部署');
    await expect(localCrumb.locator('a', { hasText: '首页' })).toBeVisible();
    await expect(page.locator('#section-local .local-card').first()).toBeVisible();
    await expect(page.locator('.nav-tab', { hasText: '本地部署' })).toBeVisible();

    await page.locator('.nav-tab', { hasText: '课程资源' }).click();
    await expect(page.locator('#section-courses')).toHaveClass(/active/);
    await expect(page.locator('#section-courses .breadcrumb')).toContainText('课程资源');

    await page.locator('.nav-tab', { hasText: '新闻热点' }).click();
    await expect(page.locator('#section-news .breadcrumb')).toContainText('新闻热点');

    await page.locator('.nav-tab', { hasText: 'AI 视频' }).click();
    await expect(page.locator('#section-videos .breadcrumb')).toContainText('AI 视频');

    await page.locator('#section-videos .breadcrumb a', { hasText: '首页' }).click();
    await expect(page.locator('#section-home')).toHaveClass(/active/);
  });

  test('独立页面包屑', async ({ page }) => {
    await page.route('**/*fonts.googleapis.com/**', (route) => route.abort());
    await page.goto('tools/hub.html', { waitUntil: 'domcontentloaded' });
    const hubCrumb = page.locator('.breadcrumb');
    await expect(hubCrumb).toContainText('首页');
    await expect(hubCrumb).toContainText('工具中心');

    await page.goto('tools/chatgpt.html', { waitUntil: 'domcontentloaded' });
    const toolCrumb = page.locator('.breadcrumb');
    await expect(toolCrumb).toContainText('工具中心');
    await expect(toolCrumb).toContainText('ChatGPT');

    await page.goto('news/daily-ai-news.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.breadcrumb')).toContainText('新闻热点');
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
    await page.locator('#site-search').fill('ChatGPT');
    const heroResults = page.locator('#site-search-results');
    await expect(heroResults).toBeVisible();
    await expect(heroResults.locator('.search-hit').first()).toBeVisible();
    await expect(heroResults.locator('a.search-hit').first()).toHaveAttribute(
      'href',
      /tools\/chatgpt\.html/,
    );
    await expect
      .poll(async () => heroResults.evaluate((el) => getComputedStyle(el).position))
      .toBe('fixed');
    await expect
      .poll(async () => heroResults.evaluate((el) => el.getBoundingClientRect().height))
      .toBeGreaterThan(24);
    await page.locator('#site-search').press('Enter');
    await expect(page).toHaveURL(/tools\/chatgpt\.html/);
  });

  test('搜索联想与历史面板', async ({ page }) => {
    await gotoHome(page);
    await waitSearchReady(page);
    await page.locator('#site-search').focus();
    await expect(page.locator('.search-suggest-chip').first()).toBeVisible();
    await page.locator('#site-search').fill('DeepSeek');
    await expect(page.locator('.search-group-label').first()).toBeVisible();
  });

  test('顶栏全局搜索（工具页）', async ({ page }) => {
    await page.route('**/*fonts.googleapis.com/**', (route) => route.abort());
    await page.route('**/*fonts.gstatic.com/**', (route) => route.abort());
    await page.goto('tools/chatgpt.html', { waitUntil: 'domcontentloaded' });
    await waitSearchReady(page);
    await expect(page.locator('#nav-site-search')).toBeVisible();
    await page.fill('#nav-site-search', 'ChatGPT');
    const results = page.locator('#nav-site-search-results');
    await expect(results).toBeVisible();
    await expect(results.locator('a.search-hit[href*="tools/chatgpt"]').first()).toBeVisible();
    await expect
      .poll(async () => results.evaluate((el) => getComputedStyle(el).position))
      .toBe('fixed');
    await expect
      .poll(async () => results.evaluate((el) => el.getBoundingClientRect().height))
      .toBeGreaterThan(24);
  });

  test('顶栏全局搜索（首页）', async ({ page }) => {
    await gotoHome(page);
    await waitSearchReady(page);
    await page.fill('#nav-site-search', 'ChatGPT');
    const results = page.locator('#nav-site-search-results');
    await expect(results).toBeVisible();
    await expect(results.locator('a.search-hit').first()).toHaveAttribute(
      'href',
      /tools\/chatgpt\.html/,
    );
    await expect
      .poll(async () => results.evaluate((el) => getComputedStyle(el).position))
      .toBe('fixed');
    await page.locator('.nav-search .site-search-submit').click();
    await expect(page).toHaveURL(/tools\/chatgpt\.html/);
  });

  test('搜索空状态引导', async ({ page }) => {
    await gotoHome(page);
    await waitSearchReady(page);
    await page.locator('#site-search').fill('zzzz-no-such-tool-xyz');
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
    await expect(page.locator('#hub-compare a.hub-compare-link')).toHaveCount(10);
    await expect(
      page.locator('#hub-compare a.hub-compare-link', { hasText: 'ChatGPT' }),
    ).toHaveAttribute('href', /tools\/chatgpt\.html$/);
    await expect(
      page.locator('#hub-compare a.hub-compare-link', { hasText: '即梦' }),
    ).toHaveAttribute('href', /tools\/jimeng\.html$/);
    await expect(
      page.locator('[data-ranking-vl].vl-root, [data-ranking-vl] .aicpb-table-row').first(),
    ).toBeVisible();
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
    await expect(page.locator('#daily-video-list .video-grid').first()).toBeVisible();
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
