/* 学习路线阶段勾选（localStorage，无需登录） */
(function initLearningProgress() {
  const ROADMAP_KEY = 'bioai.roadmap.v1';

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

  initRoadmapChecks();

  window.bioProgress = { loadRoadmap };
})();
