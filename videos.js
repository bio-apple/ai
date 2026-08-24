/* 粘贴链接 → 视频/频道预览卡片（封面或页面截图，不下载文件） */
(function initVideoPreview() {
  const form = document.getElementById('video-preview-form');
  const input = document.getElementById('video-url-input');
  const list = document.getElementById('daily-video-list');
  const statusEl = document.getElementById('video-preview-status');
  const recoverRow = document.getElementById('video-preview-recover');
  const recoverUrlInput = document.getElementById('video-recover-url');
  const copyRecoverBtn = document.getElementById('video-copy-recover-link');
  if (!form || !input || !list) return;

  const vp = window.BioAI?.videoPreview;
  if (!vp) return;

  const { loadHistory, saveHistory, renderCard, updateItem } = vp;

  function setStatus(msg, isError) {
    if (!statusEl) return;
    statusEl.textContent = msg || '';
    statusEl.classList.toggle('is-error', Boolean(isError));
  }

  function updateRecoverLinkUi() {
    const sync = window.BioAI?.videoPreviewSync;
    if (
      sync?.usesSharedSyncKey?.() ||
      !recoverRow ||
      !sync?.getApiUrl?.() ||
      !sync?.isValidSyncKey?.(sync.getSyncKey?.())
    ) {
      if (recoverRow) recoverRow.hidden = true;
      if (recoverUrlInput) recoverUrlInput.value = '';
      return;
    }
    const share = sync.mirrorSyncToUrl?.() || sync.buildShareUrl?.();
    if (recoverUrlInput) recoverUrlInput.value = share || '';
    recoverRow.hidden = !share;
  }

  function cloudRestoreMessage(boot) {
    if (!boot || boot.reason === 'local') return '';
    const shared = window.BioAI?.videoPreviewSync?.usesSharedSyncKey?.();
    const count = boot.items?.length ?? loadHistory().length;
    if (boot.reason === 'pull_failed') {
      return shared
        ? '云端拉取失败，请检查网络后刷新。'
        : '恢复链接已识别，但云端拉取失败，请检查网络后刷新。';
    }
    if (boot.reason === 'no_api') {
      return '云端 API 未配置，无法拉取。';
    }
    if (boot.reason === 'shared' && count > 0) return `已从云端同步 ${count} 条链接。`;
    if (count > 0) return `已从云端恢复 ${count} 条链接。`;
    if (shared) return '已连接云端；保存链接后会自动同步到所有设备。';
    return '恢复链接已生效；云端暂无数据，保存后会自动同步。';
  }

  async function copyRecoverLink() {
    const sync = window.BioAI?.videoPreviewSync;
    const share = sync?.mirrorSyncToUrl?.() || sync?.buildShareUrl?.();
    if (!share) {
      setStatus('还没有恢复链接，请先保存一条链接。', true);
      return;
    }
    try {
      await navigator.clipboard.writeText(share);
      setStatus('恢复链接已复制。清除网站数据后，打开此链接即可找回列表。', false);
    } catch {
      setStatus(`请手动复制恢复链接：${share}`, false);
    }
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

  /** 经 Cloudflare Worker 抓取 og:image / 频道封面（替代已失效的 thum.io 免费截图） */
  async function fetchPreviewMeta(url) {
    const api = window.BioAI?.videoPreviewSync?.getApiUrl?.();
    if (!api) return null;
    try {
      const res = await fetch(`${api}/meta?${new URLSearchParams({ url })}`, {
        credentials: 'omit',
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data || data.error) return null;
      return data;
    } catch {
      return null;
    }
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
      try {
        const meta = await fetchPreviewMeta(url);
        if (meta) {
          if (meta.title) title = meta.title;
          if (meta.author) author = meta.author;
          if (meta.thumbnail) thumbnail = meta.thumbnail;
          if (meta.description) description = meta.description;
        }
      } catch {
        /* ignore */
      }
      if (!thumbnail && kind !== 'channel' && platform !== 'youtube') {
        try {
          const micro = await fetchMicrolink(url);
          if (micro) {
            if (micro.title) title = micro.title;
            if (micro.author) author = micro.author;
            if (micro.thumbnail) thumbnail = micro.thumbnail;
            if (micro.description) description = micro.description;
          }
        } catch {
          /* ignore */
        }
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
    const shared = window.BioAI?.videoPreviewSync?.usesSharedSyncKey?.();
    if (cloudOk) {
      return shared
        ? `已云端永久保存：${title}。其他设备打开视频页即可看到。`
        : `已云端永久保存：${title}。请收藏本页或复制下方恢复链接，换设备 / 清数据后打开即可恢复。`;
    }
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
      setStatus(
        persistMessage(item.title, cloudOk),
        !cloudOk && Boolean(window.BioAI?.videoPreviewSync?.getApiUrl?.()),
      );
      if (cloudOk) updateRecoverLinkUi();
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
    setStatus(
      persistMessage(title, cloudOk),
      !cloudOk && Boolean(window.BioAI?.videoPreviewSync?.getApiUrl?.()),
    );
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
        thumbnail: '',
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
      thumbnail: '',
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

  list.addEventListener(
    'error',
    (e) => {
      const img = e.target;
      if (!img?.matches?.('.video-thumb-img')) return;
      const span = document.createElement('span');
      span.className = 'video-thumb-empty';
      span.textContent = '暂无封面';
      img.replaceWith(span);
    },
    true,
  );

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
  const sync = window.BioAI?.videoPreviewSync;
  const usesShared = sync?.usesSharedSyncKey?.();
  const hasRecoverUrl = Boolean(params.get('sync') || params.get('s'));
  const willCloudLoad =
    usesShared ||
    hasRecoverUrl ||
    (sync?.getApiUrl?.() && sync?.isValidSyncKey?.(sync?.getSyncKey?.()));

  if (willCloudLoad && !loadHistory().length) {
    list.innerHTML = '<p class="daily-empty">正在从云端加载…</p>';
    setStatus(usesShared ? '正在从云端同步列表…' : '正在通过恢复链接同步云端列表…', false);
  } else {
    renderList(loadHistory());
  }

  copyRecoverBtn?.addEventListener('click', () => {
    copyRecoverLink();
  });

  (async () => {
    const boot = await sync?.bootPage?.({
      onMerged: (items) => renderList(items),
    });
    const items = loadHistory();
    renderList(items);
    updateRecoverLinkUi();
    const restoreMsg = cloudRestoreMessage(boot);
    if (restoreMsg) setStatus(restoreMsg, boot?.reason === 'pull_failed');
    else if (seed) {
      input.value = seed;
      addUrl(seed);
    } else if (!items.length) {
      setStatus('', false);
    }
  })();
})();
