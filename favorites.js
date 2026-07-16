/* 本地收藏：工具 ID 存 localStorage，首页区块 + 卡片星标 + 导入导出 */
(function initFavorites() {
  const KEY = 'bioai.favorites.v1';

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(raw) ? raw.filter((x) => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }

  function save(ids) {
    localStorage.setItem(KEY, JSON.stringify([...new Set(ids)]));
  }

  function isFav(id) {
    return load().includes(id);
  }

  function toggle(id) {
    const cur = load();
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    save(next);
    return next.includes(id);
  }

  function toolName(id) {
    const card = document.querySelector(`.tool-card-v2[data-tool="${id}"] h3`);
    if (card) return card.textContent.trim();
    const map = {
      chatgpt: 'ChatGPT',
      claude: 'Claude',
      gemini: 'Gemini',
      deepseek: 'DeepSeek',
      kimi: 'Kimi',
      qwen: '通义千问',
      doubao: '豆包',
      cursor: 'Cursor',
      codex: 'Codex',
      copilot: 'Copilot',
    };
    return map[id] || id;
  }

  function exportJson() {
    const payload = {
      schema_version: 1,
      exported_at: new Date().toISOString(),
      tools: load(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'bioai-favorites.json';
    a.click();
    URL.revokeObjectURL(a.href);
    if (typeof trackEvent === 'function')
      trackEvent('favorite_export', { count: payload.tools.length });
  }

  function importJson(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result || ''));
        const list = Array.isArray(data) ? data : data.tools;
        if (!Array.isArray(list)) throw new Error('invalid');
        const ids = list.filter((x) => typeof x === 'string' && x.trim());
        save([...new Set([...load(), ...ids])]);
        syncAll();
        if (typeof trackEvent === 'function') trackEvent('favorite_import', { count: ids.length });
      } catch {
        alert('导入失败：请使用本站导出的 JSON 文件');
      }
    };
    reader.readAsText(file);
  }

  function renderHomeList() {
    const wrap = document.getElementById('home-favorites');
    const list = document.getElementById('favorites-list');
    const empty = document.getElementById('favorites-empty');
    if (!wrap || !list) return;
    const ids = load();
    list.innerHTML = '';
    if (!ids.length) {
      if (empty) empty.hidden = false;
      wrap.classList.add('is-empty');
      return;
    }
    if (empty) empty.hidden = true;
    wrap.classList.remove('is-empty');
    ids.forEach((id) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <button type="button" class="favorite-chip" data-tool="${id}">
          <span>${toolName(id)}</span>
        </button>
        <button type="button" class="favorite-remove" data-fav-remove="${id}" aria-label="取消收藏">×</button>
      `;
      list.appendChild(li);
    });
    list.querySelectorAll('[data-tool]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tool = btn.dataset.tool;
        if (typeof window.showSection === 'function') window.showSection(`section-${tool}`);
        else location.hash = `section-${tool}`;
      });
    });
    list.querySelectorAll('[data-fav-remove]').forEach((btn) => {
      btn.addEventListener('click', () => {
        toggle(btn.dataset.favRemove);
        syncAll();
        if (typeof trackEvent === 'function')
          trackEvent('favorite_remove', { tool: btn.dataset.favRemove });
      });
    });
  }

  function syncStars() {
    document.querySelectorAll('[data-fav-toggle]').forEach((btn) => {
      const id = btn.dataset.favToggle;
      const on = isFav(id);
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.title = on ? '取消收藏' : '收藏工具';
    });
  }

  function bindStar(btn) {
    if (btn.dataset.favBound === '1') return;
    btn.dataset.favBound = '1';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.favToggle;
      const on = toggle(id);
      btn.textContent = on ? '★' : '☆';
      syncAll();
      if (typeof trackEvent === 'function') {
        trackEvent(
          on ? 'favorite_add' : 'favorite_remove',
          on ? { tool: id, funnel_step: 3 } : { tool: id },
        );
      }
    });
  }

  function ensureStars() {
    document.querySelectorAll('.tool-card-v2[data-tool]').forEach((card) => {
      let btn = card.querySelector('[data-fav-toggle]');
      if (!btn) {
        const id = card.dataset.tool;
        btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'fav-star';
        btn.dataset.favToggle = id;
        btn.setAttribute('aria-label', '收藏工具');
        btn.innerHTML = '☆';
        const top = card.querySelector('.tool-card-top');
        if (top) top.appendChild(btn);
        else card.prepend(btn);
      }
      bindStar(btn);
    });
  }

  function syncAll() {
    ensureStars();
    document.querySelectorAll('[data-fav-toggle]').forEach((btn) => {
      btn.textContent = isFav(btn.dataset.favToggle) ? '★' : '☆';
    });
    syncStars();
    renderHomeList();
  }

  document.getElementById('favorites-export')?.addEventListener('click', exportJson);
  document.getElementById('favorites-import')?.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) importJson(file);
    e.target.value = '';
  });

  syncAll();
  window.bioFavorites = { load, toggle, sync: syncAll, exportJson, importJson };
})();
