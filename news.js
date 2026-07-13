const NEWS_DATA_URL = (typeof document !== 'undefined' && document.documentElement.dataset.base
  ? document.documentElement.dataset.base.replace(/\/?$/, '/')
  : (window.location.pathname.includes('/news/') ? '../' : '')) + 'ai-news.json';

let newsDataPromise = null;

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function formatNewsDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  } catch {
    return iso;
  }
}

function renderNewsCard(item) {
  return `
    <article class="news-card">
      <div class="news-card-head">
        <span class="news-category">${escapeHtml(item.category)}</span>
        <span class="news-source">${escapeHtml(item.source)}</span>
      </div>
      <h4><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener" data-track="news-click">${escapeHtml(item.title)}</a></h4>
      <p class="news-summary">${escapeHtml(item.summary)}</p>
      <div class="news-meta">
        ${item.published_at ? `<span>${escapeHtml(formatNewsDate(item.published_at))}</span>` : ''}
        <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener" class="news-read" data-track="news-read">阅读原文 →</a>
      </div>
    </article>
  `;
}

function fetchNewsData() {
  if (!newsDataPromise) {
    newsDataPromise = fetch(NEWS_DATA_URL, { cache: 'default' })
      .then(res => {
        if (!res.ok) throw new Error('无法加载新闻数据');
        return res.json();
      })
      .catch(err => {
        newsDataPromise = null;
        throw err;
      });
  }
  return newsDataPromise;
}

async function loadHomeNewsPreview() {
  const root = document.getElementById('home-news-preview');
  if (!root || root.dataset.ssg === '1') return;
  try {
    const data = await fetchNewsData();
    const items = (data.items || []).slice(0, 4);
    if (!items.length) {
      root.innerHTML = '<p class="loading-hint">暂无新闻，每周一自动更新。</p>';
      return;
    }
    root.innerHTML = `<div class="news-grid news-grid-preview">${items.map(renderNewsCard).join('')}</div>`;
  } catch {
    root.innerHTML = '<p class="loading-hint">新闻加载失败，请稍后刷新。</p>';
    if (typeof trackEvent === 'function') trackEvent('data_load_error', { source: 'news-home' });
  }
}

function renderWatchSources(sources) {
  if (!sources?.length) return '';
  const links = sources.map(src => {
    const parts = [];
    if (src.blog) parts.push(`<a href="${escapeHtml(src.blog)}" target="_blank" rel="noopener">博客</a>`);
    if (src.x) parts.push(`<a href="${escapeHtml(src.x)}" target="_blank" rel="noopener">X</a>`);
    return `<li><strong>${escapeHtml(src.name)}</strong> ${parts.join(' · ')}</li>`;
  }).join('');
  return `
    <div class="news-watch-panel">
      <h4>持续关注（官方公告与社交账号）</h4>
      <ul class="news-watch-list">${links}</ul>
    </div>
  `;
}

async function loadDailyNews() {
  const root = document.getElementById('daily-news-list');
  const meta = document.getElementById('news-update-meta') || document.getElementById('news-page-meta');
  const watchRoot = document.getElementById('news-watch-sources');
  if (!root) return;

  root.innerHTML = '<p class="loading-hint">加载 AI 新闻…</p>';

  try {
    const data = await fetchNewsData();
    const items = data.items || [];
    if (!items.length) {
      root.innerHTML = '<p class="loading-hint">暂无新闻数据。</p>';
      return;
    }
    if (meta && data.updated_at) {
      const updated = new Date(data.updated_at);
      const cadence = data.cadence === 'weekly' ? '每周一' : '最近';
      meta.textContent = `${cadence}更新：${updated.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}（北京时间）`;
    }
    root.innerHTML = `<div class="news-grid">${items.map(renderNewsCard).join('')}</div>`;
    if (watchRoot && data.watch_sources?.length) {
      watchRoot.innerHTML = renderWatchSources(data.watch_sources);
    }
  } catch (err) {
    root.innerHTML = `<p class="loading-hint error-hint">${escapeHtml(err.message)}</p>`;
    if (typeof trackEvent === 'function') trackEvent('data_load_error', { source: 'news-section' });
  }
}

function bootNews() {
  loadHomeNewsPreview();
  loadDailyNews();
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootNews);
} else {
  bootNews();
}
