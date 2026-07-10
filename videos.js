const VIDEO_DATA_URL = 'daily-videos.json';
const HOT_VIEWS_THRESHOLD = 1_000_000;
const CATEGORY_ORDER = [
  'youtube_top_views',
  'youtube_recent_30d',
  'youtube_recent_24h',
  'bilibili_top_views',
  'bilibili_recent_30d',
  'bilibili_recent_24h',
  'top_views',
  'recent_7d',
  'recent_24h',
  'last_6m',
];

let videoDataPromise = null;
let videoState = { platform: 'all', sort: 'views', rawData: null };

function getCategoryKeys(batch) {
  if (!batch.categories) return [];
  const preferred = CATEGORY_ORDER.filter(key => batch.categories[key]);
  if (preferred.length) return preferred;
  return Object.keys(batch.categories);
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function formatNumber(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 10_000) return (n / 10_000).toFixed(1) + '万';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function formatSummary(v) {
  const base = v.summary || '';
  if (v.views >= HOT_VIEWS_THRESHOLD) {
    return `热门推荐 · ${base}`;
  }
  return base;
}

function formatPublishDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' });
  } catch {
    return iso.slice(0, 10);
  }
}

function getBatchVideos(batch) {
  if (batch.categories) {
    return getCategoryKeys(batch).flatMap(key => batch.categories[key]?.videos || []);
  }
  return batch.videos || [];
}

function platformLabel(v) {
  if (v.platform === 'bilibili') return 'B站';
  if ((v.id || '').startsWith('bilibili:')) return 'B站';
  return 'YouTube';
}

function isBilibiliVideo(v) {
  return v.platform === 'bilibili' || String(v.id || '').startsWith('bilibili:');
}

function videoPlatform(v) {
  return isBilibiliVideo(v) ? 'bilibili' : 'youtube';
}

function renderVideoCard(v, { compact = false } = {}) {
  const hot = v.views >= HOT_VIEWS_THRESHOLD;
  const track = compact ? 'home-video-click' : 'video-click';
  const platform = platformLabel(v);
  const thumbPolicy = isBilibiliVideo(v) ? ' referrerpolicy="no-referrer"' : '';
  const thumbSrc = v.thumbnail || '';
  const author = v.author || v.channel || '未知作者';
  const published = formatPublishDate(v.published_at);
  return `
    <article class="video-card reveal${compact ? ' video-card-compact' : ''}">
      <a class="video-thumb" href="${escapeHtml(v.url)}" target="_blank" rel="noopener" data-track="${track}">
        <img src="${escapeHtml(thumbSrc)}" alt="${escapeHtml(v.title)}" loading="lazy"${thumbPolicy}>
        <span class="video-play-btn" aria-hidden="true">▶ 观看</span>
        ${v.duration ? `<span class="video-duration">${escapeHtml(v.duration)}</span>` : ''}
        <span class="video-quality">${v.max_height}p</span>
        <span class="video-platform video-platform-${v.platform || 'youtube'}">${escapeHtml(platform)}</span>
        ${hot ? '<span class="video-hot">热门</span>' : ''}
      </a>
      <div class="video-body">
        <h4><a href="${escapeHtml(v.url)}" target="_blank" rel="noopener" data-track="${track}">${escapeHtml(v.title)}</a></h4>
        <p class="video-summary">${escapeHtml(formatSummary(v))}</p>
        <div class="video-meta">
          <span>${escapeHtml(author)}</span>
          ${published ? `<span>${escapeHtml(published)}</span>` : ''}
          <span>播放 ${formatNumber(v.views)}</span>
        </div>
      </div>
    </article>
  `;
}

function flattenLatestVideos(batch) {
  const seen = new Set();
  const items = [];
  for (const v of getBatchVideos(batch)) {
    if (seen.has(v.id)) continue;
    seen.add(v.id);
    items.push(v);
  }
  return items;
}

function filterAndSortVideos(videos, { platform, sort }) {
  let list = [...videos];
  if (platform !== 'all') {
    list = list.filter(v => videoPlatform(v) === platform);
  }
  if (sort === 'recent') {
    list.sort((a, b) => {
      const ta = a.published_at ? Date.parse(a.published_at) : 0;
      const tb = b.published_at ? Date.parse(b.published_at) : 0;
      return tb - ta;
    });
  } else {
    list.sort((a, b) => (b.views || 0) - (a.views || 0));
  }
  return list;
}

function renderFilteredGrid(videos) {
  if (!videos.length) {
    return '<p class="loading-hint">当前筛选条件下暂无视频。</p>';
  }
  return `<div class="video-grid">${videos.map(v => renderVideoCard(v)).join('')}</div>`;
}

function renderCategory(cat) {
  const videos = cat.videos || [];
  if (!videos.length) {
    return `<div class="video-category video-category-empty"><h4 class="video-category-title">${escapeHtml(cat.label)}</h4><p class="loading-hint">暂无符合该分类的推荐</p></div>`;
  }
  return `
    <div class="video-category">
      <h4 class="video-category-title">${escapeHtml(cat.label)} <span class="video-day-count">${videos.length} 条</span></h4>
      <div class="video-grid">${videos.map(v => renderVideoCard(v)).join('')}</div>
    </div>
  `;
}

