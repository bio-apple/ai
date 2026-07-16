const NEWS_DATA_URL =
  (typeof document !== 'undefined' && document.documentElement.dataset.base
    ? document.documentElement.dataset.base.replace(/\/?$/, '/')
    : window.location.pathname.includes('/news/')
      ? '../'
      : '') + 'ai-news.json';

const NEWS_CATEGORY_ORDER = ['新模型发布', '新工具上线', '开源项目', '行业新闻', '中文资讯'];

let newsDataPromise = null;
let newsState = { category: 'all', items: [], watchSources: [] };

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function formatNewsDateShort(raw) {
  if (!raw) return '';
  const cleaned = String(raw)
    .replace(/\s*分享\s*$/u, '')
    .trim();
  try {
    let d = new Date(cleaned);
    if (Number.isNaN(d.getTime()) && /^\d{4}-\d{2}-\d{2}/.test(cleaned)) {
      d = new Date(
        cleaned.replace(' ', 'T') +
          (cleaned.includes('+') || cleaned.endsWith('Z') ? '' : '+08:00'),
      );
    }
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('zh-CN', {
        month: 'numeric',
        day: 'numeric',
        timeZone: 'Asia/Shanghai',
      });
    }
  } catch {
    /* fall through */
  }
  return cleaned.slice(0, 10);
}

