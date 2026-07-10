const navTabs = document.querySelectorAll('.nav-tab');
const navItems = document.querySelectorAll('.nav-tab, .nav-dropdown-item');
const sections = document.querySelectorAll('.section');

let searchIndex = [];

let activeToolFilter = 'all';
let activeScenarioFilter = 'all';

function showSection(id, { updateHash = true } = {}) {
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

  if (updateHash && id !== 'section-home') {
    history.replaceState(null, '', `#${id}`);
  } else if (updateHash && id === 'section-home') {
    history.replaceState(null, '', location.pathname + location.search);
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });

  document.querySelector('.nav-menu')?.classList.remove('open');
  document.querySelector('.nav-toggle')?.setAttribute('aria-expanded', 'false');
}

function resolveGoto(target) {
  if (target === 'cases' || target === 'videos' || target === 'news' || target === 'create') {
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
  btn.addEventListener('click', () => showSection(resolveGoto(btn.dataset.goto)));
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
  if (hash && document.getElementById(hash)) {
    showSection(hash, { updateHash: false });
  }
}

window.addEventListener('hashchange', () => {
  const hash = location.hash.replace('#', '');
  if (hash && document.getElementById(hash)) showSection(hash, { updateHash: false });
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
async function loadSearchIndex() {
  try {
    const res = await fetch('search-index.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('search index unavailable');
    const data = await res.json();
    if (Array.isArray(data) && data.length) searchIndex = data;
  } catch {
    searchIndex = [];
  }
}

function initSiteSearch() {
  const input = document.getElementById('site-search');
  const results = document.getElementById('site-search-results');
  if (!input || !results) return;

  function renderResults(q) {
    const query = q.trim().toLowerCase();
    if (!query) {
      results.hidden = true;
      results.innerHTML = '';
      return;
    }
    const hits = searchIndex.filter(item =>
      item.label.toLowerCase().includes(query) ||
      item.keywords.toLowerCase().includes(query)
    ).slice(0, 8);

    if (!hits.length) {
      results.innerHTML = '<p class="search-empty">未找到匹配内容</p>';
      results.hidden = false;
      return;
    }

    results.innerHTML = hits.map(item => {
      if (item.url) {
        return `<a href="${item.url}" class="search-hit" data-track="search-external">${item.label}</a>`;
      }
      return `<button type="button" class="search-hit" data-section="${item.section}">${item.label}</button>`;
    }).join('');
    results.hidden = false;

    results.querySelectorAll('[data-section]').forEach(btn => {
      btn.addEventListener('click', () => {
        showSection(btn.dataset.section);
        input.value = '';
        results.hidden = true;
        trackEvent('search-goto', { section: btn.dataset.section });
      });
    });
  }

  input.addEventListener('input', () => renderResults(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      input.value = '';
      results.hidden = true;
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
}

document.addEventListener('DOMContentLoaded', () => {
  initHashRouting();
  initNavDropdowns();
  initMobileNav();
  initAiPicker();
  initScrollAnimations();
  loadSearchIndex().finally(initSiteSearch);
});
