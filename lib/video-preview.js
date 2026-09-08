/** 视频预览：localStorage 与视频页收藏共用 */
(function initVideoPreviewLib() {
  const HISTORY_KEY = 'bioai.video.preview.v2';
  const LEGACY_HISTORY_KEYS = ['bioai.video.preview.v1'];
  const MAX_HISTORY = 48;

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function extRel() {
    return 'noopener noreferrer ugc nofollow';
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
    const titleText = escapeHtml(item.title || item.url || '');
    const pending = Boolean(item.pending);
    const thumb = item.thumbnail
      ? `<img class="video-thumb-img" src="${escapeHtml(item.thumbnail)}" alt="${titleText}" width="640" height="360" loading="lazy" decoding="async" referrerpolicy="no-referrer" />`
      : `<span class="video-thumb-empty${pending ? ' video-thumb-pending' : ''}">${pending ? '加载封面…' : '暂无封面'}</span>`;
    const pendingAttr = pending ? ' data-pending="true" aria-busy="true"' : '';
    return `<article class="video-card video-preview-card" data-preview-url="${escapeHtml(item.url)}"${pendingAttr}>
      <a class="video-thumb" href="${escapeHtml(item.url)}" target="_blank" rel="${extRel()}" data-track="video-preview-open" aria-label="${titleText}（在新标签页打开）">
        ${thumb}
        <span class="video-play-badge" aria-hidden="true">▶</span>
        <span class="content-type-badge" data-type="video">${escapeHtml(typeLabel)}</span>
        <span class="video-platform-badge">${escapeHtml(plat)}</span>
      </a>
      <div class="video-info">
        <div class="video-info-top">
          <a class="video-title" href="${escapeHtml(item.url)}" target="_blank" rel="${extRel()}" data-track="video-preview-open">${escapeHtml(item.title)}</a>
          <div class="video-preview-actions">
            <button type="button" class="video-preview-edit" data-edit-url="${escapeHtml(item.url)}" aria-label="编辑标题" title="编辑" data-track="video-preview-edit">编辑</button>
            <button type="button" class="video-preview-remove" data-remove-url="${escapeHtml(item.url)}" aria-label="删除此链接" title="删除" data-track="video-preview-remove">删除</button>
          </div>
        </div>
        ${item.author ? `<p class="video-channel">${escapeHtml(item.author)}</p>` : ''}
        ${item.description ? `<p class="video-preview-desc">${escapeHtml(item.description)}</p>` : ''}
        <p class="video-preview-url">${escapeHtml(item.url)}</p>
      </div>
    </article>`;
  }

  function updateItem(url, patch) {
    const items = loadHistory();
    const idx = items.findIndex((x) => x && x.url === url);
    if (idx < 0) return null;
    const nextItem = {
      ...items[idx],
      ...patch,
      url: items[idx].url,
      resolved_at: new Date().toISOString(),
    };
    const next = [...items];
    next[idx] = nextItem;
    saveHistory(next);
    return next;
  }

  window.BioAI = window.BioAI || {};
  window.BioAI.videoPreview = {
    HISTORY_KEY,
    LEGACY_HISTORY_KEYS,
    MAX_HISTORY,
    escapeHtml,
    extRel,
    loadHistory,
    saveHistory,
    updateItem,
    renderCard,
  };
})();
