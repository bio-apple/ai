/** 视频预览：localStorage 与首页 / 视频页共用 */
(function initVideoPreviewLib() {
  const HISTORY_KEY = 'bioai.video.preview.v2';
  const LEGACY_HISTORY_KEYS = ['bioai.video.preview.v1'];
  const MAX_HISTORY = 12;
  const HOME_PREVIEW_MAX = 4;

  function escapeHtml(s) {
    return window.BioAI?.escapeHtml ? window.BioAI.escapeHtml(s) : String(s ?? '');
  }

  function extRel() {
    return window.BioAI?.externalRel ? window.BioAI.externalRel() : 'noopener noreferrer';
  }

  function loadHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      let arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr) || !arr.length) {
        for (const legacyKey of LEGACY_HISTORY_KEYS) {
          const legacyRaw = localStorage.getItem(legacyKey);
          if (!legacyRaw) continue;
          try {
            const legacy = JSON.parse(legacyRaw);
            if (Array.isArray(legacy) && legacy.length) {
              arr = legacy;
              saveHistory(arr);
              localStorage.removeItem(legacyKey);
              break;
            }
          } catch {
            /* ignore bad legacy */
          }
        }
      }
      return Array.isArray(arr) ? arr.filter((x) => x && x.url) : [];
    } catch {
      return [];
    }
  }

  function saveHistory(items) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY)));
    } catch {
      /* ignore quota */
    }
  }

  function renderCard(item) {
    const plat =
      item.platform === 'bilibili' ? 'B站' : item.platform === 'youtube' ? 'YouTube' : '链接';
    const typeLabel = item.kind === 'channel' ? '频道' : item.kind === 'video' ? '视频' : '页面';
    const thumb = item.thumbnail
      ? `<img src="${escapeHtml(item.thumbnail)}" alt="" width="640" height="360" loading="lazy" decoding="async" referrerpolicy="no-referrer" />`
      : `<span class="video-thumb-empty">暂无封面</span>`;
    return `<article class="video-card video-preview-card" data-preview-url="${escapeHtml(item.url)}">
      <a class="video-thumb" href="${escapeHtml(item.url)}" target="_blank" rel="${extRel()}" data-track="video-preview-open">
        ${thumb}
        <span class="video-play-badge" aria-hidden="true">▶</span>
        <span class="content-type-badge" data-type="video">${escapeHtml(typeLabel)}</span>
        <span class="video-platform-badge">${escapeHtml(plat)}</span>
      </a>
      <div class="video-info">
        <div class="video-info-top">
          <a class="video-title" href="${escapeHtml(item.url)}" target="_blank" rel="${extRel()}" data-track="video-preview-open">${escapeHtml(item.title)}</a>
          <button type="button" class="video-preview-remove" data-remove-url="${escapeHtml(item.url)}" aria-label="删除此链接" title="删除" data-track="video-preview-remove">删除</button>
        </div>
        ${item.author ? `<p class="video-channel">${escapeHtml(item.author)}</p>` : ''}
        ${item.description ? `<p class="video-preview-desc">${escapeHtml(item.description)}</p>` : ''}
        <p class="video-preview-url">${escapeHtml(item.url)}</p>
      </div>
    </article>`;
  }

  function renderHomeTeaser(item) {
    const plat =
      item.platform === 'bilibili' ? 'B站' : item.platform === 'youtube' ? 'YouTube' : '链接';
    const thumb = item.thumbnail
      ? `<img src="${escapeHtml(item.thumbnail)}" alt="" width="320" height="180" loading="lazy" decoding="async" referrerpolicy="no-referrer" />`
      : `<span class="home-video-teaser-empty">无封面</span>`;
    return `<li>
      <a class="home-video-teaser" href="${escapeHtml(item.url)}" target="_blank" rel="${extRel()}" data-track="home-video-click" title="${escapeHtml(item.title)}">
        <span class="home-video-teaser-thumb">${thumb}<span class="home-video-teaser-play" aria-hidden="true">▶</span></span>
        <span class="home-video-teaser-body">
          <span class="home-video-teaser-title">${escapeHtml(item.title)}</span>
          <span class="home-video-teaser-meta">${escapeHtml(plat)}${item.author ? ` · ${escapeHtml(item.author)}` : ''}</span>
        </span>
      </a>
    </li>`;
  }

  function renderHomeList(container, maxItems) {
    if (!container) return;
    const limit = typeof maxItems === 'number' ? maxItems : HOME_PREVIEW_MAX;
    const all = loadHistory();
    const items = all.slice(0, limit);
    if (!items.length) {
      container.innerHTML =
        '<p class="daily-empty">还没有预览。去视频页粘贴 YouTube / B站链接。</p>';
      return;
    }
    const more =
      all.length > limit
        ? `<p class="home-video-more-hint">共 ${all.length} 条，视频页可管理全部。</p>`
        : '';
    container.innerHTML = `<ul class="home-video-teasers">${items.map(renderHomeTeaser).join('')}</ul>${more}`;
  }

  window.BioAI = window.BioAI || {};
  window.BioAI.videoPreview = {
    HISTORY_KEY,
    LEGACY_HISTORY_KEYS,
    MAX_HISTORY,
    HOME_PREVIEW_MAX,
    escapeHtml,
    extRel,
    loadHistory,
    saveHistory,
    renderCard,
    renderHomeList,
  };
})();
