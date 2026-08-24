/* 粘贴链接 → 视频/频道预览卡片（封面或页面截图，不下载文件） */
(function initVideoPreview() {
  const form = document.getElementById('video-preview-form');
  const input = document.getElementById('video-url-input');
  const list = document.getElementById('daily-video-list');
  const statusEl = document.getElementById('video-preview-status');
  if (!form || !input || !list) return;

  const vp = window.BioAI?.videoPreview;
  if (!vp) return;

  const { loadHistory, saveHistory, renderCard, updateItem } = vp;

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
    return `https://image.thum.io/get/width/1280/crop/800/noanimate/${encodeURIComponent(url)}`;
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

  function renderList(items) {
    if (!items.length) {
      list.innerHTML =
        '<p class="daily-empty">还没有保存的链接。粘贴 YouTube / B站 地址后点「保存」。</p>';
      return;
    }
    list.innerHTML = `<div class="video-grid">${items.map(renderCard).join('')}</div>`;
  }

  function persistMessage(title, cloudOk) {
    if (cloudOk) return `已云端永久保存：${title}`;
    const hasApi = Boolean(window.BioAI?.videoPreviewSync?.getApiUrl?.());
    return hasApi
      ? `已保存在本机：${title}（云端上传失败，请稍后重试）`
      : `已保存在本浏览器：${title}`;
  }

  async function addUrl(raw) {
    const url = normalizeUrl(raw);
    if (!url) {
      setStatus('请输入有效的 http(s) 链接。', true);
      input.focus();
      return;
    }

    const draft = draftItemFromUrl(url);
    let next = upsertHistory(draft);
    renderList(next);
    input.value = '';
    setStatus('正在保存到云端…', false);
    form.querySelector('button[type="submit"]')?.setAttribute('disabled', '');

    let cloudOk = false;
    try {
      const cloud = await window.BioAI?.videoPreviewSync?.ensureCloudSaved?.({
        onMerged: (items) => renderList(items),
      });
      cloudOk = Boolean(cloud?.ok);
    } catch {
      cloudOk = false;
    }

    try {
      const item = await resolvePreview(url);
      item.pending = false;
      next = upsertHistory(item);
      renderList(next);
      // 封面完善后再推一次，保证云端是完整卡片
      try {
        const again = await window.BioAI?.videoPreviewSync?.ensureCloudSaved?.();
        if (again?.ok) cloudOk = true;
      } catch {
        /* keep prior cloudOk */
      }
      setStatus(persistMessage(item.title, cloudOk), !cloudOk && Boolean(window.BioAI?.videoPreviewSync?.getApiUrl?.()));
      if (typeof trackEvent === 'function') {
        trackEvent('video_preview_submit', {
          platform: item.platform,
          kind: item.kind,
          cloud: cloudOk ? 1 : 0,
          funnel_step: 2,
        });
      }
    } catch (_err) {
      setStatus(
        cloudOk ? '已云端永久保存（封面未完成，可稍后刷新）。' : '链接已写入本机；云端或封面失败。',
        !cloudOk,
      );
    } finally {
      form.querySelector('button[type="submit"]')?.removeAttribute('disabled');
    }
  }

  function removeUrl(url) {
    const next = loadHistory().filter((x) => x.url !== url);
    saveHistory(next);
    renderList(next);
    setStatus(next.length ? '已删除该链接。' : '已清空全部链接。', false);
    window.BioAI?.videoPreviewSync?.ensureCloudSaved?.().catch(() => {});
    if (typeof trackEvent === 'function') {
      trackEvent('video_preview_remove', { funnel_step: 2 });
    }
  }

  async function editUrl(url) {
    const items = loadHistory();
    const item = items.find((x) => x.url === url);
    if (!item) return;
    const nextTitle = window.prompt('编辑显示标题', item.title || '');
    if (nextTitle == null) return;
    const title = String(nextTitle).trim();
    if (!title) {
      setStatus('标题不能为空。', true);
      return;
    }
    const next = updateItem(url, { title, pending: false });
    if (!next) return;
    renderList(next);
    let cloudOk = false;
    try {
      const cloud = await window.BioAI?.videoPreviewSync?.ensureCloudSaved?.();
      cloudOk = Boolean(cloud?.ok);
    } catch {
      /* ignore */
    }
    setStatus(persistMessage(title, cloudOk), !cloudOk && Boolean(window.BioAI?.videoPreviewSync?.getApiUrl?.()));
    if (typeof trackEvent === 'function') {
      trackEvent('video_preview_edit', { funnel_step: 2 });
    }
  }

  function draftItemFromUrl(url) {
    const yt = parseYouTubeId(url);
    const channel = parseYouTubeChannel(url);
    const bv = parseBilibiliId(url);
    if (yt) {
      return {
        url,
        title: `YouTube 视频 ${yt}`,
        author: '',
        thumbnail: youtubeThumb(yt),
        description: '',
        platform: 'youtube',
        kind: 'video',
        id: yt,
        pending: true,
        resolved_at: new Date().toISOString(),
      };
    }
    if (channel) {
      const id = channel.handle || channel.id || url;
      return {
        url,
        title: channel.handle ? `YouTube 频道 ${channel.handle}` : `YouTube 频道 ${id}`,
        author: '',
        thumbnail: pageScreenshot(url),
        description: '',
        platform: 'youtube',
        kind: 'channel',
        id,
        pending: true,
        resolved_at: new Date().toISOString(),
      };
    }
    if (bv) {
      return {
        url,
        title: `B站视频 ${bv}`,
        author: '',
        thumbnail: '',
        description: '',
        platform: 'bilibili',
        kind: 'video',
        id: bv,
        pending: true,
        resolved_at: new Date().toISOString(),
      };
    }
    return {
      url,
      title: url,
      author: '',
      thumbnail: pageScreenshot(url),
      description: '',
      platform: 'web',
      kind: 'page',
      id: url,
      pending: true,
      resolved_at: new Date().toISOString(),
    };
  }

  function upsertHistory(item) {
    const prev = loadHistory().filter((x) => x.url !== item.url);
    const next = [item, ...prev].slice(0, vp.MAX_HISTORY);
    saveHistory(next);
    return next;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    addUrl(input.value);
  });

  list.addEventListener('click', (e) => {
    const editBtn = e.target.closest('[data-edit-url]');
    if (editBtn && list.contains(editBtn)) {
      e.preventDefault();
      e.stopPropagation();
      const url = editBtn.getAttribute('data-edit-url');
      if (url) editUrl(url);
      return;
    }
    const btn = e.target.closest('[data-remove-url]');
    if (!btn || !list.contains(btn)) return;
    e.preventDefault();
    e.stopPropagation();
    const url = btn.getAttribute('data-remove-url');
    if (url && window.confirm('确定删除这条链接？')) removeUrl(url);
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

  window.BioAI?.videoPreviewSync?.bootPage({
    onMerged: (items) => renderList(items),
  });
})();
