/**
 * 按 Tab section 懒加载业务脚本。首页主路径（推荐/简报/工具）已 SSG。
 * 脚本 URL 带内容哈希（window.__BIOAI_ASSET_V__，由布局注入），避免 CDN/浏览器吃到旧文件。
 */
(function () {
  const base = (document.documentElement.dataset.base || '/ai/').replace(/\/?$/, '/');
  /** @type {Map<string, Promise<void>>} */
  const inflight = new Map();
  const loaded = new Set();

  const SECTION_SCRIPTS = {
    'section-videos': ['videos.js'],
    'section-news': ['news.js'],
    'section-courses': ['courses.js'],
  };

  const LIB_SCRIPTS = ['lib/fetch-json.js'];

  function versionedSrc(name) {
    const versions =
      (typeof window !== 'undefined' && window.__BIOAI_ASSET_V__) ||
      (typeof globalThis !== 'undefined' && globalThis.__BIOAI_ASSET_V__) ||
      {};
    const v = versions[name];
    return v ? `${base}${name}?v=${v}` : base + name;
  }

  function scriptAlreadyPresent(name) {
    return [...document.querySelectorAll('script[src]')].some((el) => {
      const src = el.getAttribute('src') || '';
      if (el.dataset.lazySrc === name) return true;
      // 忽略 query：同名脚本（含旧 ?v=）视为已加载
      try {
        const path = new URL(src, window.location.origin).pathname;
        return path === base + name || path.endsWith('/' + name);
      } catch {
        return src.includes(name);
      }
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
      el.src = versionedSrc(name);
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
