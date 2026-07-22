const VIDEO_JSON = 'daily-videos.latest.json';
const VIDEO_JSON_FALLBACK = 'daily-videos.json';
const HOT_VIEWS_THRESHOLD = 1_000_000;
/** 抓取分桶键（仅用于合并前去重；页面不再按 100d/30d/3d 分开展示） */
const CATEGORY_ORDER = [
  'youtube_top_views',
  'youtube_recent_30d',
  'youtube_recent_3d',
  'bilibili_top_views',
  'bilibili_recent_30d',
  'bilibili_recent_3d',
  'youtube_recent_24h',
  'bilibili_recent_24h',
  'top_views',
  'recent_7d',
  'recent_24h',
  'last_6m',
];

/** 与抓取脚本一致：窄窗口优先占坑，合并展示前去掉跨分类重复 */
const DEDUPE_PICK_ORDER = [
  'youtube_recent_3d',
  'youtube_recent_24h',
  'youtube_recent_30d',
  'youtube_top_views',
  'bilibili_recent_3d',
  'bilibili_recent_24h',
  'bilibili_recent_30d',
  'bilibili_top_views',
];

/** 历史 24h 桶映射到当前 3d 键，供分类回退读取 */
const LEGACY_CATEGORY_ALIASES = {
  youtube_recent_3d: ['youtube_recent_3d', 'youtube_recent_24h'],
  bilibili_recent_3d: ['bilibili_recent_3d', 'bilibili_recent_24h'],
};

let videoDataPromise = null;
/** 默认按上传时间（最新）排序；平台内合并展示 */
let videoState = { platform: 'all', sort: 'recent', rawData: null };

function getCategoryKeys(batch) {
  if (!batch.categories) return [];
  const preferred = CATEGORY_ORDER.filter((key) => batch.categories[key]);
  if (preferred.length) return preferred;
  return Object.keys(batch.categories);
}

/** 同一视频只保留在优先级最高的分类中（3d > 30d > 100d） */
function dedupeBatchCategories(batch) {
  if (!batch?.categories) return batch;
  const claim = new Map();
  const pickOrder = [
    ...DEDUPE_PICK_ORDER.filter((k) => batch.categories[k]),
    ...Object.keys(batch.categories).filter((k) => !DEDUPE_PICK_ORDER.includes(k)),
  ];
  for (const key of pickOrder) {
    for (const v of batch.categories[key]?.videos || []) {
      if (v?.id && !claim.has(v.id)) claim.set(v.id, key);
    }
  }
  const categories = {};
  for (const key of getCategoryKeys(batch)) {
    const cat = batch.categories[key];
    categories[key] = {
      ...cat,
      videos: (cat.videos || []).filter((v) => v?.id && claim.get(v.id) === key),
    };
  }
  return { ...batch, categories };
}

function categoryVideosFromBatch(cats, key) {
  for (const alias of LEGACY_CATEGORY_ALIASES[key] || [key]) {
    const videos = cats?.[alias]?.videos || [];
    if (videos.length) return videos;
  }
  return cats?.[key]?.videos || [];
}

/**
 * 最新批次某分类为空时，向前找最近一个非空批次回填，并标记 fallback_from。
 */
function withCategoryFallback(batches) {
  if (!Array.isArray(batches) || !batches.length) return null;
  const latest = batches[0];
  if (!latest?.categories) return latest;

  const categories = {};
  let fallbackCount = 0;
  for (const key of Object.keys(latest.categories)) {
    const cat = latest.categories[key] || {};
    const videos = cat.videos || [];
    if (videos.length) {
      categories[key] = { ...cat, videos: [...videos] };
      continue;
    }
    let filled = null;
    let fromDate = null;
    for (let i = 1; i < batches.length; i += 1) {
      const prevVideos = categoryVideosFromBatch(batches[i]?.categories || {}, key);
      if (prevVideos.length) {
        filled = prevVideos;
        fromDate = batches[i].date || null;
        break;
      }
    }
    if (filled) {
      fallbackCount += 1;
      categories[key] = {
        ...cat,
        videos: filled.map((v) => ({ ...v })),
        fallback_from: fromDate,
      };
    } else {
      categories[key] = { ...cat, videos: [] };
    }
  }
  return { ...latest, categories, _fallback_count: fallbackCount };
}

