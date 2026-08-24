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

async function openHomeOps(page) {
  const wrap = page.locator('#home-ops-wrap');
  if (!(await wrap.getAttribute('open'))) {
    await wrap.locator('summary').click();
  }
  await expect(page.locator('#home-ops')).toBeVisible();
  await expect
    .poll(async () => (await page.locator('#ops-views').textContent())?.trim() !== '—', {
      timeout: 15000,
    })
    .toBeTruthy();
}

test.describe('Bio AI Lab 关键路径', () => {
  test('首页主路径：推荐 · 简报 · 独立专区入口', async ({ page }) => {
    await gotoHome(page);
    await expect(page.locator('h1')).toContainText('先说要做什么');
    await expect(page.locator('#home-ai-map')).toBeVisible();
    await expect(page.locator('#home-ai-map .ai-map')).toBeVisible();
    await expect(page.locator('.skip-link')).toHaveAttribute('href', '#main-content');
    await expect(page.locator('main#main-content')).toHaveCount(1);
    await expect(page.locator('.hero-brand')).toContainText('Bio AI Lab');
    await expect(page.locator('.home-quick-filters')).toHaveCount(0);
    await expect(page.locator('#home-recommend')).toBeVisible();
    await expect(page.locator('#home-daily')).toBeVisible();
    await expect(page.locator('#home-video-preview-list')).toBeVisible();
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
    await expect(page.locator('#knowledge-fab')).toBeVisible();
  });

  test('首页视频预览读取本机 localStorage', async ({ page }) => {
    await gotoHome(page);
    await page.evaluate(() => {
      localStorage.setItem(
        'bioai.video.preview.v2',
        JSON.stringify([
          {
            url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            title: '测试视频标题',
            author: '测试作者',
            thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
            platform: 'youtube',
            kind: 'video',
            id: 'dQw4w9WgXcQ',
          },
        ]),
      );
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      if (typeof window.__BIOAI_ensureVideoPreview === 'function') {
        await window.__BIOAI_ensureVideoPreview();
      }
    });
    await expect(page.locator('#home-video-preview-list .home-video-teaser')).toHaveCount(1);
    await expect(page.locator('.home-video-teaser-title')).toContainText('测试视频标题');
  });

  test('今日热度默认折叠，展开后加载数据', async ({ page }) => {
    await gotoHome(page);
    await expect(page.locator('#home-ops-wrap')).not.toHaveAttribute('open', /.*/);
    await openHomeOps(page);
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
    await expect(
      result.locator('.recommend-next a[data-track="recommend_goto_learning"]'),
    ).toHaveAttribute('href', /ai-learning-roadmap\.html$/);
  });

  test('旧 hash 专区重定向到独立页', async ({ page }) => {
    await page.route('**/*fonts.googleapis.com/**', (route) => route.abort());
    await page.goto('index.html#section-videos', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/videos\.html/);
    await expect(page.locator('#video-preview-form')).toBeVisible();
    await expect(page.locator('#video-url-input')).toBeVisible();
  });

  test('专区独立页 SSG + 面包屑', async ({ page }) => {
    await page.route('**/*fonts.googleapis.com/**', (route) => route.abort());
    await page.goto('oss.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.breadcrumb')).toContainText('开源精选');
    await expect(page.locator('#oss-list .oss-card-item').first()).toBeVisible();
    await expect
      .poll(async () => page.locator('#oss-list .oss-card-item').count())
      .toBeGreaterThanOrEqual(6);
    await expect(page.locator('#oss-list .oss-cat-block-title').first()).toBeVisible();

    await page.goto('courses.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.breadcrumb')).toContainText('课程资源');
    await expect(page.locator('#courses-list .course-card').first()).toBeVisible();

    await page.goto('videos.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.breadcrumb')).toContainText('AI 视频');
    await expect(page.locator('h1')).toContainText('我的视频链接');
    await expect(page.locator('#video-preview-form')).toBeVisible();
    await expect(page.locator('#video-url-input')).toBeVisible();

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
    await page.locator('#site-search').focus();
    await waitSearchReady(page);
    await page.locator('#site-search').fill('ChatGPT');
    const heroResults = page.locator('#site-search-results');
    await expect(heroResults.locator('a.search-hit').first()).toHaveAttribute(
      'href',
      /tools\/chatgpt\.html/,
    );
    await page.locator('#site-search').press('Enter');
    await expect(page).toHaveURL(/tools\/chatgpt\.html/);
  });

  test('顶栏工具中心', async ({ page }) => {
    await page.route('**/*fonts.googleapis.com/**', (route) => route.abort());
    await page.goto('index.html', { waitUntil: 'domcontentloaded' });
    await page.locator('.nav-link-page', { hasText: 'AI工具中心' }).click();
    await expect(page.locator('#hub-ranking')).toBeVisible();
    await expect(page.locator('#hub-panel-aicpb .aicpb-table-row')).toHaveCount(10);
  });

  test('独立工具页与对比页', async ({ page }) => {
    await page.route('**/*fonts.googleapis.com/**', (route) => route.abort());
    await page.goto('tools/cursor.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toContainText('Cursor');
    await page.goto('compare/cursor-vs-copilot.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toContainText(/Cursor|Copilot/i);
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
