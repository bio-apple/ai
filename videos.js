/* 粘贴链接 → 视频预览卡片（不下载文件） */
(function initVideoPreview() {
  const form = document.getElementById('video-preview-form');
  const input = document.getElementById('video-url-input');
  const list = document.getElementById('daily-video-list');
  const statusEl = document.getElementById('video-preview-status');
  if (!form || !input || !list) return;

  const HISTORY_KEY = 'bioai.video.preview.v1';
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

  function platformOf(url) {
    if (parseYouTubeId(url)) return 'youtube';
    if (parseBilibiliId(url)) return 'bilibili';
    return 'web';
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
    const bv = parseBilibiliId(url);
    let title = '';
    let author = '';
    let thumbnail = '';
    let provider = platformOf(url);

    if (yt) {
      thumbnail = youtubeThumb(yt);
      title = `YouTube 视频 ${yt}`;
      provider = 'youtube';
    } else if (bv) {
      title = `B站视频 ${bv}`;
      provider = 'bilibili';
    }

    try {
      const oembedUrl = `https://noembed.com/embed?url=${encodeURIComponent(url)}`;
      const res = await fetch(oembedUrl, { credentials: 'omit' });
      if (res.ok) {
        const data = await res.json();
        if (data && !data.error) {
          if (data.title) title = data.title;
          if (data.author_name) author = data.author_name;
          if (data.thumbnail_url) thumbnail = data.thumbnail_url;
          if (data.provider_name) {
            const p = String(data.provider_name).toLowerCase();
            if (p.includes('youtube')) provider = 'youtube';
            else if (p.includes('bilibili') || p.includes('哔哩')) provider = 'bilibili';
          }
        }
      }
    } catch {
      /* oEmbed 失败时仍可用本地解析的封面 */
    }

    if (!thumbnail && yt) thumbnail = youtubeThumb(yt);
    if (!title) title = url;

    return {
      url,
      title,
      author,
      thumbnail,
      platform: provider,
      id: yt || bv || url,
      resolved_at: new Date().toISOString(),
    };
  }

  function renderCard(item) {
    const plat =
      item.platform === 'bilibili' ? 'B站' : item.platform === 'youtube' ? 'YouTube' : '链接';
    const thumb = item.thumbnail
      ? `<img src="${escapeHtml(item.thumbnail)}" alt="" width="640" height="360" loading="lazy" decoding="async" referrerpolicy="no-referrer" />`
      : `<span class="video-thumb-empty">暂无封面</span>`;
    return `<article class="video-card video-preview-card">
      <a class="video-thumb" href="${escapeHtml(item.url)}" target="_blank" rel="${extRel()}" data-track="video-preview-open">
        ${thumb}
        <span class="video-play-badge" aria-hidden="true">▶</span>
        <span class="content-type-badge" data-type="video">视频</span>
        <span class="video-platform-badge">${escapeHtml(plat)}</span>
      </a>
      <div class="video-info">
        <a class="video-title" href="${escapeHtml(item.url)}" target="_blank" rel="${extRel()}" data-track="video-preview-open">${escapeHtml(item.title)}</a>
        ${item.author ? `<p class="video-channel">${escapeHtml(item.author)}</p>` : ''}
        <p class="video-preview-url">${escapeHtml(item.url)}</p>
      </div>
    </article>`;
  }

  function renderList(items) {
    if (!items.length) {
      list.innerHTML = '<p class="loading-hint">还没有预览。粘贴一条视频链接，点「生成预览」。</p>';
      return;
    }
    list.innerHTML = `<div class="video-grid">${items.map(renderCard).join('')}</div>`;
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
      setStatus(`已生成预览：${item.title}`, false);
      input.value = '';
      if (typeof trackEvent === 'function') {
        trackEvent('video_preview_submit', {
          platform: item.platform,
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
