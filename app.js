const navTabs = document.querySelectorAll('.nav-tab');
const _navItems = document.querySelectorAll('.nav-tab, .nav-dropdown-item');
const sections = document.querySelectorAll('.section');

let searchIndex = [];
let fuseSearch = null;

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function highlightMatch(text, query) {
  if (!query) return escapeHtml(text);
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return escapeHtml(text);
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + query.length);
  const after = text.slice(idx + query.length);
  return `${escapeHtml(before)}<strong>${escapeHtml(match)}</strong>${escapeHtml(after)}`;
}

function resolveSearchUrl(url) {
  if (!url) return url;
  if (/^(https?:|\/|#)/.test(url)) return url;
  return `${siteBase()}${String(url).replace(/^\//, '')}`;
}

function gotoSearchHit(item) {
  if (item.url) {
    window.location.href = resolveSearchUrl(item.url);
    return;
  }
  showSection(item.section, { anchor: item.anchor || null });
  trackEvent('search-goto', { section: item.section, anchor: item.anchor || '' });
}

function showSection(id, { updateHash = true, anchor = null } = {}) {
  const target = document.getElementById(id);
  // 只切换顶层 .section，避免 #home-daily 等锚点误当作整页 section
  if (!target || !target.classList.contains('section')) return;
  sections.forEach((s) => s.classList.toggle('active', s.id === id));
  const toolId = id === 'section-home' ? 'all' : id.replace('section-', '');

  navTabs.forEach((t) => {
    const tabId = t.dataset.tool;
    const match = tabId === 'all' ? id === 'section-home' : tabId === toolId;
    t.classList.toggle('active', match);
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
        return;
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  } else {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  document.querySelector('.nav-menu')?.classList.remove('open');
  document.querySelector('.nav-toggle')?.setAttribute('aria-expanded', 'false');
  document.body.style.overflow = '';

  window.dispatchEvent(
    new CustomEvent('bioai:section-change', { detail: { sectionId: id, anchor } }),
  );
  if (typeof window.updatePageToc === 'function') window.updatePageToc(id);
}

window.showSection = showSection;

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

navTabs.forEach(bindNavItem);
document.querySelectorAll('.nav-dropdown-item').forEach(bindNavItem);
document.querySelectorAll('a.logo[data-tool]').forEach(bindNavItem);

document.querySelectorAll('[data-goto]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.goto;
    if (target === 'prompts') {
      showSection(resolveGoto('oss'));
      return;
    }
    showSection(resolveGoto(target));
  });
});

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

const HOME_HASH_ANCHORS = new Set([
  'home-daily',
  'home-recommend',
  'home-ops',
  'home-community',
  'home-oss',
]);

function siteBase() {
  const raw = document.documentElement.dataset.base || '/ai/';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

function applyLocationHash() {
  const hash = location.hash.replace('#', '');
  const anchor = new URLSearchParams(location.search).get('anchor');

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

function initHashRouting() {
  applyLocationHash();
}

window.addEventListener('hashchange', applyLocationHash);

/* Site search */
let searchIndexStatus = 'loading'; // loading | ready | error

async function loadSearchIndex() {
  searchIndexStatus = 'loading';
  try {
    const res = await fetch('search-index.json', { cache: 'default' });
    if (!res.ok) throw new Error('search index unavailable');
    const data = await res.json();
    if (Array.isArray(data) && data.length) {
      searchIndex = data;
      if (typeof Fuse !== 'undefined') {
        fuseSearch = new Fuse(searchIndex, {
          keys: [
            { name: 'label', weight: 0.55 },
            { name: 'keywords', weight: 0.45 },
          ],
          threshold: 0.38,
          ignoreLocation: true,
          minMatchCharLength: 2,
        });
      }
      searchIndexStatus = 'ready';
    } else {
      searchIndexStatus = 'error';
    }
  } catch {
    searchIndex = [];
    fuseSearch = null;
    searchIndexStatus = 'error';
  }
}

function runSearch(query) {
  const q = query.trim();
  if (!q) return [];
  if (fuseSearch) {
    return fuseSearch.search(q, { limit: 10 }).map((r) => r.item);
  }
  const lower = q.toLowerCase();
  return searchIndex
    .filter(
      (item) =>
        item.label.toLowerCase().includes(lower) || item.keywords.toLowerCase().includes(lower),
    )
    .slice(0, 10);
}

function initSiteSearch() {
  const input = document.getElementById('site-search');
  const results = document.getElementById('site-search-results');
  if (!input || !results) return;

  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', 'site-search-results');
  input.setAttribute('aria-expanded', 'false');
  results.setAttribute('role', 'listbox');

  function markReady() {
    input.dataset.searchReady = searchIndexStatus === 'ready' ? '1' : '0';
    input.dataset.searchStatus = searchIndexStatus;
  }
  markReady();

  function renderResults(q) {
    const query = q.trim();
    if (!query) {
      results.hidden = true;
      results.innerHTML = '';
      input.setAttribute('aria-expanded', 'false');
      return;
    }

    if (searchIndexStatus === 'loading') {
      results.innerHTML = '<p class="search-empty search-loading">搜索索引加载中…</p>';
      results.hidden = false;
      return;
    }

    if (searchIndexStatus === 'error') {
      results.innerHTML =
        '<p class="search-empty search-error">搜索暂不可用，请刷新页面后重试。</p>';
      results.hidden = false;
      if (typeof trackEvent === 'function') trackEvent('search_error', { q: query.slice(0, 40) });
      return;
    }

    const hits = runSearch(query);

    if (!hits.length) {
      results.innerHTML = `
        <div class="search-empty">
          <p>未找到「${escapeHtml(query)}」相关内容</p>
          <div class="search-empty-actions">
            <a href="#home-recommend" class="search-empty-link" data-track="search_empty_recommend">试试 AI 推荐助手</a>
            <a href="tools/hub.html" class="search-empty-link" data-track="search_empty_hub">浏览工具中心</a>
          </div>
        </div>`;
      results.hidden = false;
      if (typeof trackEvent === 'function') trackEvent('search_empty', { q: query.slice(0, 40) });
      return;
    }

    results.innerHTML = hits
      .map((item) => {
        const label = highlightMatch(item.label, query);
        const meta = item.type
          ? `<span class="search-hit-meta">${escapeHtml(item.type)}</span>`
          : '';
        if (item.url) {
          return `<a href="${escapeHtml(resolveSearchUrl(item.url))}" class="search-hit" data-track="search_hit">${label}${meta}</a>`;
        }
        return `<button type="button" class="search-hit" data-section="${escapeHtml(item.section)}" data-anchor="${escapeHtml(item.anchor || '')}" data-track="search_hit">${label}${meta}</button>`;
      })
      .join('');
    results.hidden = false;
    input.setAttribute('aria-expanded', 'true');

    results.querySelectorAll('button.search-hit').forEach((btn) => {
      btn.addEventListener('click', () => {
        gotoSearchHit({
          section: btn.dataset.section,
          anchor: btn.dataset.anchor || null,
        });
        input.value = '';
        results.hidden = true;
      });
    });
  }

  input.addEventListener('input', () => renderResults(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      input.value = '';
      results.hidden = true;
    }
    if (e.key === 'Enter') {
      const first = results.querySelector('.search-hit');
      if (first && !results.hidden) {
        e.preventDefault();
        first.click();
      }
    }
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.site-search-wrap')) results.hidden = true;
  });

  const params = new URLSearchParams(location.search);
  const q = params.get('q');
  if (q) {
    input.value = q;
    renderResults(q);
  }

  // 索引异步完成后刷新就绪标记与当前查询
  const _origMark = markReady;
  const poll = setInterval(() => {
    _origMark();
    if (searchIndexStatus !== 'loading') {
      clearInterval(poll);
      if (input.value.trim()) renderResults(input.value);
    }
  }, 50);
}

document.addEventListener('DOMContentLoaded', () => {
  initHashRouting();
  initNavDropdowns();
  initMobileNav();
  initScrollAnimations();
  loadSearchIndex().finally(() => {
    const input = document.getElementById('site-search');
    if (input) {
      input.dataset.searchReady = searchIndexStatus === 'ready' ? '1' : '0';
      input.dataset.searchStatus = searchIndexStatus;
    }
    initSiteSearch();
  });
});
