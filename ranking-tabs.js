/** AICPB 风格排行榜 Tab + 虚拟列表（上千行不阻塞主线程） */
(function initRankingTabs() {
  const root = document.querySelector('[data-ranking-tabs]');
  if (!root) return;

  const tabs = root.querySelectorAll('[data-ranking-tab]');
  const panels = root.querySelectorAll('[data-ranking-panel]');
  const virtualLists = new Map();

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function loadBoards() {
    const el = root.querySelector('[data-ranking-boards]');
    if (!el) return [];
    try {
      const data = JSON.parse(el.textContent || '[]');
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function renderRankRow(item, showBar) {
    const mom = String(item.mom || '');
    const bar = showBar
      ? `<span class="aicpb-mom-bar-track" aria-hidden="true">
          <em class="aicpb-mom-bar-fill ${mom.startsWith('-') ? 'is-down' : 'is-up'}" style="width:${Number(item.mom_bar_pct) || 0}%"></em>
        </span>`
      : '';
    const desc = item.description
      ? `<p class="aicpb-product-desc">${escapeHtml(item.description)}</p>`
      : '';
    const letter = String(item.name || '·')
      .trim()
      .charAt(0)
      .toUpperCase();
    return `
      <div class="aicpb-table-row">
        <span class="aicpb-rank">${escapeHtml(item.rank)}</span>
        <span class="aicpb-logo" aria-hidden="true">${escapeHtml(letter)}</span>
        <div class="aicpb-product">
          <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" class="aicpb-product-name">${escapeHtml(item.name)}</a>
          ${desc}
        </div>
        <span class="aicpb-visits">${escapeHtml(item.visits)}</span>
        <div class="aicpb-mom${showBar ? '' : ' is-text-only'}">
          <span class="aicpb-mom-value">${escapeHtml(mom)}</span>
          ${bar}
        </div>
      </div>
    `;
  }

  function mountVirtualLists() {
    const create = window.BioAI?.createVirtualList;
    if (!create) return;
    const boards = loadBoards();
    const byId = new Map(boards.map((b) => [b.id, b]));

    root.querySelectorAll('[data-ranking-vl]').forEach((host) => {
      const boardId = host.getAttribute('data-ranking-board');
      const board = byId.get(boardId);
      if (!board?.items?.length) return;
      const showBar = host.getAttribute('data-show-bar') !== '0';

      // 清空 SSR 预览，改由虚拟列表接管（SEO 已有首屏 HTML，爬虫仍可读 JSON）
      host.innerHTML = '';
      const prev = virtualLists.get(boardId);
      if (prev) prev.destroy();

      const vl = create({
        container: host,
        items: board.items,
        layout: 'list',
        itemHeight: 64,
        gap: 0,
        overscan: 8,
        renderItem: (item) => renderRankRow(item, showBar),
      });
      virtualLists.set(boardId, vl);
    });
  }

  function activate(id) {
    tabs.forEach((tab) => {
      const on = tab.getAttribute('data-ranking-tab') === id;
      tab.classList.toggle('is-active', on);
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    panels.forEach((panel) => {
      const on = panel.getAttribute('data-ranking-panel') === id;
      panel.hidden = !on;
      if (on) {
        const boardId = panel.getAttribute('data-ranking-panel');
        virtualLists.get(boardId)?.refresh?.();
      }
    });
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      activate(tab.getAttribute('data-ranking-tab'));
    });
  });

  const initial = root.querySelector('[data-ranking-tab].is-active') || tabs[0];
  if (initial) activate(initial.getAttribute('data-ranking-tab'));

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountVirtualLists);
  } else {
    mountVirtualLists();
  }
})();
