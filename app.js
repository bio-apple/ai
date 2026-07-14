const navTabs = document.querySelectorAll('.nav-tab');
const navItems = document.querySelectorAll('.nav-tab, .nav-dropdown-item');
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

function gotoSearchHit(item) {
  if (item.url) {
    window.location.href = item.url;
    return;
  }
  showSection(item.section, { anchor: item.anchor || null });
  trackEvent('search-goto', { section: item.section, anchor: item.anchor || '' });
}

let activeToolFilter = 'all';
let activeScenarioFilter = 'all';

function showSection(id, { updateHash = true, anchor = null } = {}) {
  if (!document.getElementById(id)) return;
  sections.forEach(s => s.classList.toggle('active', s.id === id));
  const toolId = id === 'section-home' ? 'all' : id.replace('section-', '');

  navTabs.forEach(t => {
    const tabId = t.dataset.tool;
    const match = tabId === 'all'
      ? id === 'section-home'
      : tabId === toolId;
    t.classList.toggle('active', match);
  });

  document.querySelectorAll('.nav-dropdown-item').forEach(item => {
    item.classList.toggle('active', item.dataset.tool === toolId);
  });

  document.querySelectorAll('.nav-dropdown').forEach(drop => {
    const hasActive = [...drop.querySelectorAll('.nav-dropdown-item')].some(i => i.classList.contains('active'));
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
        if (el.classList.contains('case-card')) el.classList.add('open');
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

  window.dispatchEvent(new CustomEvent('bioai:section-change', { detail: { sectionId: id, anchor } }));
  if (typeof window.updatePageToc === 'function') window.updatePageToc(id);
}

window.showSection = showSection;

function resolveGoto(target) {
  if (target === 'cases' || target === 'videos' || target === 'news' || target === 'create' || target === 'prompts' || target === 'oss') {
    return `section-${target}`;
  }
  if (target === 'all' || target === 'home') return 'section-home';
  return `section-${target}`;
}

function bindNavItem(el) {
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    const tool = el.dataset.tool;
    if (!tool) return;
    showSection(tool === 'all' ? 'section-home' : `section-${tool}`);
    trackEvent('nav-tab', { tool });
  });
}

navTabs.forEach(bindNavItem);
document.querySelectorAll('.nav-dropdown-item').forEach(bindNavItem);

document.querySelectorAll('.tool-card-v2, .ranking-card[data-tool]').forEach(card => {
  card.addEventListener('click', (e) => {
    if (e.target.closest('.tool-card-btn')) return;
    const tool = card.dataset.tool;
    if (!tool) return;
    showSection(`section-${tool}`);
    trackEvent('tool-card', { tool });
  });
});

document.querySelectorAll('.tool-card-btn[data-tool]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    showSection(`section-${btn.dataset.tool}`);
    trackEvent('tool-card-btn', { tool: btn.dataset.tool });
  });
});

document.querySelectorAll('[data-goto]').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.goto;
    if (target === 'prompts') {
      window.location.href = 'prompts/library.html';
      return;
    }
    showSection(resolveGoto(target));
  });
});

function initNavDropdowns() {
  document.querySelectorAll('.nav-dropdown-trigger').forEach(trigger => {
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const drop = trigger.closest('.nav-dropdown');
      const wasOpen = drop.classList.contains('open');
      document.querySelectorAll('.nav-dropdown').forEach(d => d.classList.remove('open'));
      if (!wasOpen) drop.classList.add('open');
    });
  });
  document.addEventListener('click', () => {
    document.querySelectorAll('.nav-dropdown').forEach(d => d.classList.remove('open'));
  });
}

function initMobileNav() {
  const toggle = document.querySelector('.nav-toggle');
  const menu = document.querySelector('.nav-menu');
  if (!toggle || !menu) return;
  toggle.addEventListener('click', () => {
    const open = menu.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
}

function initAiPicker() {
  const options = document.querySelectorAll('.ai-picker-option');
  const groups = document.querySelectorAll('.ai-picker-tool-group');
  if (!options.length) return;

  options.forEach(opt => {
    opt.addEventListener('click', () => {
      const id = opt.dataset.picker;
      options.forEach(o => {
        o.classList.toggle('active', o === opt);
        o.setAttribute('aria-pressed', o === opt ? 'true' : 'false');
      });
      groups.forEach(g => g.classList.toggle('active', g.dataset.pickerResult === id));
      trackEvent('ai-picker', { choice: id });
    });
  });

  document.querySelectorAll('.ai-picker-tool[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => {
      showSection(`section-${btn.dataset.tool}`);
      trackEvent('ai-picker-tool', { tool: btn.dataset.tool });
    });
  });
}

function initScrollAnimations() {
  const targets = document.querySelectorAll('.fade-in');
  if (!targets.length || !('IntersectionObserver' in window)) {
    targets.forEach(el => el.classList.add('visible'));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  targets.forEach(el => observer.observe(el));
}

function initHashRouting() {
  const hash = location.hash.replace('#', '');
  const anchor = new URLSearchParams(location.search).get('anchor');
  const homeAnchors = new Set(['home-daily', 'home-recommend', 'home-favorites', 'home-tools', 'home-learning', 'home-community']);

  if (hash && homeAnchors.has(hash)) {
    showSection('section-home', { updateHash: false });
    requestAnimationFrame(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return;
  }

  if (hash && document.getElementById(hash)) {
    showSection(hash, { updateHash: false, anchor });
  } else if (anchor) {
    const section = document.getElementById(anchor)?.closest('.section')?.id
      || (anchor.startsWith('case-') ? 'section-cases' : null)
      || (document.getElementById(anchor) ? null : 'section-cases');
    if (section) showSection(section, { updateHash: false, anchor });
  }
}

window.addEventListener('hashchange', () => {
  const hash = location.hash.replace('#', '');
  const anchor = new URLSearchParams(location.search).get('anchor');
  if (hash && document.getElementById(hash)) showSection(hash, { updateHash: false, anchor });
});

/* Case accordion */
document.querySelectorAll('.case-header').forEach(header => {
  const toggle = () => {
    const card = header.closest('.case-card');
    const wasOpen = card.classList.contains('open');
    document.querySelectorAll('.case-card').forEach(c => c.classList.remove('open'));
    if (!wasOpen) {
      card.classList.add('open');
      trackEvent('case-expand', { tool: card.dataset.tool });
    }
  };
  header.addEventListener('click', toggle);
  header.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
  });
});

