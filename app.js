const navTabs = document.querySelectorAll('.nav-tab');
const _navItems = document.querySelectorAll('.nav-tab, .nav-dropdown-item');
const sections = document.querySelectorAll('.section');

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

function isNavSearchWrap(wrap) {
  return Boolean(wrap?.classList?.contains('nav-search'));
}

/** 下拉改为 fixed，避免 sticky/overflow 裁切（顶栏与 Hero 通用） */
function syncSearchDropdown(wrap, input, results) {
  if (results.hidden) {
    results.style.cssText = '';
    return;
  }
  const rect = input.getBoundingClientRect();
  const field = wrap.querySelector('.site-search-field') || input;
  const fieldRect = field.getBoundingClientRect();
  const vw = document.documentElement.clientWidth;
  const width = Math.min(Math.round(fieldRect.width || rect.width), vw - 16);
  let left = Math.round(fieldRect.left || rect.left);
  left = Math.max(8, Math.min(left, vw - width - 8));
  results.style.position = 'fixed';
  results.style.top = `${Math.round(rect.bottom + 6)}px`;
  results.style.left = `${left}px`;
  results.style.width = `${width}px`;
  results.style.right = 'auto';
  results.style.zIndex = isNavSearchWrap(wrap) ? '1000' : '80';
}

function setSearchDropdownOpen(wrap, input, results, open) {
  results.hidden = !open;
  input.setAttribute('aria-expanded', open ? 'true' : 'false');
  syncSearchDropdown(wrap, input, results);
}

function gotoSearchHit(item, query = '') {
  const q = query.trim();
  if (q) pushSearchHistory(q);

  if (item.url) {
    const url = resolveSearchUrl(item.url);
    const external = item.external || /^https?:\/\//i.test(String(item.url));
    if (external) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      window.location.href = url;
    }
    return;
  }

  if (item.section) {
    const onHome = Boolean(document.getElementById(item.section));
    if (!onHome) {
      const base = siteBase();
      const u = new URL(`${base}index.html`, location.origin);
      u.hash = item.section;
      if (item.anchor) u.searchParams.set('anchor', item.anchor);
      window.location.href = `${u.pathname}${u.search}${u.hash}`;
      return;
    }
    showSection(item.section, { anchor: item.anchor || null });
    trackEvent('search-goto', { section: item.section, anchor: item.anchor || '' });
  }
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
document.querySelectorAll('.breadcrumb a[data-tool]').forEach(bindNavItem);

document.querySelectorAll('[data-goto]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.goto;
    if (target === 'prompts' || target === 'oss') {
      showSection(resolveGoto('local'));
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
  'home-ai-map',
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
const SEARCH_HISTORY_KEY = 'bioai.search.history.v1';
const SEARCH_HISTORY_MAX = 8;
const SEARCH_RESULT_LIMIT = 15;
const DEFAULT_SUGGESTIONS = ['ChatGPT', 'Cursor', 'DeepSeek', 'Claude', 'Ollama', 'RAG'];

let searchIndex = [];
let fuseSearch = null;
let searchIndexStatus = 'loading'; // loading | ready | error

function loadSearchHistory() {
  try {
    const raw = JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((q) => typeof q === 'string' && q.trim()) : [];
  } catch {
    return [];
  }
}

function pushSearchHistory(query) {
  const q = query.trim();
  if (!q || q.length < 2) return;
  const next = [q, ...loadSearchHistory().filter((item) => item !== q)].slice(
    0,
    SEARCH_HISTORY_MAX,
  );
  try {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next));
  } catch {
    /* private mode */
  }
}

function clearSearchHistory() {
  try {
    localStorage.removeItem(SEARCH_HISTORY_KEY);
  } catch {
    /* ignore */
  }
}

