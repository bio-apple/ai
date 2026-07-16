/** AICPB 风格排行榜 Tab 切换 */
(function initRankingTabs() {
  const root = document.querySelector('[data-ranking-tabs]');
  if (!root) return;

  const tabs = root.querySelectorAll('[data-ranking-tab]');
  const panels = root.querySelectorAll('[data-ranking-panel]');

  function activate(id) {
    tabs.forEach((tab) => {
      const on = tab.getAttribute('data-ranking-tab') === id;
      tab.classList.toggle('is-active', on);
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    panels.forEach((panel) => {
      const on = panel.getAttribute('data-ranking-panel') === id;
      panel.hidden = !on;
    });
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      activate(tab.getAttribute('data-ranking-tab'));
    });
  });

  const initial = root.querySelector('[data-ranking-tab].is-active') || tabs[0];
  if (initial) activate(initial.getAttribute('data-ranking-tab'));
})();
