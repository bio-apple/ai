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

  /** 设备 B：URL 带 ?sync= 时自动绑定并拉取 */
  async function tryJoinFromShareUrl(hooks) {
    const fromUrl = readSyncKeyFromUrl();
    if (!fromUrl) return null;
    setSyncKey(fromUrl);
    stripSyncFromUrl();
    if (!getApiUrl()) return fromUrl;
    try {
      const merged = await pullFromCloud();
      if (merged) hooks?.onMerged?.(merged);
      else await pushToCloud();
    } catch {
      /* ignore */
    }
    return fromUrl;
  }

  /** 确保有同步码，并立刻推送到云端（保存按钮用） */
  async function ensureCloudSaved(hooks) {
    if (!getApiUrl()) return { ok: false, reason: 'no_api' };
    if (!getSyncKey()) {
      await tryAutoEnsureSyncKey();
    }
    if (!getSyncKey()) return { ok: false, reason: 'no_key' };
    try {
      const ok = await pushToCloud();
      return { ok: Boolean(ok), reason: ok ? 'pushed' : 'push_failed' };
    } catch {
      return { ok: false, reason: 'push_failed' };
    }
  }

  /** 云端已配置且尚无同步码时，自动生成并上传 */
  async function tryAutoEnsureSyncKey() {
    if (!getApiUrl() || getSyncKey()) return getSyncKey() || null;
    const key = generateSyncKey();
    setSyncKey(key);
    try {
      await pushToCloud();
    } catch {
      /* 稍后由 schedulePush 重试 */
    }
    return key;
  }

  /** 页面加载：后台拉取云端（无 UI） */
  function bootPage(hooks) {
    installSaveHook();
    tryJoinFromShareUrl(hooks).then((joined) => {
      if (joined) return;
      if (getApiUrl() && isValidSyncKey(getSyncKey())) {
        pullFromCloud()
          .then((merged) => {
            if (merged?.length) hooks?.onMerged?.(merged);
          })
          .catch(() => {});
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
    bootPage,
    tryAutoEnsureSyncKey,
    ensureCloudSaved,
  };

  installSaveHook();
})();