function getCuratedSuggestions(wrap) {
  try {
    const raw = wrap?.dataset?.searchSuggestions;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed.map(String);
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_SUGGESTIONS;
}

async function loadSearchIndex() {
  searchIndexStatus = 'loading';
  try {
    const res = await fetch(`${siteBase()}search-index.json`, { cache: 'default' });
    if (!res.ok) throw new Error('search index unavailable');
    const data = await res.json();
    if (Array.isArray(data) && data.length) {
      searchIndex = data;
      if (typeof Fuse !== 'undefined') {
        fuseSearch = new Fuse(searchIndex, {
          keys: [
            { name: 'label', weight: 0.55 },
            { name: 'keywords', weight: 0.45 },
            { name: 'type', weight: 0.12 },
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

function preferSearchHits(hits, query) {
  const q = query.trim().toLowerCase();
  if (!q || hits.length < 2) return hits;
  const rank = (item) => {
    const label = String(item.label || '').toLowerCase();
    let score = 0;
    if (label === q) score += 100;
    else if (label.startsWith(q)) score += 60;
    else if (label.includes(q)) score += 30;
    const url = String(item.url || '');
    if (/^tools\/[^/]+\.html$/i.test(url)) score += 40;
    if (item.type === '工具') score += 12;
    if (item.external) score -= 8;
    if (/hub\.html#hub-compare/i.test(url)) score -= 20;
    return score;
  };
  return [...hits].sort((a, b) => rank(b) - rank(a));
}

function runSearch(query) {
  const q = query.trim();
  if (!q) return [];
  let hits;
  if (fuseSearch) {
    hits = fuseSearch.search(q, { limit: SEARCH_RESULT_LIMIT }).map((r) => r.item);
  } else {
    const lower = q.toLowerCase();
    hits = searchIndex
      .filter(
        (item) =>
          item.label.toLowerCase().includes(lower) || item.keywords.toLowerCase().includes(lower),
      )
      .slice(0, SEARCH_RESULT_LIMIT);
  }
  return preferSearchHits(hits, q);
}

function isExternalHit(item) {
  return Boolean(item.external || (item.url && /^https?:\/\//i.test(String(item.url))));
}

function renderSearchHit(item, query) {
  const label = highlightMatch(item.label, query);
  const meta = item.type ? `<span class="search-hit-meta">${escapeHtml(item.type)}</span>` : '';
  const qAttr = escapeHtml(query.slice(0, 80));
  const external = isExternalHit(item);
  const extMark = external ? '<span class="search-hit-ext" aria-hidden="true">↗</span>' : '';
  if (item.url) {
    const attrs = external ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `<a href="${escapeHtml(resolveSearchUrl(item.url))}" class="search-hit"${attrs} data-track="search_hit" data-search-query="${qAttr}">${label}${meta}${extMark}</a>`;
  }
  return `<button type="button" class="search-hit" data-section="${escapeHtml(item.section)}" data-anchor="${escapeHtml(item.anchor || '')}" data-track="search_hit" data-search-query="${qAttr}">${label}${meta}</button>`;
}

function renderSuggestionsPanel(wrap, input, results) {
  const history = loadSearchHistory();
  const curated = getCuratedSuggestions(wrap);
  let html = '';

  if (history.length) {
    html += `<div class="search-panel-section">
      <div class="search-panel-head">
        <p class="search-panel-label">最近搜索</p>
        <button type="button" class="search-panel-clear" data-action="clear-history">清除</button>
      </div>
      <div class="search-suggest-row">${history
        .map(
          (q) =>
            `<button type="button" class="search-suggest-chip search-history-chip" data-query="${escapeHtml(q)}">${escapeHtml(q)}</button>`,
        )
        .join('')}</div>
    </div>`;
  }

  html += `<div class="search-panel-section">
    <p class="search-panel-label">搜索联想</p>
    <div class="search-suggest-row">${curated
      .map(
        (q) =>
          `<button type="button" class="search-suggest-chip" data-query="${escapeHtml(q)}">${escapeHtml(q)}</button>`,
      )
      .join('')}</div>
  </div>`;

  results.innerHTML = html;
  setSearchDropdownOpen(wrap, input, results, true);

  results.querySelector('[data-action="clear-history"]')?.addEventListener('click', (e) => {
    e.preventDefault();
    clearSearchHistory();
    renderSuggestionsPanel(wrap, input, results);
  });

  results.querySelectorAll('[data-query]').forEach((btn) => {
    btn.addEventListener('click', () => {
      input.value = btn.dataset.query || '';
      renderSearchResults(wrap, input, results, input.value);
      input.focus();
    });
  });
}

function bindSearchHitActions(wrap, input, results, query) {
  results.querySelectorAll('button.search-hit').forEach((btn) => {
    btn.addEventListener('click', () => {
      gotoSearchHit(
        {
          section: btn.dataset.section,
          anchor: btn.dataset.anchor || null,
        },
        query,
      );
      input.value = '';
      setSearchDropdownOpen(wrap, input, results, false);
    });
  });

  results.querySelectorAll('a.search-hit').forEach((link) => {
    link.addEventListener('click', () => {
      pushSearchHistory(query);
      setSearchDropdownOpen(wrap, input, results, false);
    });
  });
}

function renderSearchResults(wrap, input, results, rawQuery) {
  const query = rawQuery.trim();
  if (!query) {
    renderSuggestionsPanel(wrap, input, results);
    return;
  }

  if (searchIndexStatus === 'loading') {
    results.innerHTML = '<p class="search-empty search-loading">搜索索引加载中…</p>';
    setSearchDropdownOpen(wrap, input, results, true);
    return;
  }

  if (searchIndexStatus === 'error') {
    results.innerHTML = '<p class="search-empty search-error">搜索暂不可用，请刷新页面后重试。</p>';
    setSearchDropdownOpen(wrap, input, results, true);
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
          <a href="${escapeHtml(siteBase())}tools/hub.html" class="search-empty-link" data-track="search_empty_hub">浏览工具中心</a>
        </div>
      </div>`;
    setSearchDropdownOpen(wrap, input, results, true);
    if (typeof trackEvent === 'function') trackEvent('search_empty', { q: query.slice(0, 40) });
    return;
  }

  const grouped = new Map();
  for (const hit of hits) {
    const type = hit.type || '其他';
    if (!grouped.has(type)) grouped.set(type, []);
    grouped.get(type).push(hit);
  }

  results.innerHTML = [...grouped.entries()]
    .map(
      ([type, items]) => `<div class="search-group">
        <p class="search-group-label">${escapeHtml(type)}</p>
        ${items.map((item) => renderSearchHit(item, query)).join('')}
      </div>`,
    )
    .join('');
  setSearchDropdownOpen(wrap, input, results, true);
  bindSearchHitActions(wrap, input, results, query);
}

function initSearchWrap(wrap) {
  const input = wrap.querySelector('.site-search-input');
  const results = wrap.querySelector('.site-search-results');
  if (!input || !results) return;

  let searchQueryTimer = null;
  let lastTrackedQuery = '';
  let activeIndex = -1;

  function scheduleSearchQueryTrack(query, resultCount) {
    const q = query.trim();
    if (!q || q === lastTrackedQuery) return;
    clearTimeout(searchQueryTimer);
    searchQueryTimer = setTimeout(() => {
      lastTrackedQuery = q;
      if (typeof trackEvent === 'function') {
        trackEvent('search_query', { q: q.slice(0, 80), result_count: resultCount });
      }
    }, 600);
  }

  function markReady() {
    input.dataset.searchReady = searchIndexStatus === 'ready' ? '1' : '0';
    input.dataset.searchStatus = searchIndexStatus;
  }
  markReady();

  function updateActiveHit() {
    const hits = [...results.querySelectorAll('.search-hit')];
    hits.forEach((el, i) => el.classList.toggle('search-hit-active', i === activeIndex));
    if (activeIndex >= 0 && hits[activeIndex]) {
      hits[activeIndex].scrollIntoView({ block: 'nearest' });
    }
  }

  function renderResults(rawQuery) {
    activeIndex = -1;
    renderSearchResults(wrap, input, results, rawQuery);
    const q = rawQuery.trim();
    if (q && searchIndexStatus === 'ready') {
      scheduleSearchQueryTrack(q, runSearch(q).length);
    }
  }

  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', results.id || 'site-search-results');
  input.setAttribute('aria-expanded', 'false');
  results.setAttribute('role', 'listbox');

  input.addEventListener('input', () => renderResults(input.value));
  input.addEventListener('focus', () => {
    if (!input.value.trim()) renderSuggestionsPanel(wrap, input, results);
    else renderResults(input.value);
  });
  input.addEventListener('search', () => {
    // type=search 的清除/回车会触发 search；空值时收起，有值时走提交
    if (!input.value.trim()) {
      setSearchDropdownOpen(wrap, input, results, false);
      return;
    }
    activatePrimaryHit();
  });

  function activatePrimaryHit() {
    renderResults(input.value);
    const hits = [...results.querySelectorAll('.search-hit')];
    const target = activeIndex >= 0 && hits[activeIndex] ? hits[activeIndex] : hits[0] || null;
    if (target) {
      target.click();
      return true;
    }
    if (!input.value.trim()) renderSuggestionsPanel(wrap, input, results);
    return false;
  }

  const submitBtn = wrap.querySelector('.site-search-submit');
  submitBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!input.value.trim()) {
      input.focus();
      renderSuggestionsPanel(wrap, input, results);
      return;
    }
    activatePrimaryHit();
  });

  input.addEventListener('keydown', (e) => {
    const hits = [...results.querySelectorAll('.search-hit')];
    if (e.key === 'Escape') {
      input.value = '';
      setSearchDropdownOpen(wrap, input, results, false);
      activeIndex = -1;
      return;
    }
    if (e.key === 'ArrowDown' && hits.length && !results.hidden) {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, hits.length - 1);
      updateActiveHit();
      return;
    }
    if (e.key === 'ArrowUp' && hits.length && !results.hidden) {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      updateActiveHit();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      activatePrimaryHit();
    }
  });

  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target) && !results.contains(e.target)) {
      setSearchDropdownOpen(wrap, input, results, false);
    }
  });

  const reposition = () => {
    if (!results.hidden) syncSearchDropdown(wrap, input, results);
  };
  window.addEventListener('scroll', reposition, { passive: true });
  window.addEventListener('resize', reposition);

  const params = new URLSearchParams(location.search);
  const q = params.get('q');
  if (q && wrap.querySelector('#site-search, #nav-site-search') === input) {
    input.value = q;
    renderResults(q);
    if (typeof trackEvent === 'function') {
      trackEvent('search_query', { q: q.slice(0, 80), entry_source: 'url_param' });
    }
  }

  const poll = setInterval(() => {
    markReady();
    if (searchIndexStatus !== 'loading') {
      clearInterval(poll);
      if (input.value.trim()) renderResults(input.value);
    }
  }, 50);
}

function initSiteSearch() {
  document.querySelectorAll('.site-search-wrap').forEach((wrap) => initSearchWrap(wrap));
}

document.addEventListener('DOMContentLoaded', () => {
  initHashRouting();
  initNavDropdowns();
  initMobileNav();
  initScrollAnimations();
  loadSearchIndex().finally(() => {
    document.querySelectorAll('.site-search-input').forEach((input) => {
      input.dataset.searchReady = searchIndexStatus === 'ready' ? '1' : '0';
      input.dataset.searchStatus = searchIndexStatus;
    });
    initSiteSearch();
  });
});