function truncateText(text, max = 72) {
  const t = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/** 标题规范化：全角/空白对齐后再比 */
function normalizeNewsTitle(title) {
  return String(title || '')
    .normalize('NFKC')
    .replace(/\u3000/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** 标题或 URL 相同只保留最新 published_at（与 scripts/news_dedupe.py 一致） */
function dedupeNewsItems(items) {
  const sorted = [...(items || [])].sort((a, b) => {
    const ta = a.published_at ? Date.parse(a.published_at) : 0;
    const tb = b.published_at ? Date.parse(b.published_at) : 0;
    return tb - ta;
  });
  const seenTitle = new Set();
  const seenUrl = new Set();
  const out = [];
  for (const item of sorted) {
    const titleKey = normalizeNewsTitle(item.title);
    const url = String(item.url || '').trim();
    if (url && seenUrl.has(url)) continue;
    if (titleKey && seenTitle.has(titleKey)) continue;
    if (url) seenUrl.add(url);
    if (titleKey) seenTitle.add(titleKey);
    out.push(item);
  }
  return out;
}

function groupNewsByCategory(items) {
  const map = new Map();
  for (const item of items) {
    const cat = item.category || '其他';
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat).push(item);
  }
  const keys = [
    ...NEWS_CATEGORY_ORDER.filter((k) => map.has(k)),
    ...[...map.keys()].filter((k) => !NEWS_CATEGORY_ORDER.includes(k)),
  ];
  return keys.map((key) => ({ category: key, items: map.get(key) }));
}

function renderNewsRow(item) {
  const summary = truncateText(item.summary, 68);
  return `
    <li class="news-row">
      <a class="news-row-main" href="${escapeHtml(item.url)}" target="_blank" rel="noopener" data-track="news-click">
        <span class="news-row-title">${escapeHtml(item.title)}</span>
        <span class="news-row-meta">
          <span class="news-row-source">${escapeHtml(item.source || '')}</span>
          ${item.published_at ? `<span class="news-row-date">${escapeHtml(formatNewsDateShort(item.published_at))}</span>` : ''}
        </span>
      </a>
      ${summary ? `<p class="news-row-summary">${escapeHtml(summary)}</p>` : ''}
    </li>
  `;
}

function renderNewsFeed(items) {
  if (!items.length) {
    return '<p class="loading-hint">当前分类暂无新闻。</p>';
  }
  const groups = groupNewsByCategory(items);
  return groups
    .map(
      (group) => `
    <section class="news-group">
      <h3 class="news-group-title">
        ${escapeHtml(group.category)}
        <span class="news-group-count">${group.items.length}</span>
      </h3>
      <ul class="news-feed-list">
        ${group.items.map(renderNewsRow).join('')}
      </ul>
    </section>
  `,
    )
    .join('');
}

function renderNewsToolbar(items) {
  const counts = new Map([['all', items.length]]);
  for (const item of items) {
    const cat = item.category || '其他';
    counts.set(cat, (counts.get(cat) || 0) + 1);
  }
  const cats = [
    'all',
    ...NEWS_CATEGORY_ORDER.filter((k) => counts.has(k)),
    ...[...counts.keys()].filter((k) => k !== 'all' && !NEWS_CATEGORY_ORDER.includes(k)),
  ];
  const buttons = cats
    .map((cat) => {
      const label = cat === 'all' ? '全部' : cat;
      const active = newsState.category === cat ? ' active' : '';
      return `<button type="button" class="news-filter${active}" data-news-category="${escapeHtml(cat)}">${escapeHtml(label)} <span>${counts.get(cat) || 0}</span></button>`;
    })
    .join('');
  return `<div class="news-toolbar" role="toolbar" aria-label="新闻分类筛选">${buttons}</div>`;
}

function paintNewsList() {
  const root = document.getElementById('daily-news-list');
  if (!root) return;
  const filtered =
    newsState.category === 'all'
      ? newsState.items
      : newsState.items.filter((i) => (i.category || '其他') === newsState.category);
  root.innerHTML = `
    ${renderNewsToolbar(newsState.items)}
    <div class="news-feed">${renderNewsFeed(filtered)}</div>
  `;
  root.querySelectorAll('[data-news-category]').forEach((btn) => {
    btn.addEventListener('click', () => {
      newsState.category = btn.dataset.newsCategory || 'all';
      paintNewsList();
      if (typeof trackEvent === 'function') {
        trackEvent('news_filter_category', { category: newsState.category });
      }
    });
  });
}

function fetchNewsData() {
  if (!newsDataPromise) {
    newsDataPromise = fetch(NEWS_DATA_URL, { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error('无法加载新闻数据');
        return res.json();
      })
      .catch((err) => {
        newsDataPromise = null;
        throw err;
      });
  }
  return newsDataPromise;
}

function renderWatchSources(sources) {
  if (!sources?.length) return '';
  const links = sources
    .map((src) => {
      const parts = [];
      if (src.blog)
        parts.push(`<a href="${escapeHtml(src.blog)}" target="_blank" rel="noopener">博客</a>`);
      if (src.x) parts.push(`<a href="${escapeHtml(src.x)}" target="_blank" rel="noopener">X</a>`);
      return `<li><strong>${escapeHtml(src.name)}</strong> ${parts.join(' · ')}</li>`;
    })
    .join('');
  return `
    <details class="news-watch-panel">
      <summary>持续关注的来源（${sources.length}）</summary>
      <ul class="news-watch-list">${links}</ul>
    </details>
  `;
}

async function loadDailyNews() {
  const root = document.getElementById('daily-news-list');
  const meta =
    document.getElementById('news-update-meta') || document.getElementById('news-page-meta');
  const watchRoot = document.getElementById('news-watch-sources');
  if (!root) return;

  root.innerHTML = '<p class="loading-hint">加载 AI 新闻…</p>';

  try {
    const data = await fetchNewsData();
    newsState.items = dedupeNewsItems(data.items || []);
    newsState.watchSources = data.watch_sources || [];
    newsState.category = 'all';
    if (!newsState.items.length) {
      root.innerHTML = '<p class="loading-hint">暂无新闻数据。</p>';
      return;
    }
    if (meta && data.updated_at) {
      const updated = new Date(data.updated_at);
      const windowDays = Number(data.window_days) > 0 ? Number(data.window_days) : 7;
      const stamp = updated.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' });
      meta.textContent = `一周内热点 · 每天更新 · 近 ${windowDays} 天 · ${stamp} · ${newsState.items.length} 条`;
    }
    paintNewsList();
    if (watchRoot) {
      watchRoot.innerHTML = renderWatchSources(newsState.watchSources);
    }
  } catch (err) {
    root.innerHTML = `<p class="loading-hint error-hint">${escapeHtml(err.message)}</p>`;
    if (typeof trackEvent === 'function') trackEvent('data_load_error', { source: 'news-section' });
  }
}

function bootNews() {
  loadDailyNews();
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootNews);
} else {
  bootNews();
}
