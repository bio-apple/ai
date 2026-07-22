/**
 * 按 Tab section 懒加载业务脚本。首页主路径（推荐/简报/工具）已 SSG。
 */
(function () {
  const base = (document.documentElement.dataset.base || '/ai/').replace(/\/?$/, '/');
  /** @type {Map<string, Promise<void>>} */
  const inflight = new Map();
  const loaded = new Set();

  const SECTION_SCRIPTS = {
    'section-videos': ['videos.js'],
    'section-news': ['lib/virtual-list.js', 'news.js'],
    'section-courses': ['courses.js'],
  };

  const LIB_SCRIPTS = ['lib/fetch-json.js'];

  function scriptAlreadyPresent(name) {
    const abs = base + name;
    return [...document.querySelectorAll('script[src]')].some((el) => {
      const src = el.getAttribute('src') || '';
      return src === abs || src.endsWith('/' + name) || el.dataset.lazySrc === name;
    });
  }

  function ensureScript(name) {
    if (loaded.has(name) || scriptAlreadyPresent(name)) {
      loaded.add(name);
      return Promise.resolve();
    }
    if (inflight.has(name)) return inflight.get(name);

    const p = new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = base + name;
      el.async = true;
      el.dataset.lazySrc = name;
      el.onload = () => {
        loaded.add(name);
        inflight.delete(name);
        resolve();
      };
      el.onerror = () => {
        inflight.delete(name);
        el.remove();
        reject(new Error('failed to load ' + name));
      };
      document.body.appendChild(el);
    });
    inflight.set(name, p);
    return p;
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