/* Case filter */
const filters = document.querySelectorAll('.case-filter');
const caseCards = document.querySelectorAll('.case-card[data-tool]');

function applyCaseFilters() {
  caseCards.forEach(card => {
    const toolMatch = activeToolFilter === 'all' || card.dataset.tool === activeToolFilter;
    const scenarios = (card.dataset.scenario || '').split(' ');
    const scenarioMatch = activeScenarioFilter === 'all' || scenarios.includes(activeScenarioFilter);
    card.classList.toggle('hidden', !(toolMatch && scenarioMatch));
  });
}

filters.forEach(btn => {
  btn.addEventListener('click', () => {
    filters.forEach(f => f.classList.remove('active'));
    btn.classList.add('active');
    activeToolFilter = btn.dataset.filter;
    applyCaseFilters();
    trackEvent('case-filter-tool', { filter: activeToolFilter });
  });
});

document.querySelectorAll('.case-scenario').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.case-scenario').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeScenarioFilter = btn.dataset.scenario;
    applyCaseFilters();
    trackEvent('case-filter-scenario', { scenario: activeScenarioFilter });
  });
});

document.querySelectorAll('.case-tag').forEach(tag => {
  tag.addEventListener('click', (e) => {
    e.stopPropagation();
    const map = { '写作': 'writing', '编程': 'coding', '入门': 'beginner' };
    const scenario = map[tag.textContent.trim()];
    if (!scenario) return;
    document.querySelectorAll('.case-scenario').forEach(b => {
      b.classList.toggle('active', b.dataset.scenario === scenario);
    });
    activeScenarioFilter = scenario;
    applyCaseFilters();
    showSection('section-cases', { updateHash: true });
    trackEvent('case-tag-click', { scenario });
  });
});

document.querySelectorAll('[data-goto-case]').forEach(card => {
  card.addEventListener('click', () => {
    const anchor = card.dataset.gotoCase;
    showSection('section-cases', { anchor });
    const el = document.getElementById(anchor);
    if (el) el.classList.add('open');
    trackEvent('case-preview-click', { anchor });
  });
});

function initCasesLibraryFilter() {
  const toolbar = document.getElementById('cases-toolbar');
  if (!toolbar) return;
  toolbar.querySelectorAll('[data-case-tool]').forEach(btn => {
    btn.addEventListener('click', () => {
      toolbar.querySelectorAll('[data-case-tool]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tool = btn.dataset.caseTool;
      document.querySelectorAll('.case-library-card').forEach(card => {
        const match = tool === 'all' || card.dataset.tool === tool;
        card.style.display = match ? '' : 'none';
      });
    });
  });
}

/* Copy prompt */
document.querySelectorAll('.prompt-block').forEach(block => {
  block.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(block.textContent.replace('点击复制', '').trim());
      block.classList.add('copied');
      setTimeout(() => block.classList.remove('copied'), 2000);
      trackEvent('prompt-copy');
    } catch {
      /* fallback: ignore */
    }
  });
});

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
    return fuseSearch.search(q, { limit: 10 }).map(r => r.item);
  }
  const lower = q.toLowerCase();
  return searchIndex.filter(item =>
    item.label.toLowerCase().includes(lower) ||
    item.keywords.toLowerCase().includes(lower)
  ).slice(0, 10);
}

function initSiteSearch() {
  const input = document.getElementById('site-search');
  const results = document.getElementById('site-search-results');
  if (!input || !results) return;

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
      return;
    }

    if (searchIndexStatus === 'loading') {
      results.innerHTML = '<p class="search-empty search-loading">搜索索引加载中…</p>';
      results.hidden = false;
      return;
    }

    if (searchIndexStatus === 'error') {
      results.innerHTML = '<p class="search-empty search-error">搜索暂不可用，请刷新页面后重试。</p>';
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

    results.innerHTML = hits.map(item => {
      const label = highlightMatch(item.label, query);
      const meta = item.type ? `<span class="search-hit-meta">${escapeHtml(item.type)}</span>` : '';
      if (item.url) {
        return `<a href="${escapeHtml(item.url)}" class="search-hit" data-track="search_hit">${label}${meta}</a>`;
      }
      return `<button type="button" class="search-hit" data-section="${escapeHtml(item.section)}" data-anchor="${escapeHtml(item.anchor || '')}" data-track="search_hit">${label}${meta}</button>`;
    }).join('');
    results.hidden = false;

    results.querySelectorAll('button.search-hit').forEach(btn => {
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
  initAiPicker();
  initScrollAnimations();
  initCasesLibraryFilter();
  loadSearchIndex().finally(() => {
    const input = document.getElementById('site-search');
    if (input) {
      input.dataset.searchReady = searchIndexStatus === 'ready' ? '1' : '0';
      input.dataset.searchStatus = searchIndexStatus;
    }
    initSiteSearch();
  });
});
