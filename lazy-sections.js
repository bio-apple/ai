/**
 * 按 Tab section 懒加载业务脚本。首页主路径（推荐/简报/工具）已 SSG。
 */
(function () {
  const base = (document.documentElement.dataset.base || '/ai/').replace(/\/?$/, '/');
  const loaded = new Set();

  const SECTION_SCRIPTS = {
    'section-videos': ['videos.js'],
    'section-news': ['news.js'],
    'section-oss': ['oss.js'],
    'section-courses': ['courses.js'],
  };

  const LIB_SCRIPTS = ['lib/fetch-json.js'];

  function ensureScript(name) {
    if (loaded.has(name) || document.querySelector(`script[data-lazy-src="${name}"]`)) {
      loaded.add(name);
      return Promise.resolve();
    }
    loaded.add(name);
    return new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = base + name;
      el.async = true;
      el.dataset.lazySrc = name;
      el.onload = () => resolve();
      el.onerror = () => reject(new Error('failed to load ' + name));
      document.body.appendChild(el);
    });
  }

  function loadForSection(sectionId) {
    const files = SECTION_SCRIPTS[sectionId] || [];
    const chain = [...LIB_SCRIPTS, ...files.filter((f) => !LIB_SCRIPTS.includes(f))];
    return chain.reduce((p, name) => p.then(() => ensureScript(name)), Promise.resolve());
  }

  window.addEventListener('bioai:section-change', (e) => {
    const id = e.detail && e.detail.sectionId;
    if (id) loadForSection(id);
  });

  function boot() {
    const active = document.querySelector('.section.active');
    if (active && active.id) loadForSection(active.id);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
