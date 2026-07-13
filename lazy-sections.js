/**
 * 按首页 section / 预览区块懒加载业务脚本，减轻首屏与 networkidle 压力。
 * 依赖 <html data-base="/ai/">；业务脚本须支持「已过 DOMContentLoaded 时立即 init」。
 */
(function () {
  const base = (document.documentElement.dataset.base || '/ai/').replace(/\/?$/, '/');
  const loaded = new Set();

  const SECTION_SCRIPTS = {
    'section-home': ['news.js', 'videos.js', 'oss.js'],
    'section-videos': ['videos.js'],
    'section-news': ['news.js'],
    'section-oss': ['oss.js'],
    'section-prompts': ['prompts.js'],
  };

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
    return Promise.all(files.map(ensureScript));
  }

  window.addEventListener('bioai:section-change', (e) => {
    const id = e.detail && e.detail.sectionId;
    if (id) loadForSection(id);
  });

  function boot() {
    const active = document.querySelector('.section.active');
    if (active && active.id) loadForSection(active.id);

    const observeIds = ['home-news', 'home-oss', 'home-video-preview', 'home-news-preview', 'home-oss-preview'];
    if (!('IntersectionObserver' in window)) {
      loadForSection('section-home');
      return;
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((en) => en.isIntersecting)) {
        loadForSection('section-home');
        io.disconnect();
      }
    }, { rootMargin: '200px' });
    observeIds.forEach((id) => {
      const node = document.getElementById(id);
      if (node) io.observe(node);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
