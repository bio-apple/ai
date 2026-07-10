const tabs = document.querySelectorAll('.nav-tab');
const sections = document.querySelectorAll('.section');
const toolCards = document.querySelectorAll('.tool-card');

let searchIndex = [];

let activeToolFilter = 'all';
let activeScenarioFilter = 'all';

function showSection(id, { updateHash = true } = {}) {
  sections.forEach(s => s.classList.toggle('active', s.id === id));
  tabs.forEach(t => {
    const tool = t.dataset.tool;
    const match = tool === 'all'
      ? id === 'section-home'
      : id === `section-${tool}`;
    t.classList.toggle('active', match);
  });
  if (updateHash && id !== 'section-home') {
    history.replaceState(null, '', `#${id}`);
  } else if (updateHash && id === 'section-home') {
    history.replaceState(null, '', location.pathname + location.search);
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resolveGoto(target) {
  if (target === 'cases' || target === 'videos') return `section-${target}`;
  if (target === 'all' || target === 'home') return 'section-home';
  return `section-${target}`;
}

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const tool = tab.dataset.tool;
    showSection(tool === 'all' ? 'section-home' : `section-${tool}`);
    trackEvent('nav-tab', { tool });
  });
});

toolCards.forEach(card => {
  card.addEventListener('click', () => {
    showSection(`section-${card.dataset.tool}`);
    trackEvent('tool-card', { tool: card.dataset.tool });
  });
});

document.querySelectorAll('[data-goto]').forEach(btn => {
  btn.addEventListener('click', () => showSection(resolveGoto(btn.dataset.goto)));
});

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
  loadSearchIndex().finally(initSiteSearch);
});
