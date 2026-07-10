const NEWS_DATA_URL = window.location.pathname.includes('/news/')
  ? '../ai-news.json'
  : 'ai-news.json';

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
    newsDataPromise = fetch(NEWS_DATA_URL, { cache: 'no-store' })
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
  if (!root) return;
  try {
    const data = await fetchNewsData();
    const items = (data.items || []).slice(0, 4);
    if (!items.length) {
      root.innerHTML = '<p class="loading-hint">暂无新闻，每日自动更新。</p>';
      return;
    }
    root.innerHTML = `<div class="news-grid news-grid-preview">${items.map(renderNewsCard).join('')}</div>`;
  } catch {
    root.innerHTML = '<p class="loading-hint">新闻加载失败，请稍后刷新。</p>';
  }
}

async function loadDailyNews() {
  const root = document.getElementById('daily-news-list');
  const meta = document.getElementById('news-update-meta') || document.getElementById('news-page-meta');
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
      meta.textContent = `最近更新：${updated.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}（北京时间）`;
    }
    root.innerHTML = `<div class="news-grid">${items.map(renderNewsCard).join('')}</div>`;
  } catch (err) {
    root.innerHTML = `<p class="loading-hint error-hint">${escapeHtml(err.message)}</p>`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadHomeNewsPreview();
  loadDailyNews();
});
