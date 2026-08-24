/** 视频预览跨设备同步：共享 sync 码 + Cloudflare KV */
(function initVideoPreviewSync() {
  const SYNC_KEY_STORAGE = 'bioai.video.syncKey';
  const PAYLOAD_PREFIX = 'BIOAI1:';
  const KEY_MIN = 8;
  const KEY_MAX = 48;

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

  /** 站点级共享 sync 码：所有设备打开 videos.html 即读写同一云端列表 */
  function getSharedSyncKey() {
    const raw = getConfig().shared_key || '';
    const k = String(raw).trim();
    return isValidSyncKey(k) ? k : '';
  }

  function usesSharedSyncKey() {
    return Boolean(getSharedSyncKey());
  }

  function getSyncKey() {
    const shared = getSharedSyncKey();
    if (shared) return shared;
    return localStorage.getItem(SYNC_KEY_STORAGE) || '';
  }

  function setSyncKey(key) {
    if (getSharedSyncKey()) return getSharedSyncKey();
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
    return PAYLOAD_PREFIX + b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
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

  /** 把同步码写进地址栏；共享模式下保持 URL 简洁 */
  function mirrorSyncToUrl() {
    if (usesSharedSyncKey()) return buildShareUrl();
    const key = getSyncKey();
    if (!isValidSyncKey(key)) return '';
    try {
      const u = new URL(window.location.href);
      if (u.searchParams.get('sync') === key) return buildShareUrl(key);
      u.searchParams.set('sync', key);
      u.searchParams.delete('s');
      if (u.hash.startsWith('#sync=')) u.hash = '';
      window.history.replaceState({}, '', u.pathname + u.search + u.hash);
    } catch {
      /* ignore */
    }
    return buildShareUrl(key);
  }

  /** 设备 B / 清数据后：URL 带 ?sync= 时自动绑定并拉取 */
  async function tryJoinFromShareUrl(hooks) {
    const fromUrl = readSyncKeyFromUrl();
    if (!fromUrl) return null;
    setSyncKey(fromUrl);
    mirrorSyncToUrl();
    if (!getApiUrl()) return { key: fromUrl, items: null, reason: 'no_api' };
    try {
      const merged = await pullFromCloud();
      if (merged) {
        hooks?.onMerged?.(merged);
        return { key: fromUrl, items: merged, reason: 'pulled' };
      }
      await pushToCloud();
      return { key: fromUrl, items: [], reason: 'pushed_empty' };
    } catch {
      return { key: fromUrl, items: null, reason: 'pull_failed' };
    }
  }

  /** 确保有同步码，并立刻推送到云端（保存按钮用） */
  async function ensureCloudSaved() {
    if (!getApiUrl()) return { ok: false, reason: 'no_api' };
    if (!getSyncKey()) {
      await tryAutoEnsureSyncKey();
    }
    if (!getSyncKey()) return { ok: false, reason: 'no_key' };
    try {
      const ok = await pushToCloud();
      if (ok) mirrorSyncToUrl();
      return { ok: Boolean(ok), reason: ok ? 'pushed' : 'push_failed', shareUrl: buildShareUrl() };
    } catch {
      return { ok: false, reason: 'push_failed', shareUrl: buildShareUrl() };
    }
  }

  /** 云端已配置且尚无同步码时，使用共享码或自动生成 */
  async function tryAutoEnsureSyncKey() {
    if (!getApiUrl()) return getSyncKey() || null;
    const shared = getSharedSyncKey();
    if (shared) return shared;
    if (getSyncKey()) return getSyncKey();
    const key = generateSyncKey();
    setSyncKey(key);
    try {
      await pushToCloud();
    } catch {
      /* 稍后由 schedulePush 重试 */
    }
    mirrorSyncToUrl();
    return key;
  }

  /** 页面加载：共享码 / URL / 本机码 → 拉取云端 */
  async function bootPage(hooks) {
    installSaveHook();
    if (usesSharedSyncKey()) {
      try {
        const merged = await pullFromCloud();
        if (merged?.length) {
          hooks?.onMerged?.(merged);
          return { key: getSyncKey(), items: merged, reason: 'pulled' };
        }
      } catch {
        /* ignore */
      }
      return { key: getSyncKey(), items: null, reason: 'shared' };
    }
    const joined = await tryJoinFromShareUrl(hooks);
    if (joined) {
      mirrorSyncToUrl();
      return joined;
    }
    if (getApiUrl() && isValidSyncKey(getSyncKey())) {
      mirrorSyncToUrl();
      try {
        const merged = await pullFromCloud();
        if (merged?.length) {
          hooks?.onMerged?.(merged);
          return { key: getSyncKey(), items: merged, reason: 'pulled' };
        }
      } catch {
        /* ignore */
      }
    }
    return { key: getSyncKey() || '', items: null, reason: 'local' };
  }

  window.BioAI = window.BioAI || {};
  window.BioAI.videoPreviewSync = {
    SYNC_KEY_STORAGE,
    getApiUrl,
    getSharedSyncKey,
    usesSharedSyncKey,
    getSyncKey,
    setSyncKey,
    generateSyncKey,
    isValidSyncKey,
    buildShareUrl,
    mirrorSyncToUrl,
    stripSyncFromUrl,
    tryJoinFromShareUrl,
    mergeHistories,
    encodePayload,
    decodePayload,
    pushToCloud,
    pullFromCloud,
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
