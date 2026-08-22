/* 粘贴链接 → 视频/频道预览卡片（封面或页面截图，不下载文件） */
(function initVideoPreview() {
  const form = document.getElementById('video-preview-form');
  const input = document.getElementById('video-url-input');
  const list = document.getElementById('daily-video-list');
  const statusEl = document.getElementById('video-preview-status');
  if (!form || !input || !list) return;

  const HISTORY_KEY = 'bioai.video.preview.v2';
  const MAX_HISTORY = 12;

  function escapeHtml(s) {
    return window.BioAI?.escapeHtml ? window.BioAI.escapeHtml(s) : String(s ?? '');
  }

  function extRel() {
    return window.BioAI?.externalRel ? window.BioAI.externalRel() : 'noopener noreferrer';
  }

  function setStatus(msg, isError) {
    if (!statusEl) return;
    statusEl.textContent = msg || '';
    statusEl.classList.toggle('is-error', Boolean(isError));
  }

  function normalizeUrl(raw) {
    const trimmed = String(raw || '').trim();
    if (!trimmed) return '';
    try {
      const u = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
      return u.href;
    } catch {
      return '';
    }
  }

  function parseYouTubeId(url) {
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, '');
      if (host === 'youtu.be') {
        return u.pathname.split('/').filter(Boolean)[0] || '';
      }
      if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
        if (u.searchParams.get('v')) return u.searchParams.get('v');
        const parts = u.pathname.split('/').filter(Boolean);
        if (parts[0] === 'shorts' || parts[0] === 'embed' || parts[0] === 'live') {
          return parts[1] || '';
        }
      }
    } catch {
      /* ignore */
    }
    return '';
  }

  /** @returns {{ handle?: string, id?: string } | null} */
  function parseYouTubeChannel(url) {
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, '');
      if (!(host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com')) {
        return null;
      }
      if (u.searchParams.get('v')) return null;
      const parts = u.pathname.split('/').filter(Boolean);
      if (!parts.length) return null;
      if (parts[0].startsWith('@')) return { handle: parts[0] };
      if (parts[0] === 'channel' && parts[1]) return { id: parts[1] };
      if ((parts[0] === 'c' || parts[0] === 'user') && parts[1]) return { handle: parts[1] };
    } catch {
      /* ignore */
    }
    return null;
  }

  function parseBilibiliId(url) {
    try {
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, '');
      if (!/(^|\.)bilibili\.com$/.test(host) && host !== 'b23.tv') return '';
      const m = u.pathname.match(/\/video\/(BV[\w]+)/i) || u.pathname.match(/\/(BV[\w]+)/i);
      if (m) return m[1];
      const av = u.pathname.match(/\/video\/(av\d+)/i);
      if (av) return av[1];
    } catch {
      /* ignore */
    }
    return '';
  }

  function youtubeThumb(id) {
    return `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`;
  }

  /** 第三方页面截图（频道 / 非视频页）；img 直链，无需 CORS */
  function pageScreenshot(url) {
    return `https://image.thum.io/get/width/1280/crop/800/noanimate/${url}`;
  }

  async function fetchMicrolink(url) {
    // YouTube 在免费档常触发 antibot，跳过以免白等
    try {
      const host = new URL(url).hostname.replace(/^www\./, '');
      if (host.includes('youtube.com') || host === 'youtu.be') return null;
    } catch {
      return null;
    }
    const endpoint = `https://api.microlink.io/?${new URLSearchParams({
      url,
      screenshot: 'true',
      meta: 'true',
    }).toString()}`;
    const res = await fetch(endpoint, { credentials: 'omit' });
    if (!res.ok) return null;
    const json = await res.json();
    if (json?.status !== 'success' || !json.data) return null;
    const d = json.data;
    return {
      title: d.title || '',
      author: d.publisher || d.author || '',
      thumbnail: d.screenshot?.url || d.image?.url || '',
      description: d.description || '',
    };
  }

  function loadHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      const arr = raw ? JSON.parse(raw) : [];
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

  async function resolvePreview(url) {
    const yt = parseYouTubeId(url);
    const channel = parseYouTubeChannel(url);
    const bv = parseBilibiliId(url);
    let title = '';
    let author = '';
    let thumbnail = '';
    let description = '';
    let kind = 'page';
    let platform = 'web';
    let id = url;

    if (yt) {
      kind = 'video';
      platform = 'youtube';
      id = yt;
      thumbnail = youtubeThumb(yt);
      title = `YouTube 视频 ${yt}`;
    } else if (channel) {
      kind = 'channel';
      platform = 'youtube';
      id = channel.handle || channel.id || url;
      title = channel.handle
        ? `YouTube 频道 ${channel.handle}`
        : `YouTube 频道 ${channel.id || ''}`.trim();
      setStatus('正在生成频道页面截图…', false);
    } else if (bv) {
      kind = 'video';
      platform = 'bilibili';
      id = bv;
      title = `B站视频 ${bv}`;
    } else {
      kind = 'page';
      setStatus('正在生成页面截图…', false);
    }

    if (kind === 'video') {
      try {
        const oembedUrl = `https://noembed.com/embed?url=${encodeURIComponent(url)}`;
        const res = await fetch(oembedUrl, { credentials: 'omit' });
        if (res.ok) {
          const data = await res.json();
          if (data && !data.error) {
            if (data.title) title = data.title;
            if (data.author_name) author = data.author_name;
            if (data.thumbnail_url) thumbnail = data.thumbnail_url;
          }
        }
      } catch {
        /* ignore */
      }
      if (!thumbnail && yt) thumbnail = youtubeThumb(yt);
    } else {
      // 频道 / 普通网页：YouTube 频道直接用 thum.io 截图；其它站点可尝试 Microlink
      if (kind === 'channel' || platform === 'youtube') {
        thumbnail = pageScreenshot(url);
      } else {
        try {
          const meta = await fetchMicrolink(url);
          if (meta) {
            if (meta.title) title = meta.title;
            if (meta.author) author = meta.author;
            if (meta.thumbnail) thumbnail = meta.thumbnail;
            if (meta.description) description = meta.description;
          }
        } catch {
          /* ignore */
        }
        if (!thumbnail) thumbnail = pageScreenshot(url);
      }
    }

    if (!title) title = url;

    return {
      url,
      title,
      author,
      thumbnail,
      description,
      platform,
      kind,
      id,
      resolved_at: new Date().toISOString(),
    };
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

  function renderList(items) {
    if (!items.length) {
      list.innerHTML =
        '<p class="loading-hint">还没有预览。粘贴视频或频道链接，点「生成预览」。</p>';
      return;
    }
    list.innerHTML = `<div class="video-grid">${items.map(renderCard).join('')}</div>`;
  }

  function removeUrl(url) {
    const next = loadHistory().filter((x) => x.url !== url);
    saveHistory(next);
    renderList(next);
    setStatus(next.length ? '已删除该链接。' : '已清空全部预览。', false);
    if (typeof trackEvent === 'function') {
      trackEvent('video_preview_remove', { funnel_step: 2 });
    }
  }

  async function addUrl(raw) {
    const url = normalizeUrl(raw);
    if (!url) {
      setStatus('请输入有效的 http(s) 链接。', true);
      input.focus();
      return;
    }
    setStatus('正在生成预览…', false);
    form.querySelector('button[type="submit"]')?.setAttribute('disabled', '');
    try {
      const item = await resolvePreview(url);
      const prev = loadHistory().filter((x) => x.url !== item.url);
      const next = [item, ...prev].slice(0, MAX_HISTORY);
      saveHistory(next);
      renderList(next);
      setStatus(
        item.kind === 'channel' || item.kind === 'page'
          ? `已生成页面截图：${item.title}`
          : `已生成预览：${item.title}`,
        false,
      );
      input.value = '';
      if (typeof trackEvent === 'function') {
        trackEvent('video_preview_submit', {
          platform: item.platform,
          kind: item.kind,
          funnel_step: 2,
        });
      }
    } catch (_err) {
      setStatus('预览失败，请检查链接是否可公开访问。', true);
    } finally {
      form.querySelector('button[type="submit"]')?.removeAttribute('disabled');
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    addUrl(input.value);
  });

  list.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove-url]');
    if (!btn || !list.contains(btn)) return;
    e.preventDefault();
    e.stopPropagation();
    const url = btn.getAttribute('data-remove-url');
    if (url) removeUrl(url);
  });

  const params = new URLSearchParams(location.search);
  const seed = params.get('url') || params.get('v');
  const history = loadHistory();
  renderList(history);
  if (seed) {
    input.value = seed;
    addUrl(seed);
  } else if (!history.length) {
    setStatus('', false);
  }
})();
