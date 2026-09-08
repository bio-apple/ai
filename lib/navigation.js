/** 导航 / 旧 hash 专区跳转 / 移动端菜单 / 滚动入场 */
(function initNavigationLib() {
  window.BioAI = window.BioAI || {};

  const SECTION_PAGE_MAP = {
    'section-oss': 'oss.html',
    'section-courses': 'courses.html',
    'section-news': 'news/daily-ai-news.html',
    'section-videos': 'videos.html',
  };

  const HOME_HASH_ANCHORS = new Set([
    'home-daily',
    'home-recommend',
    'home-ops',
    'home-community',
    'home-ai-map',
  ]);

  function siteBase() {
    const raw = document.documentElement.dataset.base || '/ai/';
    return raw.endsWith('/') ? raw : `${raw}/`;
  }

  function redirectLegacySection(hash) {
    const id = String(hash || '')
      .replace(/^#/, '')
      .split('?')[0];
    const page = SECTION_PAGE_MAP[id];
    if (!page) return false;
    window.location.replace(`${siteBase()}${page}`);
    return true;
  }

  function showSection(id, { updateHash = true, anchor = null } = {}) {
    if (redirectLegacySection(id)) return;

    const target = document.getElementById(id);
    const sections = document.querySelectorAll('.section');
    const navTabs = document.querySelectorAll('.nav-tab');
    // 只切换顶层 .section，避免 #home-daily 等锚点误当作整页 section
    if (!target || !target.classList.contains('section')) return;
    sections.forEach((s) => s.classList.toggle('active', s.id === id));
    const toolId = id === 'section-home' ? 'all' : id.replace('section-', '');

    navTabs.forEach((t) => {
      const tabId = t.dataset.tool;
      const match = tabId === 'all' ? id === 'section-home' : tabId === toolId;
      t.classList.toggle('active', match);
      if (t.getAttribute('role') === 'tab') {
        t.setAttribute('aria-selected', match ? 'true' : 'false');
      }
    });

    document.querySelectorAll('.nav-dropdown-item').forEach((item) => {
      item.classList.toggle('active', item.dataset.tool === toolId);
    });

    document.querySelectorAll('.nav-dropdown').forEach((drop) => {
      const hasActive = [...drop.querySelectorAll('.nav-dropdown-item')].some((i) =>
        i.classList.contains('active'),
      );
      drop.classList.toggle('has-active', hasActive);
    });

    if (updateHash) {
      const url = new URL(location.href);
      if (id !== 'section-home') {
        url.hash = id;
        if (anchor) url.searchParams.set('anchor', anchor);
        else url.searchParams.delete('anchor');
        history.replaceState(null, '', url);
      } else {
        url.hash = '';
        url.searchParams.delete('anchor');
        history.replaceState(null, '', url.pathname + url.search);
      }
    }

    if (anchor) {
      requestAnimationFrame(() => {
        const el = document.getElementById(anchor);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          el.focus?.({ preventScroll: true });
          return;
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    requestAnimationFrame(() => {
      const focusTarget = target.querySelector('h1, h2, [tabindex]:not([tabindex="-1"])') || target;
      if (focusTarget && typeof focusTarget.focus === 'function') {
        if (!focusTarget.hasAttribute('tabindex')) focusTarget.setAttribute('tabindex', '-1');
        focusTarget.focus({ preventScroll: true });
      } else {
        document.getElementById('main-content')?.focus({ preventScroll: true });
      }
    });

    document.querySelector('.nav-menu')?.classList.remove('open');
    const navToggle = document.querySelector('.nav-toggle');
    if (navToggle) {
      navToggle.setAttribute('aria-expanded', 'false');
      navToggle.setAttribute('aria-label', '打开导航');
    }
    document.body.style.overflow = '';

    window.dispatchEvent(
      new CustomEvent('bioai:section-change', { detail: { sectionId: id, anchor } }),
    );
    if (typeof window.updatePageToc === 'function') window.updatePageToc(id);
  }

  function resolveGoto(target) {
    if (target === 'all' || target === 'home') return 'section-home';
    return `section-${target}`;
  }

  function bindNavItem(el) {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const tool = el.dataset.tool;
      if (!tool) return;
      const sectionId = tool === 'all' ? 'section-home' : `section-${tool}`;
      const target = document.getElementById(sectionId);
      if (!target || !target.classList.contains('section')) return;
      e.preventDefault();
      showSection(sectionId);
      trackEvent('nav-tab', { tool });
    });
  }

  function initNavDropdowns() {
    document.querySelectorAll('.nav-dropdown-trigger').forEach((trigger) => {
      trigger.setAttribute('aria-expanded', 'false');
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const drop = trigger.closest('.nav-dropdown');
        const wasOpen = drop.classList.contains('open');
        document.querySelectorAll('.nav-dropdown').forEach((d) => {
          d.classList.remove('open');
          d.querySelector('.nav-dropdown-trigger')?.setAttribute('aria-expanded', 'false');
        });
        if (!wasOpen) {
          drop.classList.add('open');
          trigger.setAttribute('aria-expanded', 'true');
        }
      });
    });
    document.addEventListener('click', () => {
      document.querySelectorAll('.nav-dropdown').forEach((d) => {
        d.classList.remove('open');
        d.querySelector('.nav-dropdown-trigger')?.setAttribute('aria-expanded', 'false');
      });
    });
  }

  function initMobileNav() {
    const toggle = document.querySelector('.nav-toggle');
    const menu = document.querySelector('.nav-menu');
    if (!toggle || !menu) return;
    toggle.addEventListener('click', () => {
      const open = menu.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? '关闭导航' : '打开导航');
      document.body.style.overflow = open ? 'hidden' : '';
    });
  }

  function initScrollAnimations() {
    const targets = document.querySelectorAll('.fade-in');
    if (!targets.length || !('IntersectionObserver' in window)) {
      targets.forEach((el) => el.classList.add('visible'));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    );
    targets.forEach((el) => observer.observe(el));
  }

  function applyLocationHash() {
    const hash = location.hash.replace('#', '');
    const anchor = new URLSearchParams(location.search).get('anchor');

    if (hash && redirectLegacySection(hash)) return;

    if (hash && HOME_HASH_ANCHORS.has(hash)) {
      showSection('section-home', { updateHash: false });
      requestAnimationFrame(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      return;
    }

    if (hash && document.getElementById(hash)?.classList.contains('section')) {
      showSection(hash, { updateHash: false, anchor });
      return;
    }

    if (anchor) {
      const section = document.getElementById(anchor)?.closest('.section')?.id;
      if (section) showSection(section, { updateHash: false, anchor });
    }
  }

  function initNavigation() {
    document.querySelectorAll('.nav-tab').forEach(bindNavItem);
    document.querySelectorAll('.nav-dropdown-item').forEach(bindNavItem);
    document.querySelectorAll('a.logo[data-tool]').forEach(bindNavItem);
    document.querySelectorAll('.breadcrumb a[data-tool]').forEach(bindNavItem);

    document.querySelectorAll('[data-goto]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = btn.dataset.goto;
        if (!target) return;
        const sectionId = resolveGoto(target);
        if (SECTION_PAGE_MAP[sectionId]) {
          e.preventDefault();
          window.location.href = `${siteBase()}${SECTION_PAGE_MAP[sectionId]}`;
          return;
        }
        e.preventDefault();
        showSection(sectionId);
      });
    });

    initNavDropdowns();
    initMobileNav();
    initScrollAnimations();
    applyLocationHash();
    window.addEventListener('hashchange', applyLocationHash);
  }

  window.showSection = showSection;
  window.BioAI.siteBase = siteBase;
  window.BioAI.SECTION_PAGE_MAP = SECTION_PAGE_MAP;
  window.BioAI.redirectLegacySection = redirectLegacySection;
  window.BioAI.initNavigation = initNavigation;
})();
