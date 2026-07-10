const OSS_DATA_URL = 'oss-projects.json';

let ossDataPromise = null;

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function formatStars(n) {
  if (!n) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 10_000) return (n / 10_000).toFixed(1) + '万';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function renderOssCard(project, domainLabel) {
  return `
    <article class="oss-card">
      <div class="oss-card-head">
        <span class="oss-domain-badge">${escapeHtml(domainLabel)}</span>
        <span class="oss-stars">★ ${escapeHtml(formatStars(project.stars))}</span>
      </div>
      <h4><a href="${escapeHtml(project.url)}" target="_blank" rel="noopener" data-track="oss-click">${escapeHtml(project.name)}</a></h4>
      <p class="oss-repo">${escapeHtml(project.repo)}${project.language ? ` · ${escapeHtml(project.language)}` : ''}</p>
      <p class="oss-summary">${escapeHtml(project.description || '')}</p>
      <a href="${escapeHtml(project.url)}" target="_blank" rel="noopener" class="oss-read" data-track="oss-read">查看仓库 →</a>
    </article>
  `;
}

function fetchOssData() {
  if (!ossDataPromise) {
    ossDataPromise = fetch(OSS_DATA_URL, { cache: 'no-store' })
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

function renderOssGrid(items, { limit = 0 } = {}) {
  const list = limit ? items.slice(0, limit) : items;
  if (!list.length) {
    return '<p class="loading-hint">暂无开源项目数据。</p>';
  }
  return `<div class="oss-grid">${list.map(({ project, domain }) => renderOssCard(project, domain.label)).join('')}</div>`;
}

function renderOssByDomain(data, activeDomain = 'all') {
  const domains = data.domains || [];
  const toolbar = `
    <div class="library-toolbar oss-toolbar" id="oss-toolbar">
      <button type="button" class="library-filter active" data-oss-domain="all">全部领域</button>
      ${domains.map(d => `<button type="button" class="library-filter" data-oss-domain="${escapeHtml(d.id)}">${escapeHtml(d.label)}</button>`).join('')}
    </div>
  `;

  if (activeDomain === 'all') {
    const blocks = domains.map(domain => {
      const projects = domain.projects || [];
      if (!projects.length) return '';
      return `
        <div class="oss-domain-block" data-oss-block="${escapeHtml(domain.id)}">
          <h4 class="oss-domain-title">${escapeHtml(domain.label)} <span class="oss-domain-desc">${escapeHtml(domain.description || '')}</span></h4>
          <div class="oss-grid">${projects.map(p => renderOssCard(p, domain.label)).join('')}</div>
        </div>
      `;
    }).join('');
    return toolbar + blocks;
  }

  const domain = domains.find(d => d.id === activeDomain);
  if (!domain) return toolbar + '<p class="loading-hint">暂无该领域项目。</p>';
  return toolbar + `
    <div class="oss-domain-block">
      <h4 class="oss-domain-title">${escapeHtml(domain.label)} <span class="oss-domain-desc">${escapeHtml(domain.description || '')}</span></h4>
      <div class="oss-grid">${(domain.projects || []).map(p => renderOssCard(p, domain.label)).join('')}</div>
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
  if (!root) return;
  try {
    const data = await fetchOssData();
    const items = flattenProjects(data);
    root.innerHTML = renderOssGrid(items, { limit: 6 });
    if (typeof window.refreshScrollReveal === 'function') window.refreshScrollReveal(root);
  } catch {
    root.innerHTML = '<p class="loading-hint">开源项目加载失败，请稍后刷新。</p>';
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
    root.innerHTML = `<p class="loading-hint error-hint">${escapeHtml(err.message)}</p>`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadHomeOssPreview();
  loadOssSection();
});
