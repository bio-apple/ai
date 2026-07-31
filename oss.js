const OSS_DATA_URL = (typeof document !== 'undefined' && document.documentElement.dataset.base
  ? document.documentElement.dataset.base.replace(/\/?$/, '/')
  : '') + 'oss-projects.json';

const DOMAIN_COLORS = {
  'agent-framework': '#2563eb',
  'inference-framework': '#10b981',
  'vector-db': '#f59e0b',
  'eval-benchmark': '#f43f5e',
  'local-deployment': '#8b5cf6',
};

let ossDataPromise = null;

function formatStars(n) {
  if (!n) return '—';
  return n.toLocaleString('zh-CN');
}

function computeGlobalRanks(data) {
  const items = flattenProjects(data);
  const ranks = new Map();
  items.forEach(({ project }, idx) => {
    ranks.set(project.id, idx + 1);
  });
  return ranks;
}

function renderOssCard(project, domainLabel, domainId, rank) {
  const color = DOMAIN_COLORS[domainId] || '';
  const style = color ? `style="--domain-color:${color}"` : '';
  const rankHtml = rank ? `<span class="oss-rank">#${rank}</span>` : '';
  const topBadge = rank && rank <= 3 ? `<span class="oss-top-badge">TOP${rank}</span>` : '';
  return `
    <article class="oss-card" ${style}>
      <div class="oss-card-head">
        <span class="oss-domain-badge">${escapeHtml(domainLabel)}</span>
        <span class="oss-stars">★ ${escapeHtml(formatStars(project.stars))}</span>
      </div>
      <h4>${rankHtml}<a href="${escapeHtml(project.url)}" target="_blank" rel="noopener" data-track="oss-click">${escapeHtml(project.name)}</a>${topBadge}</h4>
      <p class="oss-repo">${escapeHtml(project.repo)}</p>
      <p class="oss-summary">${escapeHtml(project.description || '')}</p>
      <a href="${escapeHtml(project.url)}" target="_blank" rel="noopener" class="oss-read" data-track="oss-read">在 GitHub 打开 →</a>
    </article>
  `;
}

function fetchOssData() {
  if (!ossDataPromise) {
    ossDataPromise = fetch(OSS_DATA_URL, { cache: 'default' })
      .then(res => {
        if (!res.ok) throw new Error('无法加载开源项目数据');
        return res.json();
      })
      .catch(err => {
        ossDataPromise = null;
        throw err;
      });
  }
  return ossDataPromise;
}

function flattenProjects(data) {
  const items = [];
  for (const domain of data.domains || []) {
    for (const project of domain.projects || []) {
      items.push({ project, domain });
    }
  }
  return items.sort((a, b) => (b.project.stars || 0) - (a.project.stars || 0));
}

function renderOssGrid(items, ranks) {
  if (!items.length) {
    return '<p class="loading-hint">暂无开源项目数据。</p>';
  }
  return `<div class="oss-grid">${items.map(({ project, domain }) => renderOssCard(project, domain.label, domain.id, ranks.get(project.id))).join('')}</div>`;
}

function renderOssByDomain(data, activeDomain = 'all') {
  const domains = data.domains || [];
  const ranks = computeGlobalRanks(data);
  const allActive = activeDomain === 'all' ? 'active' : '';
  const toolbar = `
    <div class="library-toolbar oss-toolbar" id="oss-toolbar">
      <button type="button" class="library-filter ${allActive}" data-oss-domain="all">全部领域</button>
      ${domains.map(d => {
        const active = d.id === activeDomain ? 'active' : '';
        return `<button type="button" class="library-filter ${active}" data-oss-domain="${escapeHtml(d.id)}">${escapeHtml(d.label)} (${d.projects?.length || 0})</button>`;
      }).join('')}
    </div>
  `;

  if (activeDomain === 'all') {
    const blocks = domains.map(domain => {
      const projects = domain.projects || [];
      const color = DOMAIN_COLORS[domain.id] || '';
      const style = color ? `style="--domain-color:${color}"` : '';
      const grid = projects.length
        ? `<div class="oss-grid">${projects.map(p => renderOssCard(p, domain.label, domain.id, ranks.get(p.id))).join('')}</div>`
        : '<p class="loading-hint">该分类下暂无项目。</p>';
      return `
        <div class="oss-domain-block" data-oss-block="${escapeHtml(domain.id)}" ${style}>
          <h4 class="oss-domain-title">${escapeHtml(domain.label)} <span class="oss-domain-desc">${escapeHtml(domain.description || '')}</span></h4>
          ${grid}
        </div>
      `;
    }).join('');
    return toolbar + blocks;
  }

  const domain = domains.find(d => d.id === activeDomain);
  if (!domain) return toolbar + '<p class="loading-hint">暂无该领域项目。</p>';
  const color = DOMAIN_COLORS[domain.id] || '';
  const style = color ? `style="--domain-color:${color}"` : '';
  const projects = domain.projects || [];
  const grid = projects.length
    ? `<div class="oss-grid">${projects.map(p => renderOssCard(p, domain.label, domain.id, ranks.get(p.id))).join('')}</div>`
    : '<p class="loading-hint">该分类下暂无项目。</p>';
  return toolbar + `
    <div class="oss-domain-block" ${style}>
      <h4 class="oss-domain-title">${escapeHtml(domain.label)} <span class="oss-domain-desc">${escapeHtml(domain.description || '')}</span></h4>
      ${grid}
    </div>
  `;
}

function bindOssToolbar(data) {
  const toolbar = document.getElementById('oss-toolbar');
  if (!toolbar) return;
  const root = document.getElementById('oss-project-list');
  toolbar.querySelectorAll('[data-oss-domain]').forEach(btn => {
    btn.addEventListener('click', () => {
      toolbar.querySelectorAll('[data-oss-domain]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (root) {
        root.innerHTML = renderOssByDomain(data, btn.dataset.ossDomain);
        bindOssToolbar(data);
        if (typeof window.refreshScrollReveal === 'function') window.refreshScrollReveal(root);
      }
    });
  });
}

async function loadHomeOssPreview() {
  const root = document.getElementById('home-oss-preview');
  if (!root || root.dataset.ssg === '1') return;
  try {
    const data = await fetchOssData();
    const items = flattenProjects(data);
    const ranks = computeGlobalRanks(data);
    root.innerHTML = renderOssGrid(items.slice(0, 6), ranks);
    if (typeof window.refreshScrollReveal === 'function') window.refreshScrollReveal(root);
  } catch {
    root.innerHTML = '<p class="loading-hint">开源项目加载失败，请稍后刷新。</p>';
    if (typeof trackEvent === 'function') trackEvent('data_load_error', { source: 'oss-home' });
  }
}

async function loadOssSection() {
  const root = document.getElementById('oss-project-list');
  const meta = document.getElementById('oss-update-meta');
  if (!root) return;

  root.innerHTML = '<p class="loading-hint">加载 GitHub 开源精选…</p>';

  try {
    const data = await fetchOssData();
    if (meta && data.updated_at) {
      meta.textContent = `Star 数更新：${data.updated_at}（每周自动刷新）`;
    }
    root.innerHTML = renderOssByDomain(data, 'all');
    bindOssToolbar(data);
    if (typeof window.refreshScrollReveal === 'function') window.refreshScrollReveal(root);
  } catch (err) {
    handleDataError(root, 'oss-section');
  }
}

function bootOss() {
  loadHomeOssPreview();
  loadOssSection();
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootOss);
} else {
  bootOss();
}