function renderBatch(batch, state) {
  const flat = flattenLatestVideos(batch);
  const filtered = filterAndSortVideos(flat, state);

  if (state.platform !== 'all' || state.sort !== 'views') {
    const label = state.sort === 'recent' ? '最新排序' : '热门排序';
    const platformLabelText = state.platform === 'all' ? '全部平台' : (state.platform === 'bilibili' ? 'B站' : 'YouTube');
    return `
      <section class="video-day">
        <h3 class="video-day-title">${escapeHtml(batch.date)} · ${platformLabelText} · ${label}
          <span class="video-day-count">${filtered.length} 条</span>
        </h3>
        ${renderFilteredGrid(filtered)}
      </section>
    `;
  }

  const count = getBatchVideos(batch).length;
  if (batch.categories) {
    const categories = getCategoryKeys(batch).map(key => batch.categories[key]);
    return `
      <section class="video-day">
        <h3 class="video-day-title">${escapeHtml(batch.date)} <span class="video-day-count">${count} 条</span></h3>
        ${categories.map(renderCategory).join('')}
      </section>
    `;
  }

  const videos = batch.videos || [];
  return `
    <section class="video-day">
      <h3 class="video-day-title">${escapeHtml(batch.date)} <span class="video-day-count">${videos.length} 条</span></h3>
      <div class="video-grid">${videos.map(v => renderVideoCard(v)).join('')}</div>
    </section>
  `;
}

function fetchVideoData() {
  if (!videoDataPromise) {
    videoDataPromise = fetch(VIDEO_DATA_URL, { cache: 'no-store' })
      .then(res => {
        if (!res.ok) throw new Error('无法加载视频数据');
        return res.json();
      })
      .catch(err => {
        videoDataPromise = null;
        throw err;
      });
  }
  return videoDataPromise;
}

function pickHomePreviewVideos(batch, limit = 3) {
  const flat = flattenLatestVideos(batch);
  const sorted = filterAndSortVideos(flat, { platform: 'all', sort: 'recent' });
  return sorted.slice(0, limit);
}

function paintVideoList() {
  const root = document.getElementById('daily-video-list');
  if (!root || !videoState.rawData) return;
  const batches = videoState.rawData.batches || [];
  if (!batches.length) {
    root.innerHTML = '<p class="loading-hint">暂无视频数据，每日北京时间 0:00 自动更新。</p>';
    return;
  }
  root.innerHTML = batches.map(batch => renderBatch(batch, videoState)).join('');
  if (typeof window.refreshScrollReveal === 'function') window.refreshScrollReveal(root);
}

function initVideoToolbar() {
  const toolbar = document.getElementById('video-toolbar');
  if (!toolbar) return;

  toolbar.querySelectorAll('[data-video-platform]').forEach(btn => {
    btn.addEventListener('click', () => {
      toolbar.querySelectorAll('[data-video-platform]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      videoState.platform = btn.dataset.videoPlatform;
      paintVideoList();
      if (typeof trackEvent === 'function') trackEvent('video-filter-platform', { platform: videoState.platform });
    });
  });

  toolbar.querySelectorAll('[data-video-sort]').forEach(btn => {
    btn.addEventListener('click', () => {
      toolbar.querySelectorAll('[data-video-sort]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      videoState.sort = btn.dataset.videoSort;
      paintVideoList();
      if (typeof trackEvent === 'function') trackEvent('video-filter-sort', { sort: videoState.sort });
    });
  });
}

async function loadHomeVideoPreview() {
  const root = document.getElementById('home-video-preview');
  if (!root) return;

  try {
    const data = await fetchVideoData();
    const latest = (data.batches || [])[0];
    const videos = latest ? pickHomePreviewVideos(latest) : [];
    if (!videos.length) {
      root.innerHTML = '<p class="loading-hint">暂无视频，每日北京时间 0:00 自动更新。</p>';
      return;
    }
    root.innerHTML = `<div class="video-grid video-grid-preview">${videos.map(v => renderVideoCard(v, { compact: true })).join('')}</div>`;
    if (typeof window.refreshScrollReveal === 'function') window.refreshScrollReveal(root);
  } catch {
    root.innerHTML = '<p class="loading-hint">视频加载失败，请稍后刷新。</p>';
  }
}

async function loadDailyVideos() {
  const root = document.getElementById('daily-video-list');
  const meta = document.getElementById('video-update-meta');
  if (!root) return;

  root.innerHTML = '<p class="loading-hint">加载视频推荐…</p>';

  try {
    const data = await fetchVideoData();
    videoState.rawData = data;
    const batches = data.batches || [];

    if (!batches.length) {
      root.innerHTML = '<p class="loading-hint">暂无视频数据，每日北京时间 0:00 自动更新。</p>';
      return;
    }

    if (meta && data.updated_at) {
      const updated = new Date(data.updated_at);
      meta.textContent = `最近更新：${updated.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}（北京时间）· 支持平台筛选与热门/最新排序`;
    }

    paintVideoList();
    initVideoToolbar();
  } catch (err) {
    root.innerHTML = `<p class="loading-hint error-hint">${escapeHtml(err.message)}</p>`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadHomeVideoPreview();
  loadDailyVideos();
});
