/** 工具收藏与浏览历史：本机 localStorage，无账号 */
(function initToolShelf(global) {
  const FAV_KEY = 'bioai.tools.favorites.v1';
  const HIST_KEY = 'bioai.tools.history.v1';
  const MAX_FAVORITES = 24;
  const MAX_HISTORY = 24;
  const ID_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;

  function storageGet(key) {
    try {
      return global.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function storageSet(key, value) {
    try {
      global.localStorage.setItem(key, value);
    } catch {
      /* quota / private */
    }
  }

  function normalizeId(id) {
    const raw = String(id || '')
      .trim()
      .toLowerCase();
    return ID_RE.test(raw) ? raw : '';
  }

  function parseIds(raw) {
    try {
      const arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) return [];
      const out = [];
      const seen = new Set();
      for (const item of arr) {
        const id = normalizeId(item);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push(id);
      }
      return out;
    } catch {
      return [];
    }
  }

  function parseHistory(raw) {
    try {
      const arr = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(arr)) return [];
      const out = [];
      const seen = new Set();
      for (const item of arr) {
        const id = normalizeId(item && item.id);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const at = String((item && item.at) || '').trim();
        out.push({ id, at: at || new Date().toISOString() });
      }
      return out;
    } catch {
      return [];
    }
  }

  function loadFavorites() {
    return parseIds(storageGet(FAV_KEY)).slice(0, MAX_FAVORITES);
  }

  function saveFavorites(ids) {
    const next = parseIds(JSON.stringify(ids)).slice(0, MAX_FAVORITES);
    storageSet(FAV_KEY, JSON.stringify(next));
    return next;
  }

  function isFavorite(id) {
    const key = normalizeId(id);
    return Boolean(key) && loadFavorites().includes(key);
  }

  function toggleFavorite(id) {
    const key = normalizeId(id);
    if (!key) return { on: false, ids: loadFavorites() };
    const ids = loadFavorites();
    const idx = ids.indexOf(key);
    if (idx >= 0) {
      ids.splice(idx, 1);
      return { on: false, ids: saveFavorites(ids) };
    }
    ids.unshift(key);
    return { on: true, ids: saveFavorites(ids) };
  }

  function loadHistory() {
    return parseHistory(storageGet(HIST_KEY)).slice(0, MAX_HISTORY);
  }

  function saveHistory(items) {
    const next = parseHistory(JSON.stringify(items)).slice(0, MAX_HISTORY);
    storageSet(HIST_KEY, JSON.stringify(next));
    return next;
  }

  function recordVisit(id, at) {
    const key = normalizeId(id);
    if (!key || key === 'hub' || key === 'shelf') return loadHistory();
    const items = loadHistory().filter((x) => x.id !== key);
    items.unshift({ id: key, at: at || new Date().toISOString() });
    return saveHistory(items);
  }

  function removeHistory(id) {
    const key = normalizeId(id);
    return saveHistory(loadHistory().filter((x) => x.id !== key));
  }

  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatWhen(iso, now = Date.now()) {
    const parsed = Date.parse(iso);
    if (Number.isNaN(parsed)) return '';
    const delta = now - parsed;
    if (delta < 45_000) return '刚刚';
    if (delta < 60 * 60_000) return `${Math.max(1, Math.round(delta / 60_000))}分钟前`;
    if (delta < 24 * 60 * 60_000) return `${Math.max(1, Math.round(delta / 3_600_000))}小时前`;
    if (delta < 30 * 24 * 60 * 60_000) return `${Math.max(1, Math.round(delta / 86_400_000))}天前`;
    try {
      return new Date(parsed).toLocaleDateString('zh-CN', {
        month: 'numeric',
        day: 'numeric',
        timeZone: 'Asia/Shanghai',
      });
    } catch {
      return String(iso).slice(0, 10);
    }
  }

  function catalogMap() {
    const node = global.document && global.document.getElementById('tool-shelf-catalog');
    if (!node) return {};
    try {
      const arr = JSON.parse(node.textContent || '[]');
      if (!Array.isArray(arr)) return {};
      return Object.fromEntries(arr.filter((t) => t && t.id).map((t) => [t.id, t]));
    } catch {
      return {};
    }
  }

  function renderRow(tool, extra) {
    const href = escapeHtml(tool.href || '');
    const name = escapeHtml(tool.name || tool.id);
    const icon = escapeHtml(tool.icon || '·');
    const tagline = escapeHtml(tool.tagline || '');
    const when = extra.when
      ? `<time datetime="${escapeHtml(extra.when)}">${escapeHtml(formatWhen(extra.when))}</time>`
      : '';
    return `<li class="tool-shelf-row">
      <a class="tool-shelf-main" href="${href}" data-track="${escapeHtml(extra.track || 'tool-shelf-open')}" data-tool="${escapeHtml(tool.id)}">
        <span class="tool-icon ${escapeHtml(tool.id)}" aria-hidden="true">${icon}</span>
        <span class="tool-shelf-body">
          <strong>${name}</strong>
          ${tagline ? `<span class="tool-shelf-note">${tagline}</span>` : ''}
          ${when}
        </span>
      </a>
      <div class="tool-shelf-actions">
        ${extra.actions}
      </div>
    </li>`;
  }

  function paintShelf() {
    const root = global.document && global.document.getElementById('tool-shelf');
    if (!root) return;
    const catalog = catalogMap();
    const favs = loadFavorites()
      .map((id) => catalog[id])
      .filter(Boolean);
    const hist = loadHistory()
      .map((item) => (catalog[item.id] ? { tool: catalog[item.id], at: item.at } : null))
      .filter(Boolean);

    const favList = global.document.getElementById('tool-shelf-favs-list');
    const favEmpty = global.document.getElementById('tool-shelf-favs-empty');
    if (favList && favEmpty) {
      favEmpty.hidden = favs.length > 0;
      favList.hidden = favs.length === 0;
      favList.innerHTML = favs
        .map((tool) =>
          renderRow(tool, {
            track: 'tool-shelf-fav-open',
            actions: `<button type="button" class="tool-shelf-unfav" data-unfav="${escapeHtml(tool.id)}">取消收藏</button>`,
          }),
        )
        .join('');
    }

    const histList = global.document.getElementById('tool-shelf-hist-list');
    const histEmpty = global.document.getElementById('tool-shelf-hist-empty');
    if (histList && histEmpty) {
      histEmpty.hidden = hist.length > 0;
      histList.hidden = hist.length === 0;
      histList.innerHTML = hist
        .map(({ tool, at }) => {
          const saved = isFavorite(tool.id);
          return renderRow(tool, {
            track: 'tool-shelf-hist-open',
            when: at,
            actions: `${
              saved
                ? ''
                : `<button type="button" class="tool-shelf-save" data-save="${escapeHtml(tool.id)}">收藏</button>`
            }<button type="button" class="tool-shelf-forget" data-forget="${escapeHtml(tool.id)}">去掉</button>`,
          });
        })
        .join('');
    }
  }

  function syncFavButtons() {
    const doc = global.document;
    if (!doc) return;
    doc.querySelectorAll('[data-favorite-toggle]').forEach((btn) => {
      const on = isFavorite(btn.getAttribute('data-tool-id'));
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      const label = on ? '已收藏' : '收藏';
      btn.textContent = label;
      btn.setAttribute('aria-label', on ? '取消收藏' : '收藏此工具');
    });
  }

  function track(name, params) {
    if (typeof global.trackEvent === 'function') global.trackEvent(name, params);
  }

  function bind() {
    const doc = global.document;
    if (!doc) return;

    doc.querySelectorAll('[data-tool-visit]').forEach((el) => {
      recordVisit(el.getAttribute('data-tool-visit'));
    });
    syncFavButtons();
    paintShelf();

    doc.addEventListener('click', (ev) => {
      const favBtn = ev.target.closest('[data-favorite-toggle]');
      if (favBtn) {
        ev.preventDefault();
        const id = favBtn.getAttribute('data-tool-id');
        const next = toggleFavorite(id);
        syncFavButtons();
        paintShelf();
        track(next.on ? 'tool-favorite-on' : 'tool-favorite-off', { tool: id });
        return;
      }
      const saveBtn = ev.target.closest('[data-save]');
      if (saveBtn) {
        ev.preventDefault();
        const id = saveBtn.getAttribute('data-save');
        toggleFavorite(id);
        syncFavButtons();
        paintShelf();
        track('tool-favorite-on', { tool: id });
        return;
      }
      const unfavBtn = ev.target.closest('[data-unfav]');
      if (unfavBtn) {
        ev.preventDefault();
        const id = unfavBtn.getAttribute('data-unfav');
        if (isFavorite(id)) toggleFavorite(id);
        syncFavButtons();
        paintShelf();
        track('tool-favorite-off', { tool: id });
        return;
      }
      const forgetBtn = ev.target.closest('[data-forget]');
      if (forgetBtn) {
        ev.preventDefault();
        const id = forgetBtn.getAttribute('data-forget');
        removeHistory(id);
        paintShelf();
        track('tool-history-remove', { tool: id });
      }
    });
  }

  const api = {
    FAV_KEY,
    HIST_KEY,
    MAX_FAVORITES,
    MAX_HISTORY,
    normalizeId,
    loadFavorites,
    saveFavorites,
    isFavorite,
    toggleFavorite,
    loadHistory,
    recordVisit,
    removeHistory,
    formatWhen,
    paintShelf,
    syncFavButtons,
  };

  global.BioAI = global.BioAI || {};
  global.BioAI.toolShelf = api;

  if (global.document) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', bind);
    } else {
      bind();
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
