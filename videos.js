const VIDEO_DATA_URL = 'daily-videos.json';
const HOT_VIEWS_THRESHOLD = 1_000_000;

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

function renderVideoCard(v, { compact = false } = {}) {
  const hot = v.views >= HOT_VIEWS_THRESHOLD;
  const track = compact ? 'home-video-click' : 'video-click';
  return `
    <article class="video-card${compact ? ' video-card-compact' : ''}">
      <a class="video-thumb" href="${escapeHtml(v.url)}" target="_blank" rel="noopener" data-track="${track}">
        <img src="${escapeHtml(v.thumbnail)}" alt="${escapeHtml(v.title)}" loading="lazy">
        <span class="video-play-btn" aria-hidden="true">▶ 观看</span>
        ${v.duration ? `<span class="video-duration">${escapeHtml(v.duration)}</span>` : ''}
        <span class="video-quality">${v.max_height}p</span>
        ${hot ? '<span class="video-hot">热门</span>' : ''}
      </a>
      <div class="video-body">
        <h4><a href="${escapeHtml(v.url)}" target="_blank" rel="noopener" data-track="${track}">${escapeHtml(v.title)}</a></h4>
        <p class="video-summary">${escapeHtml(formatSummary(v))}</p>
        <div class="video-meta">
          <span>${escapeHtml(v.channel)}</span>
          <span>订阅 ${formatNumber(v.subscribers)}</span>
          <span>播放 ${formatNumber(v.views)}</span>
        </div>
      </div>
    </article>
  `;
}

function renderBatch(batch) {
  const videos = batch.videos || [];
  if (!videos.length) return '';
  return `
    <section class="video-day">
      <h3 class="video-day-title">${escapeHtml(batch.date)} <span class="video-day-count">${videos.length} 条</span></h3>
      <div class="video-grid">${videos.map(v => renderVideoCard(v)).join('')}</div>
    </section>
  `;
}

async function fetchVideoData() {
  const res = await fetch(VIDEO_DATA_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error('无法加载视频数据');
  return res.json();
}

async function loadHomeVideoPreview() {
  const root = document.getElementById('home-video-preview');
  if (!root) return;

  try {
    const data = await fetchVideoData();
    const latest = (data.batches || [])[0];
    const videos = (latest?.videos || []).slice(0, 3);
    if (!videos.length) {
      root.innerHTML = '<p class="loading-hint">暂无视频，每日北京时间 0:00 自动更新。</p>';
      return;
    }
    root.innerHTML = `<div class="video-grid video-grid-preview">${videos.map(v => renderVideoCard(v, { compact: true })).join('')}</div>`;
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
    const batches = data.batches || [];

    if (!batches.length) {
      root.innerHTML = '<p class="loading-hint">暂无视频数据，每日北京时间 0:00 自动更新。</p>';
      return;
    }

    if (meta && data.updated_at) {
      const updated = new Date(data.updated_at);
      meta.textContent = `最近更新：${updated.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}（北京时间）· 每日 0:00 自动追加 ≥10 条 1080p AI 应用教程`;
    }

    root.innerHTML = batches.map(renderBatch).join('');
  } catch (err) {
    root.innerHTML = `<p class="loading-hint error-hint">${escapeHtml(err.message)}</p>`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadHomeVideoPreview();
  loadDailyVideos();
});
