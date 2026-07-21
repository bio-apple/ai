/* 数据运营：站点热度基准（engagement.json）+ 本机浏览/点击累加 + 定时同步 */
(function initEngagement() {
  const STORAGE_KEY = 'bioai.engagement.v1';
  const SESSION_VIEW_KEY = 'bioai.engagement.viewed';
  const POLL_MS = 45_000;

  const TOOL_META = {
    chatgpt: { name: 'ChatGPT', icon: '🔥' },
    claude: { name: 'Claude', icon: '✦' },
    gemini: { name: 'Gemini', icon: '◈' },
    deepseek: { name: 'DeepSeek', icon: '🚀' },
    kimi: { name: 'Kimi', icon: '◐' },
    qwen: { name: '通义千问', icon: '通' },
    doubao: { name: '豆包', icon: '豆' },
    cursor: { name: 'Cursor', icon: '⚡' },
    codex: { name: 'Codex', icon: '⌘' },
    copilot: { name: 'Copilot', icon: '◆' },
  };

  const CLICK_EVENTS = new Set([
    'tool-card',
    'tool-card-btn',
    'nav-tab',
    'section_view',
    'recommend_query_tool',
    'recommend_related_tool',
    'ops-tool-click',
    'hero-cta-primary',
    'hero-cta-nav',
    'daily_panel_click',
    'search_hit',
    'search_query',
    'course-click',
    'course-read',
    'funnel_entry',
  ]);

  let seed = {
    updated_at: '',
    page_views: 0,
    tools: [],
  };
  let lastSyncedAt = 0;
  let pollTimer = null;
  let lastRendered = { views: null, clicks: null };

  function todayKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function siteBase() {
    const raw = document.documentElement.dataset.base || '/';
    return raw.endsWith('/') ? raw : `${raw}/`;
  }

  function emptyLocal() {
    return { date: todayKey(), page_views: 0, clicks: 0, by_tool: {} };
  }

  function loadLocal() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!raw || typeof raw !== 'object') return emptyLocal();
      if (raw.date !== todayKey()) return emptyLocal();
      return {
        date: raw.date,
        page_views: Number(raw.page_views) || 0,
        clicks: Number(raw.clicks) || 0,
        by_tool: raw.by_tool && typeof raw.by_tool === 'object' ? { ...raw.by_tool } : {},
      };
    } catch {
      return emptyLocal();
    }
  }

  function saveLocal(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function formatNumber(n) {
    return Math.max(0, Math.round(Number(n) || 0)).toLocaleString('zh-CN');
  }

  function formatSyncTime(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  }

  function mergedTools(local) {
    const map = new Map();
    for (const t of seed.tools || []) {
      if (!t?.id) continue;
      map.set(t.id, {
        id: t.id,
        name: t.name || TOOL_META[t.id]?.name || t.id,
        icon: t.icon || TOOL_META[t.id]?.icon || '·',
        today_clicks: Number(t.today_clicks) || 0,
        updated_at: t.updated_at || seed.updated_at || '',
      });
    }
    for (const [id, count] of Object.entries(local.by_tool || {})) {
      const cur = map.get(id) || {
        id,
        name: TOOL_META[id]?.name || id,
        icon: TOOL_META[id]?.icon || '·',
        today_clicks: 0,
        updated_at: todayKey(),
      };
      cur.today_clicks += Number(count) || 0;
      map.set(id, cur);
    }
    return [...map.values()].sort(
      (a, b) => b.today_clicks - a.today_clicks || a.name.localeCompare(b.name, 'zh'),
    );
  }

  function pulseStat(el, changed) {
    if (!el || !changed) return;
    el.classList.remove('ops-stat-value--pulse');
    void el.offsetWidth;
    el.classList.add('ops-stat-value--pulse');
  }

  function render() {
    const host = document.getElementById('home-ops');
    if (!host) return;
    const local = loadLocal();
    const tools = mergedTools(local);
    const seedClicks = (seed.tools || []).reduce((n, t) => n + (Number(t.today_clicks) || 0), 0);
    const views = (Number(seed.page_views) || 0) + (local.page_views || 0);
    const clicks = seedClicks + (local.clicks || 0);

    const viewsEl = document.getElementById('ops-views');
    const clicksEl = document.getElementById('ops-clicks');
    const updatedEl = document.getElementById('ops-updated');
    const updatedTextEl = document.getElementById('ops-updated-text');
    const list = document.getElementById('ops-trend-list');

    if (viewsEl) {
      pulseStat(viewsEl, lastRendered.views !== null && lastRendered.views !== views);
      viewsEl.textContent = formatNumber(views);
    }
    if (clicksEl) {
      pulseStat(clicksEl, lastRendered.clicks !== null && lastRendered.clicks !== clicks);
      clicksEl.textContent = formatNumber(clicks);
    }
    lastRendered = { views, clicks };

    const syncLine = lastSyncedAt
      ? `最近同步 ${formatSyncTime(lastSyncedAt)}`
      : seed.updated_at
        ? `基准 ${seed.updated_at}`
        : '';
    const statusText = syncLine ? `${syncLine} · 本机实时累加` : '本机互动实时累加';
    if (updatedTextEl) updatedTextEl.textContent = statusText;
    else if (updatedEl) updatedEl.lastChild.textContent = statusText;

    if (list) {
      if (!tools.length) {
        list.innerHTML = '<li class="ops-trend-empty">暂无热度数据</li>';
      } else {
        list.innerHTML = tools
          .slice(0, 6)
          .map((t, i) => {
            const icon = t.icon && t.icon !== '🔥' ? t.icon : '·';
            const title = i === 0 ? `🔥 ${t.name}` : `${icon} ${t.name}`;
            return `<li>
              <button type="button" class="ops-trend-item" data-tool="${escapeAttr(t.id)}" data-track="ops-tool-click">
                <span class="ops-trend-tool">${escapeHtml(title)}</span>
                <span class="ops-trend-meta">
                  <span class="ops-trend-label">今日点击</span>
                  <span class="ops-trend-value">${formatNumber(t.today_clicks)}</span>
                </span>
              </button>
            </li>`;
          })
          .join('');
      }
    }

    host.dataset.opsReady = '1';
    host.dataset.opsSyncedAt = lastSyncedAt ? String(lastSyncedAt) : '';
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function escapeAttr(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;');
  }

  function onEvent(name, params = {}) {
    if (!CLICK_EVENTS.has(name)) return;

    const local = loadLocal();
    const tool = typeof params.tool === 'string' ? params.tool : '';
    if (tool) {
      local.clicks = (local.clicks || 0) + 1;
      local.by_tool[tool] = (Number(local.by_tool[tool]) || 0) + 1;
    } else {
      local.clicks = (local.clicks || 0) + 1;
    }
    saveLocal(local);
    render();
  }

  function recordPageView() {
    try {
      if (sessionStorage.getItem(SESSION_VIEW_KEY) === todayKey()) return;
      sessionStorage.setItem(SESSION_VIEW_KEY, todayKey());
    } catch {
      /* private mode：仍计一次浏览 */
    }
    const local = loadLocal();
    local.page_views = (local.page_views || 0) + 1;
    saveLocal(local);
  }

  function bindTrendClicks() {
    const list = document.getElementById('ops-trend-list');
    if (!list || list.dataset.bound === '1') return;
    list.dataset.bound = '1';
    list.addEventListener('click', (e) => {
      const btn = e.target.closest('.ops-trend-item[data-tool]');
      if (!btn) return;
      const tool = btn.dataset.tool;
      if (!tool) return;
      if (typeof showSection === 'function') showSection(`section-${tool}`);
      else location.hash = `section-${tool}`;
    });
  }

  async function loadSeed(force = false) {
    try {
      const url = force
        ? `${siteBase()}engagement.json?t=${Date.now()}`
        : `${siteBase()}engagement.json`;
      const res = await fetch(url, { cache: force ? 'no-store' : 'default' });
      if (!res.ok) return false;
      const data = await res.json();
      seed = {
        updated_at: data.updated_at || '',
        page_views: Number(data.page_views) || 0,
        tools: Array.isArray(data.tools) ? data.tools : [],
      };
      lastSyncedAt = Date.now();
      render();
      return true;
    } catch {
      return false;
    }
  }

  function startLiveSync() {
    if (pollTimer) return;
    pollTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible') loadSeed(true);
    }, POLL_MS);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') loadSeed(true);
    });

    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY) render();
    });

    window.addEventListener('focus', () => {
      if (document.visibilityState === 'visible') loadSeed(true);
    });
  }

  async function boot() {
    if (!document.getElementById('home-ops')) return;
    await loadSeed(false);
    recordPageView();
    bindTrendClicks();
    render();
    startLiveSync();
  }

  window.bioEngagement = { onEvent, render, loadLocal, refresh: () => loadSeed(true) };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      boot();
    });
  } else {
    boot();
  }
})();
