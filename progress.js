/* 学习回访：最近打开 + 路线图阶段勾选（localStorage，无需登录） */
(function initLearningProgress() {
  const RECENT_KEY = 'bioai.recent.v1';
  const ROADMAP_KEY = 'bioai.roadmap.v1';
  const MAX_RECENT = 6;

  const TOOL_NAMES = {
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

  function siteBase() {
    const raw = document.documentElement.dataset.base || '/';
    return raw.endsWith('/') ? raw : `${raw}/`;
  }

  function loadRecent() {
    try {
      const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      return Array.isArray(raw) ? raw.filter((x) => x && x.href && x.title) : [];
    } catch {
      return [];
    }
  }

  function saveRecent(items) {
    localStorage.setItem(RECENT_KEY, JSON.stringify(items.slice(0, MAX_RECENT)));
  }

  function record(entry) {
    if (!entry?.href || !entry?.title) return;
    const next = [
      {
        id: entry.id || entry.href,
        title: entry.title,
        href: entry.href,
        kind: entry.kind || 'page',
        at: Date.now(),
      },
      ...loadRecent().filter((x) => x.href !== entry.href),
    ];
    saveRecent(next);
    renderContinue();
  }

  function loadRoadmap() {
    try {
      const raw = JSON.parse(localStorage.getItem(ROADMAP_KEY) || '{}');
      return raw && typeof raw === 'object' ? raw : {};
    } catch {
      return {};
    }
  }

  function saveRoadmap(map) {
    localStorage.setItem(ROADMAP_KEY, JSON.stringify(map));
  }

  function escape(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function renderContinue() {
    const host = document.getElementById('learning-continue');
    const list = document.getElementById('learning-continue-list');
    if (!host || !list) return;
    const items = loadRecent();
    if (!items.length) {
      host.hidden = true;
      list.innerHTML = '';
      return;
    }
    host.hidden = false;
    list.innerHTML = items
      .slice(0, 4)
      .map(
        (item) => `<li>
          <a class="continue-chip" href="${escape(item.href)}" data-track="learning_continue">
            <span class="continue-kind">${escape(item.kind === 'tool' ? '工具' : item.kind === 'guide' ? '指南' : item.kind === 'roadmap' ? '路线' : '继续')}</span>
            <span>${escape(item.title)}</span>
          </a>
        </li>`,
      )
      .join('');
  }

  function inferAndRecordCurrentPage() {
    const path = location.pathname.replace(/\/+$/, '');
    const base = siteBase().replace(/\/+$/, '');
    const rel = path.startsWith(base) ? path.slice(base.length) : path;
    const clean = rel.replace(/^\//, '');

    const toolMatch = clean.match(/^tools\/([a-z0-9-]+)\.html$/i);
    if (toolMatch) {
      const id = toolMatch[1];
      if (id === 'hub') {
        record({ id: 'tools-hub', title: 'AI 工具中心', href: `${siteBase()}tools/hub.html`, kind: 'page' });
      } else {
        record({
          id,
          title: TOOL_NAMES[id] || id,
          href: `${siteBase()}tools/${id}.html`,
          kind: 'tool',
        });
      }
      return;
    }
    if (clean === 'ai-learning-roadmap.html') {
      record({
        id: 'roadmap',
        title: 'AI 学习路线',
        href: `${siteBase()}ai-learning-roadmap.html`,
        kind: 'roadmap',
      });
      return;
    }
    const guideMatch = clean.match(/^guides\/([a-z0-9-]+)\.html$/i);
    if (guideMatch) {
      const slug = guideMatch[1];
      record({
        id: `guide-${slug}`,
        title: slug === 'advanced' ? '进阶应用指南' : '零基础入门指南',
        href: `${siteBase()}guides/${slug}.html`,
        kind: 'guide',
      });
      return;
    }
    if (clean === 'cases/index.html') {
      record({
        id: 'cases',
        title: '实战案例库',
        href: `${siteBase()}cases/index.html`,
        kind: 'page',
      });
    }
  }

  function initRoadmapChecks() {
    const phases = document.querySelectorAll('.roadmap-phase[data-phase-id]');
    if (!phases.length) return;
    const state = loadRoadmap();
    phases.forEach((phase) => {
      const id = phase.dataset.phaseId;
      const box = phase.querySelector('.roadmap-phase-check');
      if (!box) return;
      box.checked = Boolean(state[id]);
      phase.classList.toggle('is-done', box.checked);
      box.addEventListener('change', () => {
        const next = loadRoadmap();
        if (box.checked) next[id] = true;
        else delete next[id];
        saveRoadmap(next);
        phase.classList.toggle('is-done', box.checked);
        if (typeof trackEvent === 'function') {
          trackEvent('roadmap_phase_toggle', { phase: id, done: box.checked });
        }
      });
    });
    const meta = document.getElementById('roadmap-progress-meta');
    if (meta) {
      const done = phases.length
        ? [...phases].filter((p) => p.querySelector('.roadmap-phase-check')?.checked).length
        : 0;
      meta.textContent = `进度 ${done}/${phases.length}（保存在本浏览器）`;
      document.addEventListener('change', (e) => {
        if (!e.target.classList?.contains('roadmap-phase-check')) return;
        const d = [...document.querySelectorAll('.roadmap-phase-check:checked')].length;
        const total = document.querySelectorAll('.roadmap-phase-check').length;
        meta.textContent = `进度 ${d}/${total}（保存在本浏览器）`;
      });
    }
  }

  inferAndRecordCurrentPage();
  renderContinue();
  initRoadmapChecks();

  window.bioProgress = { record, loadRecent, renderContinue };
})();
