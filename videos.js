const VIDEO_DATA_URL = 'daily-videos.json';

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

function renderVideoCard(v) {
  return `
    <article class="video-card">
      <a class="video-thumb" href="${escapeHtml(v.url)}" target="_blank" rel="noopener">
        <img src="${escapeHtml(v.thumbnail)}" alt="" loading="lazy">
        ${v.duration ? `<span class="video-duration">${escapeHtml(v.duration)}</span>` : ''}
        <span class="video-quality">${v.max_height}p</span>
      </a>
      <div class="video-body">
        <h4><a href="${escapeHtml(v.url)}" target="_blank" rel="noopener">${escapeHtml(v.title)}</a></h4>
        <p class="video-summary">${escapeHtml(v.summary)}</p>
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
      <div class="video-grid">${videos.map(renderVideoCard).join('')}</div>
    </section>
  `;
}

async function loadDailyVideos() {
  const root = document.getElementById('daily-video-list');
  const meta = document.getElementById('video-update-meta');
  if (!root) return;

  root.innerHTML = '<p class="loading-hint">加载视频推荐…</p>';

  try {
    const res = await fetch(VIDEO_DATA_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error('无法加载视频数据');
    const data = await res.json();
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

document.addEventListener('DOMContentLoaded', loadDailyVideos);
