/** 视频预览跨设备同步：同步码 + 云端 KV（可选）+ 导出/粘贴备份 */
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

  function setSyncStatus(el, msg, isError) {
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('is-error', Boolean(isError));
  }

  function initPage(hooks) {
    installSaveHook();
    const panel = document.getElementById('video-sync-panel');
    if (!panel) return;

    const keyInput = document.getElementById('video-sync-key');
    const statusEl = document.getElementById('video-sync-status');
    const blobInput = document.getElementById('video-sync-blob');
    const hasCloud = Boolean(getApiUrl());

    if (keyInput) keyInput.value = getSyncKey();

    const cloudHint = panel.querySelector('[data-sync-cloud-hint]');
    if (cloudHint) {
      cloudHint.hidden = hasCloud;
    }

    document.getElementById('video-sync-generate')?.addEventListener('click', () => {
      if (keyInput) keyInput.value = generateSyncKey();
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
  }

  window.BioAI = window.BioAI || {};
  window.BioAI.videoPreviewSync = {
    SYNC_KEY_STORAGE,
    getApiUrl,
    getSyncKey,
    setSyncKey,
    generateSyncKey,
    isValidSyncKey,
    mergeHistories,
    encodePayload,
    decodePayload,
    pushToCloud,
    pullFromCloud,
    schedulePush,
    installSaveHook,
    exportBackupFile,
    importBackupFile,
    initPage,
  };

  installSaveHook();
})();
