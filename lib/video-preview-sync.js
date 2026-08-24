/** 视频预览跨设备同步：同步码 + 云端 KV（可选）+ 导出/粘贴备份 */
(function initVideoPreviewSync() {
  const SYNC_KEY_STORAGE = 'bioai.video.syncKey';
  const UC_URL_STORAGE = 'bioai.video.uploadcareUrl';
  const PAYLOAD_PREFIX = 'BIOAI1:';
  const KEY_MIN = 8;
  const KEY_MAX = 48;
  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  function getConfig() {
    try {
      const el = document.getElementById('video-sync-config');
      if (el?.textContent) return JSON.parse(el.textContent);
    } catch {
      /* ignore */
    }
    return {};
  }

  function getApiUrl() {
    const raw = getConfig().api_url || '';
    return String(raw).replace(/\/$/, '');
  }

  function getUploadcarePublicKey() {
    return String(getConfig().uploadcare_public_key || '').trim();
  }

  function getUploadcareUrl() {
    return localStorage.getItem(UC_URL_STORAGE) || '';
  }

  function setUploadcareUrl(url) {
    const trimmed = String(url || '').trim();
    if (!trimmed) {
      localStorage.removeItem(UC_URL_STORAGE);
      return '';
    }
    localStorage.setItem(UC_URL_STORAGE, trimmed);
    return trimmed;
  }

  function parseUploadcareUuid(raw) {
    const s = String(raw || '').trim();
    if (!s) return '';
    if (UUID_RE.test(s)) return s.toLowerCase();
    try {
      const u = new URL(s.includes('://') ? s : `https://${s}`);
      const host = u.hostname.replace(/^www\./, '');
      if (host === 'ucarecdn.com' || host.endsWith('.ucarecdn.com')) {
        const part = u.pathname.split('/').filter(Boolean)[0] || '';
        if (UUID_RE.test(part)) return part.toLowerCase();
      }
    } catch {
      /* ignore */
    }
    const m = s.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );
    return m ? m[0].toLowerCase() : '';
  }

  function uploadcareCdnUrl(uuid) {
    return `https://ucarecdn.com/${uuid}/`;
  }

  /** 上传当前列表到 Uploadcare，返回 CDN URL（仅 Public Key，勿放 Secret） */
  async function uploadToUploadcare() {
    const publicKey = getUploadcarePublicKey();
    const vp = window.BioAI?.videoPreview;
    if (!publicKey) throw new Error('未配置 Uploadcare Public Key');
    if (!vp) throw new Error('预览模块未加载');

    const payload = {
      v: 1,
      exported_at: new Date().toISOString(),
      items: vp.loadHistory(),
    };
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    const form = new FormData();
    form.append('UPLOADCARE_PUB_KEY', publicKey);
    form.append('UPLOADCARE_STORE', '1');
    form.append('metadata[app]', 'bioai-video-preview');
    form.append('file', blob, 'bioai-video-preview.json');

    const res = await fetch('https://upload.uploadcare.com/base/', {
      method: 'POST',
      body: form,
      credentials: 'omit',
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Uploadcare 上传失败（${res.status}）${text ? `: ${text.slice(0, 120)}` : ''}`);
    }
    const json = await res.json();
    const uuid = json.file || json['bioai-video-preview.json'];
    if (!uuid || !UUID_RE.test(String(uuid))) {
      throw new Error('Uploadcare 返回异常，未得到文件 UUID');
    }
    const url = uploadcareCdnUrl(String(uuid));
    setUploadcareUrl(url);
    return { uuid: String(uuid), url };
  }

  async function pullFromUploadcare(rawUrl) {
    const vp = window.BioAI?.videoPreview;
    if (!vp) throw new Error('预览模块未加载');
    const uuid = parseUploadcareUuid(rawUrl || getUploadcareUrl());
    if (!uuid) throw new Error('请粘贴有效的 Uploadcare 链接或 UUID');

    const res = await fetch(uploadcareCdnUrl(uuid), {
      credentials: 'omit',
      headers: { Accept: 'application/json,text/plain,*/*' },
    });
    if (!res.ok) throw new Error(`拉取失败（${res.status}）`);
    const data = await res.json();
    const items = Array.isArray(data) ? data : data?.items;
    if (!Array.isArray(items)) throw new Error('备份内容不是有效的预览列表');
    const merged = mergeHistories(vp.loadHistory(), items);
    vp.saveHistory(merged);
    setUploadcareUrl(uploadcareCdnUrl(uuid));
    return merged;
  }

  function getSyncKey() {
    return localStorage.getItem(SYNC_KEY_STORAGE) || '';
  }

  function setSyncKey(key) {
    const trimmed = String(key || '').trim();
    if (!trimmed) {
      localStorage.removeItem(SYNC_KEY_STORAGE);
      return '';
    }
    localStorage.setItem(SYNC_KEY_STORAGE, trimmed);
    return trimmed;
  }

  function generateSyncKey() {
    const bytes = crypto.getRandomValues(new Uint8Array(12));
    return Array.from(bytes, (b) => b.toString(36).padStart(2, '0'))
      .join('')
      .replace(/[^a-z0-9]/gi, '')
      .slice(0, 12);
  }

  function isValidSyncKey(key) {
    const k = String(key || '').trim();
    return k.length >= KEY_MIN && k.length <= KEY_MAX && /^[\w-]+$/.test(k);
  }

  function mergeHistories(local, remote) {
    const vp = window.BioAI?.videoPreview;
    const max = vp?.MAX_HISTORY || 12;
    const byUrl = new Map();
    for (const item of [...(local || []), ...(remote || [])]) {
      if (!item?.url) continue;
      const prev = byUrl.get(item.url);
      if (!prev || String(item.resolved_at || '') > String(prev.resolved_at || '')) {
        byUrl.set(item.url, item);
      }
    }
    return [...byUrl.values()]
      .sort((a, b) => String(b.resolved_at || '').localeCompare(String(a.resolved_at || '')))
      .slice(0, max);
  }

  function encodePayload(items) {
    const json = JSON.stringify({ v: 1, items: items || [] });
    const b64 = btoa(unescape(encodeURIComponent(json)));
    return (
      PAYLOAD_PREFIX +
      b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    );
  }

  function decodePayload(str) {
    const trimmed = String(str || '').trim();
    if (!trimmed.startsWith(PAYLOAD_PREFIX)) {
      throw new Error('无效同步文本：请以 BIOAI1: 开头');
    }
    let b64 = trimmed.slice(PAYLOAD_PREFIX.length).replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const json = decodeURIComponent(escape(atob(b64)));
    const data = JSON.parse(json);
    if (!data || !Array.isArray(data.items)) throw new Error('同步文本格式错误');
    return data.items;
  }

  let pushTimer = null;
  function schedulePush() {
    if (!getApiUrl() || !getSyncKey()) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      pushToCloud().catch(() => {});
    }, 1200);
  }

  async function pushToCloud() {
    const api = getApiUrl();
    const key = getSyncKey();
    const vp = window.BioAI?.videoPreview;
    if (!api || !key || !vp) return false;
    const res = await fetch(`${api}/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vp.loadHistory()),
      credentials: 'omit',
    });
    return res.ok;
  }

  async function pullFromCloud() {
    const api = getApiUrl();
    const key = getSyncKey();
    const vp = window.BioAI?.videoPreview;
    if (!api || !key || !vp) return null;
    const res = await fetch(`${api}/${encodeURIComponent(key)}`, { credentials: 'omit' });
    if (!res.ok) return null;
    const remote = await res.json();
    if (!Array.isArray(remote)) return null;
    const merged = mergeHistories(vp.loadHistory(), remote);
    vp.saveHistory(merged);
    return merged;
  }

  function installSaveHook() {
    const vp = window.BioAI?.videoPreview;
    if (!vp || vp._syncHooked) return;
    vp._syncHooked = true;
    const orig = vp.saveHistory.bind(vp);
    vp.saveHistory = function saveHistoryWithSync(items) {
      orig(items);
      schedulePush();
    };
  }

  function exportBackupFile() {
    const vp = window.BioAI?.videoPreview;
    if (!vp) return;
    const blob = new Blob([JSON.stringify(vp.loadHistory(), null, 2)], {
      type: 'application/json',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `bioai-video-preview-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function importBackupFile(file) {
    const vp = window.BioAI?.videoPreview;
    if (!vp || !file) return Promise.reject(new Error('无文件'));
    return file.text().then((text) => {
      const data = JSON.parse(text);
      const items = Array.isArray(data) ? data : data?.items;
      if (!Array.isArray(items)) throw new Error('备份文件格式错误');
      const merged = mergeHistories(vp.loadHistory(), items);
      vp.saveHistory(merged);
      return merged;
    });
  }

  function buildShareUrl(key) {
    const k = String(key || getSyncKey() || '').trim();
    if (!isValidSyncKey(k)) return '';
    const u = new URL(window.location.href);
    u.searchParams.set('sync', k);
    u.hash = '';
    return u.toString();
  }

  function readSyncKeyFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search);
      const fromQuery = params.get('sync') || params.get('s') || '';
      if (isValidSyncKey(fromQuery)) return fromQuery.trim();
      const hash = window.location.hash.replace(/^#/, '');
      if (hash.startsWith('sync=')) {
        const k = decodeURIComponent(hash.slice(5));
        if (isValidSyncKey(k)) return k;
      }
    } catch {
      /* ignore */
    }
    return '';
  }

  function stripSyncFromUrl() {
    try {
      const u = new URL(window.location.href);
      if (!u.searchParams.has('sync') && !u.searchParams.has('s') && !u.hash.startsWith('#sync=')) {
        return;
      }
      u.searchParams.delete('sync');
      u.searchParams.delete('s');
      if (u.hash.startsWith('#sync=')) u.hash = '';
      window.history.replaceState({}, '', u.pathname + u.search + u.hash);
    } catch {
      /* ignore */
    }
  }

  /** 设备 B：打开分享链接即可自动绑定并拉取，无需手输同步码 */
  async function tryJoinFromShareUrl(hooks) {
    const fromUrl = readSyncKeyFromUrl();
    if (!fromUrl) return null;
    setSyncKey(fromUrl);
    const keyInput = document.getElementById('video-sync-key');
    if (keyInput) keyInput.value = fromUrl;
    const panel = document.getElementById('video-sync-panel');
    if (panel) panel.open = true;
    const statusEl = document.getElementById('video-sync-status');
    stripSyncFromUrl();

    if (!getApiUrl()) {
      setSyncStatus(
        statusEl,
        '已识别分享链接中的同步码；云端 API 未配置时请用导出/Uploadcare。',
        true,
      );
      return fromUrl;
    }

    setSyncStatus(statusEl, '正在通过分享链接同步…', false);
    try {
      const merged = await pullFromCloud();
      if (merged) {
        hooks?.onMerged?.(merged);
        setSyncStatus(
          statusEl,
          `已通过分享链接同步 ${merged.length} 条。下次打开本页无需再点链接。`,
          false,
        );
      } else {
        await pushToCloud();
        setSyncStatus(statusEl, '已绑定分享链接（云端暂无数据，本地列表将自动上传）。', false);
      }
    } catch {
      setSyncStatus(statusEl, '分享链接已保存，云端拉取失败，请稍后点「从云端拉取」。', true);
    }
    return fromUrl;
  }

  function setSyncStatus(el, msg, isError) {
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('is-error', Boolean(isError));
  }

  /** 云端已配置且尚无同步码时，自动生成并上传 */
  async function tryAutoEnsureSyncKey(hooks) {
    if (!getApiUrl() || getSyncKey()) return null;
    const key = generateSyncKey();
    setSyncKey(key);
    const keyInput = document.getElementById('video-sync-key');
    if (keyInput) keyInput.value = key;
    const panel = document.getElementById('video-sync-panel');
    if (panel && !panel.open) panel.open = true;
    const statusEl = document.getElementById('video-sync-status');
    setSyncStatus(
      statusEl,
      `已自动创建同步码。点「复制分享链接」发给其他设备，对方打开即可直接看，不用手输码。`,
      false,
    );
    try {
      await pushToCloud();
      const merged = await pullFromCloud();
      if (merged) hooks?.onMerged?.(merged);
    } catch {
      /* 本地已保存，云端稍后重试 */
    }
    return key;
  }

  function initPage(hooks) {
    installSaveHook();
    const panel = document.getElementById('video-sync-panel');
    if (!panel) return;

    const keyInput = document.getElementById('video-sync-key');
    const statusEl = document.getElementById('video-sync-status');
    const blobInput = document.getElementById('video-sync-blob');
    const ucUrlInput = document.getElementById('video-sync-uc-url');
    const hasCloud = Boolean(getApiUrl());
    const hasUploadcare = Boolean(getUploadcarePublicKey());

    if (keyInput) keyInput.value = getSyncKey();
    if (ucUrlInput) ucUrlInput.value = getUploadcareUrl();

    const cloudHint = panel.querySelector('[data-sync-cloud-hint]');
    if (cloudHint) {
      cloudHint.hidden = hasCloud || hasUploadcare;
    }

    // 优先处理分享链接：设备 B 打开即看
    tryJoinFromShareUrl(hooks).then((joined) => {
      if (joined) return;
      if (hasCloud && isValidSyncKey(getSyncKey())) {
        pullFromCloud()
          .then((merged) => {
            if (merged?.length) {
              hooks?.onMerged?.(merged);
              setSyncStatus(statusEl, `已自动从云端同步 ${merged.length} 条。`, false);
            }
          })
          .catch(() => {});
      }
    });

    document.getElementById('video-sync-generate')?.addEventListener('click', () => {
      if (keyInput) keyInput.value = generateSyncKey();
    });

    document.getElementById('video-sync-copy-share')?.addEventListener('click', async () => {
      let key = (keyInput?.value || getSyncKey() || '').trim();
      if (!isValidSyncKey(key)) {
        if (hasCloud) {
          key = generateSyncKey();
          setSyncKey(key);
          if (keyInput) keyInput.value = key;
          try {
            await pushToCloud();
          } catch {
            /* ignore */
          }
        } else {
          setSyncStatus(statusEl, '请先生成并保存同步码（或配置云端后自动生成）。', true);
          return;
        }
      } else {
        setSyncKey(key);
      }
      const share = buildShareUrl(key);
      if (!share) {
        setSyncStatus(statusEl, '无法生成分享链接。', true);
        return;
      }
      try {
        await navigator.clipboard.writeText(share);
        setSyncStatus(statusEl, `分享链接已复制。其他设备打开该链接即可直接看列表。`, false);
      } catch {
        if (blobInput) blobInput.value = share;
        setSyncStatus(statusEl, `请手动复制：${share}`, false);
      }
    });

    document.getElementById('video-sync-save-key')?.addEventListener('click', async () => {
      const key = keyInput?.value || '';
      if (!isValidSyncKey(key)) {
        setSyncStatus(statusEl, `同步码需 ${KEY_MIN}–${KEY_MAX} 位字母数字或连字符。`, true);
        return;
      }
      setSyncKey(key);
      setSyncStatus(statusEl, hasCloud ? '同步码已保存，正在与云端合并…' : '同步码已保存（请用下方导出/粘贴在其他设备恢复）。', false);
      if (hasCloud) {
        try {
          const merged = await pullFromCloud();
          if (merged) {
            hooks?.onMerged?.(merged);
            setSyncStatus(statusEl, `已与云端合并，共 ${merged.length} 条。`, false);
          } else {
            await pushToCloud();
            setSyncStatus(statusEl, '已上传到云端（首次同步）。', false);
          }
        } catch {
          setSyncStatus(statusEl, '云端同步失败，请稍后重试或使用导出备份。', true);
        }
      }
    });

    document.getElementById('video-sync-pull')?.addEventListener('click', async () => {
      if (!hasCloud) {
        setSyncStatus(statusEl, '云端 API 未配置，请用导出/导入或同步文本。', true);
        return;
      }
      if (!isValidSyncKey(getSyncKey())) {
        setSyncStatus(statusEl, '请先设置并保存同步码。', true);
        return;
      }
      try {
        const merged = await pullFromCloud();
        if (merged) {
          hooks?.onMerged?.(merged);
          setSyncStatus(statusEl, `已从云端拉取，共 ${merged.length} 条。`, false);
        } else {
          setSyncStatus(statusEl, '云端暂无数据或拉取失败。', true);
        }
      } catch {
        setSyncStatus(statusEl, '拉取失败，请检查网络。', true);
      }
    });

    document.getElementById('video-sync-export')?.addEventListener('click', () => {
      exportBackupFile();
      setSyncStatus(statusEl, '已下载备份文件。', false);
    });

    document.getElementById('video-sync-import')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const merged = await importBackupFile(file);
        hooks?.onMerged?.(merged);
        setSyncStatus(statusEl, `已导入并合并，共 ${merged.length} 条。`, false);
      } catch (err) {
        setSyncStatus(statusEl, err?.message || '导入失败', true);
      }
      e.target.value = '';
    });

    document.getElementById('video-sync-uc-upload')?.addEventListener('click', async () => {
      try {
        setSyncStatus(statusEl, '正在上传到 Uploadcare…', false);
        const { url } = await uploadToUploadcare();
        if (ucUrlInput) ucUrlInput.value = url;
        try {
          await navigator.clipboard.writeText(url);
          setSyncStatus(statusEl, `已上传并复制链接：${url}`, false);
        } catch {
          setSyncStatus(statusEl, `已上传：${url}（请手动复制）`, false);
        }
      } catch (err) {
        setSyncStatus(statusEl, err?.message || 'Uploadcare 上传失败', true);
      }
    });

    document.getElementById('video-sync-uc-copy')?.addEventListener('click', async () => {
      const url = (ucUrlInput?.value || getUploadcareUrl() || '').trim();
      if (!parseUploadcareUuid(url)) {
        setSyncStatus(statusEl, '还没有备份链接，请先上传。', true);
        return;
      }
      try {
        await navigator.clipboard.writeText(url);
        setSyncStatus(statusEl, '备份链接已复制。', false);
      } catch {
        setSyncStatus(statusEl, '请手动复制输入框中的链接。', false);
      }
    });

    document.getElementById('video-sync-uc-pull')?.addEventListener('click', async () => {
      try {
        setSyncStatus(statusEl, '正在从 Uploadcare 拉取…', false);
        const merged = await pullFromUploadcare(ucUrlInput?.value || '');
        hooks?.onMerged?.(merged);
        setSyncStatus(statusEl, `已从 Uploadcare 合并，共 ${merged.length} 条。`, false);
      } catch (err) {
        setSyncStatus(statusEl, err?.message || '拉取失败', true);
      }
    });

    document.getElementById('video-sync-copy-blob')?.addEventListener('click', async () => {
      const vp = window.BioAI?.videoPreview;
      if (!vp) return;
      const text = encodePayload(vp.loadHistory());
      if (blobInput) blobInput.value = text;
      try {
        await navigator.clipboard.writeText(text);
        setSyncStatus(statusEl, '同步文本已复制到剪贴板。', false);
      } catch {
        setSyncStatus(statusEl, '已生成同步文本（请手动复制下方文本框）。', false);
      }
    });

    document.getElementById('video-sync-merge-blob')?.addEventListener('click', () => {
      const vp = window.BioAI?.videoPreview;
      if (!vp) return;
      try {
        const remote = decodePayload(blobInput?.value || '');
        const merged = mergeHistories(vp.loadHistory(), remote);
        vp.saveHistory(merged);
        hooks?.onMerged?.(merged);
        setSyncStatus(statusEl, `已合并同步文本，共 ${merged.length} 条。`, false);
      } catch (err) {
        setSyncStatus(statusEl, err?.message || '合并失败', true);
      }
    });
  }

  window.BioAI = window.BioAI || {};
  window.BioAI.videoPreviewSync = {
    SYNC_KEY_STORAGE,
    UC_URL_STORAGE,
    getApiUrl,
    getUploadcarePublicKey,
    getSyncKey,
    setSyncKey,
    generateSyncKey,
    isValidSyncKey,
    buildShareUrl,
    tryJoinFromShareUrl,
    mergeHistories,
    encodePayload,
    decodePayload,
    pushToCloud,
    pullFromCloud,
    uploadToUploadcare,
    pullFromUploadcare,
    parseUploadcareUuid,
    schedulePush,
    installSaveHook,
    exportBackupFile,
    importBackupFile,
    initPage,
    tryAutoEnsureSyncKey,
  };

  installSaveHook();
})();