function extRel() {
  return window.BioAI?.externalRel ? window.BioAI.externalRel() : 'noopener noreferrer';
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
  const unique = dedupeBatchCategories(batch);
  if (unique.categories) {
    return getCategoryKeys(unique).flatMap((key) => unique.categories[key]?.videos || []);
  }
  return unique.videos || [];
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

function renderVideoCard(v, { compact = false, reveal = true } = {}) {
  const hot = v.views >= HOT_VIEWS_THRESHOLD;
  const track = compact ? 'home-video-click' : 'video-click';
  const platform = platformLabel(v);
  const thumbPolicy = isBilibiliVideo(v) ? ' referrerpolicy="no-referrer"' : '';
  const thumbSrc = v.thumbnail || '';
  const author = v.author || v.channel || '未知作者';
  const published = formatPublishDate(v.published_at);
  // 虚拟列表已移除：卡片随页面自然滚动展示
  const revealClass = reveal ? ' reveal' : '';
  return `
    <article class="video-card${revealClass}${compact ? ' video-card-compact' : ''}">
      <a class="video-thumb" href="${escapeHtml(v.url)}" target="_blank" rel="${extRel()}" data-track="${track}">
        <img src="${escapeHtml(thumbSrc)}" alt="${escapeHtml(v.title)}" loading="lazy" decoding="async" width="640" height="360"${thumbPolicy}>
        <span class="content-type-badge content-type-video" aria-hidden="true">视频</span>
        <span class="video-play-btn" aria-hidden="true">▶ 观看</span>
        ${v.duration ? `<span class="video-duration">${escapeHtml(v.duration)}</span>` : ''}
        <span class="video-quality">${v.max_height}p</span>
        <span class="video-platform video-platform-${v.platform || 'youtube'}">${escapeHtml(platform)}</span>
        ${hot ? '<span class="video-hot">热门</span>' : ''}
      </a>
      <div class="video-body">
        <h4><a href="${escapeHtml(v.url)}" target="_blank" rel="${extRel()}" data-track="${track}">${escapeHtml(v.title)}</a></h4>
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
    list = list.filter((v) => videoPlatform(v) === platform);
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
  return `<div class="video-grid" data-video-grid="single">${videos.map((v) => renderVideoCard(v)).join('')}</div>`;
}

function renderPlatformBlock(label, key, videos) {
  if (!videos.length) {
    return `<div class="video-category video-category-empty"><h4 class="video-category-title">${escapeHtml(label)}</h4><p class="loading-hint">暂无该平台推荐</p></div>`;
  }
  return `
    <div class="video-category">
      <h4 class="video-category-title">${escapeHtml(label)} <span class="video-day-count">${videos.length} 条</span></h4>
      <div class="video-grid" data-video-grid="${escapeHtml(key)}">${videos.map((v) => renderVideoCard(v)).join('')}</div>
    </div>
  `;
}

/** 合并各时间窗视频后按平台分组展示；默认按上传时间倒序 */
function renderBatch(batch, state) {
  const flat = flattenLatestVideos(batch);
  const sortLabel = state.sort === 'recent' ? '按上传时间' : '按播放量';
  const fallbackNote = batch._fallback_count
    ? `<p class="video-fallback-note">有 ${batch._fallback_count} 组来源今日为空，已用上一有效批次补齐。</p>`
    : '';

  if (state.platform !== 'all') {
    const filtered = filterAndSortVideos(flat, state);
    const platformLabelText = state.platform === 'bilibili' ? 'B站' : 'YouTube';
    return {
      html: `
      <section class="video-day">
        <h3 class="video-day-title">${escapeHtml(batch.date)} · ${platformLabelText} · ${sortLabel}
          <span class="video-day-count">${filtered.length} 条</span>
        </h3>
        ${fallbackNote}
        ${renderFilteredGrid(filtered)}
      </section>
    `,
      groups: [{ key: 'single', items: filtered }],
    };
  }

  const youtube = filterAndSortVideos(flat, { platform: 'youtube', sort: state.sort });
  const bilibili = filterAndSortVideos(flat, { platform: 'bilibili', sort: state.sort });
  const total = youtube.length + bilibili.length;

  return {
    html: `
    <section class="video-day">
      <h3 class="video-day-title">${escapeHtml(batch.date)} · ${sortLabel}
        <span class="video-day-count">${total} 条</span>
      </h3>
      ${fallbackNote}
      ${renderPlatformBlock('YouTube', 'youtube', youtube)}
      ${renderPlatformBlock('B站', 'bilibili', bilibili)}
    </section>
  `,
    groups: [
      { key: 'youtube', items: youtube },
      { key: 'bilibili', items: bilibili },
    ],
  };
}

function paintVideoList() {
  const root = document.getElementById('daily-video-list');
  if (!root || !videoState.rawData) return;
  const batches = videoState.rawData.batches || [];
  const latest = withCategoryFallback(batches);
  if (!latest) {
    root.innerHTML = '<p class="loading-hint">暂无视频数据，每日北京时间 0:00 自动更新。</p>';
    return;
  }
  const painted = renderBatch(latest, videoState);
  root.innerHTML = painted.html;
  if (typeof window.refreshScrollReveal === 'function') window.refreshScrollReveal(root);
}

function fetchVideoData() {
  if (!videoDataPromise) {
    if (!window.BioAI?.fetchJson) {
      return Promise.reject(new Error('加载器未就绪，请稍后重试'));
    }
    videoDataPromise = window.BioAI.fetchJson(VIDEO_JSON, { label: '视频' }).catch(() =>
      window.BioAI.fetchJson(VIDEO_JSON_FALLBACK, {
        label: '视频',
        memoKey: VIDEO_JSON_FALLBACK,
      }),
    );
  }
  return videoDataPromise;
}

function resetVideoFetch() {
  window.BioAI?.invalidateFetch?.(VIDEO_JSON);
  window.BioAI?.invalidateFetch?.(VIDEO_JSON_FALLBACK);
  videoDataPromise = null;
}

function initVideoToolbar() {
  const toolbar = document.getElementById('video-toolbar');
  if (!toolbar || toolbar.dataset.bound === '1') return;
  toolbar.dataset.bound = '1';

  toolbar.querySelectorAll('[data-video-platform]').forEach((btn) => {
    btn.addEventListener('click', () => {
      toolbar.querySelectorAll('[data-video-platform]').forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      videoState.platform = btn.dataset.videoPlatform;
      paintVideoList();
      if (typeof trackEvent === 'function')
        trackEvent('video-filter-platform', { platform: videoState.platform });
    });
  });

  toolbar.querySelectorAll('[data-video-sort]').forEach((btn) => {
    btn.addEventListener('click', () => {
      toolbar.querySelectorAll('[data-video-sort]').forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      videoState.sort = btn.dataset.videoSort;
      paintVideoList();
      if (typeof trackEvent === 'function')
        trackEvent('video-filter-sort', { sort: videoState.sort });
    });
  });

  toolbar.querySelectorAll('[data-video-platform], [data-video-sort]').forEach((btn) => {
    btn.setAttribute('aria-pressed', btn.classList.contains('active') ? 'true' : 'false');
  });
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

    const display = withCategoryFallback(batches);
    if (meta && data.updated_at) {
      const updated = new Date(data.updated_at);
      const day = display?.date ? ` · 推荐日期 ${display.date}` : '';
      const fallbackNote = display?._fallback_count
        ? ` · ${display._fallback_count} 组来源已回退至上一有效批次`
        : '';
      meta.textContent = `最近更新：${updated.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}（北京时间）${day} · YouTube / B站合并展示 · 默认按上传时间${fallbackNote}`;
    }

    paintVideoList();
    initVideoToolbar();
  } catch (err) {
    root.innerHTML = window.BioAI?.renderErrorBlock
      ? window.BioAI.renderErrorBlock(err.message || '加载失败')
      : `<p class="loading-hint error-hint">${escapeHtml(err.message)}</p>`;
    window.BioAI?.bindRetry?.(root, () => {
      resetVideoFetch();
      loadDailyVideos();
    });
  }
}

function bootVideos() {
  loadDailyVideos();
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootVideos);
} else {
  bootVideos();
}

// 供单测 / 调试（不依赖 DOM）
if (typeof window !== 'undefined') {
  window.__videoHelpers = { withCategoryFallback };
}
