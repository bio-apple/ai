const NEWS_JSON = 'ai-news.json';

const NEWS_CATEGORY_ORDER = ['新模型发布', '新工具上线', '开源项目', '行业新闻', '中文资讯'];

let newsDataPromise = null;
let newsState = { category: 'all', window: 'week', items: [], watchSources: [] };

function parseNewsTime(raw) {
  if (!raw) return 0;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? 0 : t;
}

function filterByTimeWindow(items, window) {
  if (window === 'today') {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const t0 = start.getTime();
    return (items || []).filter((i) => parseNewsTime(i.published_at) >= t0);
  }
  // week（默认）：近 7 天
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return (items || []).filter((i) => {
    const t = parseNewsTime(i.published_at);
    return !t || t >= cutoff;
  });
}

function escapeHtml(s) {
  return window.BioAI?.escapeHtml ? window.BioAI.escapeHtml(s) : String(s ?? '');
}

function extRel() {
  return window.BioAI?.externalRel ? window.BioAI.externalRel() : 'noopener noreferrer';
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

/** 同类新闻再按来源聚合：OpenAI 等多条合并为一个来源块 */
function groupNewsBySource(items) {
  const map = new Map();
  for (const item of items || []) {
    const source = String(item.source || '').trim() || '其他来源';
    if (!map.has(source)) map.set(source, []);
    map.get(source).push(item);
  }
  const groups = [...map.entries()].map(([source, list]) => {
    const sorted = [...list].sort((a, b) => {
      const ta = a.published_at ? Date.parse(a.published_at) : 0;
      const tb = b.published_at ? Date.parse(b.published_at) : 0;
      return tb - ta;
    });
    const latest = sorted[0]?.published_at ? Date.parse(sorted[0].published_at) : 0;
    return { source, items: sorted, latest };
  });
  groups.sort((a, b) => b.latest - a.latest || a.source.localeCompare(b.source, 'zh'));
  return groups;
}

function renderNewsRow(item, { hideSource = false } = {}) {
  const summary = truncateText(item.summary, 68);
  const metaParts = [];
  if (!hideSource && item.source) {
    metaParts.push(`<span class="news-row-source">${escapeHtml(item.source)}</span>`);
  }
  if (item.published_at) {
    metaParts.push(
      `<span class="news-row-date">${escapeHtml(formatNewsDateShort(item.published_at))}</span>`,
    );
  }
  return `
    <li class="news-row${hideSource ? ' news-row-in-source' : ''}">
      <a class="news-row-main" href="${escapeHtml(item.url)}" target="_blank" rel="${extRel()}" data-track="news-click">
        <span class="news-row-title"><span class="content-type-badge content-type-news" aria-hidden="true">资讯</span> ${escapeHtml(item.title)}</span>
        ${metaParts.length ? `<span class="news-row-meta">${metaParts.join('')}</span>` : ''}
      </a>
      ${summary ? `<p class="news-row-summary">${escapeHtml(summary)}</p>` : ''}
    </li>
  `;
}

function renderSourceGroup(group) {
  const multi = group.items.length > 1;
  return `
    <div class="news-source-group${multi ? ' news-source-group-multi' : ''}">
      <div class="news-source-head">
        <span class="news-source-name">${escapeHtml(group.source)}</span>
        <span class="news-source-count">${group.items.length}</span>
      </div>
      <ul class="news-feed-list news-feed-list-source">
        ${group.items.map((item) => renderNewsRow(item, { hideSource: true })).join('')}
      </ul>
    </div>
  `;
}

function renderNewsFeed(items) {
  if (!items.length) {
    return '<p class="loading-hint">当前分类暂无新闻。</p>';
  }
  const groups = groupNewsByCategory(items);
  return groups
    .map((group) => {
      const bySource = groupNewsBySource(group.items);
      return `
    <section class="news-group">
      <h3 class="news-group-title">
        ${escapeHtml(group.category)}
        <span class="news-group-count">${group.items.length}</span>
      </h3>
      <div class="news-source-stack">
        ${bySource.map(renderSourceGroup).join('')}
      </div>
    </section>
  `;
    })
    .join('');
}

function renderNewsToolbar(itemsInWindow) {
  const counts = new Map([['all', itemsInWindow.length]]);
  for (const item of itemsInWindow) {
    const cat = item.category || '其他';
    counts.set(cat, (counts.get(cat) || 0) + 1);
  }
  const cats = [
    'all',
    ...NEWS_CATEGORY_ORDER.filter((k) => counts.has(k)),
    ...[...counts.keys()].filter((k) => k !== 'all' && !NEWS_CATEGORY_ORDER.includes(k)),
  ];
  const catButtons = cats
    .map((cat) => {
      const label = cat === 'all' ? '全部' : cat;
      const active = newsState.category === cat;
      return `<button type="button" class="news-filter${active ? ' active' : ''}" data-news-category="${escapeHtml(cat)}" aria-pressed="${active}">${escapeHtml(label)} <span>${counts.get(cat) || 0}</span></button>`;
    })
    .join('');
  const timeButtons = [
    { id: 'today', label: '今日' },
    { id: 'week', label: '本周' },
  ]
    .map((t) => {
      const active = newsState.window === t.id;
      return `<button type="button" class="news-filter news-filter-time${active ? ' active' : ''}" data-news-window="${t.id}" aria-pressed="${active}">${t.label}</button>`;
    })
    .join('');
  return `
    <div class="news-toolbar news-toolbar-time" role="toolbar" aria-label="时间过滤">${timeButtons}</div>
    <div class="news-toolbar" role="toolbar" aria-label="新闻分类筛选">${catButtons}</div>
  `;
}

function paintNewsList() {
  const root = document.getElementById('daily-news-list');
  if (!root) return;
  const inWindow = filterByTimeWindow(newsState.items, newsState.window);
  const filtered =
    newsState.category === 'all'
      ? inWindow
      : inWindow.filter((i) => (i.category || '其他') === newsState.category);
  root.innerHTML = `
    ${renderNewsToolbar(inWindow)}
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
  root.querySelectorAll('[data-news-window]').forEach((btn) => {
    btn.addEventListener('click', () => {
      newsState.window = btn.dataset.newsWindow || 'week';
      newsState.category = 'all';
      paintNewsList();
      if (typeof trackEvent === 'function') {
        trackEvent('news_filter_window', { window: newsState.window });
      }
    });
  });
}

function fetchNewsData() {
  if (!newsDataPromise) {
    if (!window.BioAI?.fetchJson) {
      return Promise.reject(new Error('加载器未就绪，请稍后重试'));
    }
    newsDataPromise = window.BioAI.fetchJson(NEWS_JSON, { label: '新闻' });
  }
  return newsDataPromise;
}

function resetNewsFetch() {
  window.BioAI?.invalidateFetch?.(NEWS_JSON);
  newsDataPromise = null;
}

function renderWatchSources(sources) {
  if (!sources?.length) return '';
  const links = sources
    .map((src) => {
      const parts = [];
      if (src.blog)
        parts.push(`<a href="${escapeHtml(src.blog)}" target="_blank" rel="${extRel()}">博客</a>`);
      if (src.x)
        parts.push(`<a href="${escapeHtml(src.x)}" target="_blank" rel="${extRel()}">X</a>`);
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
    root.innerHTML = window.BioAI?.renderErrorBlock
      ? window.BioAI.renderErrorBlock(err.message || '加载失败')
      : `<p class="loading-hint error-hint">${escapeHtml(err.message)}</p>`;
    window.BioAI?.bindRetry?.(root, () => {
      resetNewsFetch();
      loadDailyNews();
    });
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
