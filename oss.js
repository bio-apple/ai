const OSS_JSON = 'oss-projects.json';

let ossDataPromise = null;

function escapeHtml(s) {
  return window.BioAI?.escapeHtml ? window.BioAI.escapeHtml(s) : String(s ?? '');
}

function extRel() {
  return window.BioAI?.externalRel ? window.BioAI.externalRel() : 'noopener noreferrer';
}

function formatStars(n) {
  if (!n) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 10_000) return (n / 10_000).toFixed(1) + '万';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function renderOssCard(project, domainLabel) {
  const stars = formatStars(project.stars);
  const language = (project.language || '').trim() || '—';
  const purpose = (project.description || '').trim() || '暂无简介';
  const badge = project.badge
    ? `<span class="oss-zh-badge">${escapeHtml(project.badge)}</span>`
    : '';
  const repoBtnLabel = `打开 ${project.name} GitHub 仓库`;
  return `
    <article class="oss-card${project.badge ? ' oss-card-zh' : ''}">
      <div class="oss-card-head">
        <span class="content-type-badge content-type-oss" aria-hidden="true">开源</span>
        <span class="oss-domain-badge">${escapeHtml(domainLabel)}</span>
        ${badge}
      </div>
      <h4 class="oss-card-title">
        <a href="${escapeHtml(project.url)}" target="_blank" rel="${extRel()}" data-track="oss-click">${escapeHtml(project.name)}</a>
      </h4>
      <p class="oss-repo-slug">${escapeHtml(project.repo)}</p>
      <ul class="oss-meta" aria-label="项目信息">
        <li class="oss-meta-item">
          <span class="oss-meta-label">Stars</span>
          <span class="oss-meta-value oss-meta-stars">★ ${escapeHtml(stars)}</span>
        </li>
        <li class="oss-meta-item">
          <span class="oss-meta-label">语言</span>
          <span class="oss-meta-value">${escapeHtml(language)}</span>
        </li>
      </ul>
      <p class="oss-purpose">
        <span class="oss-purpose-label">用途</span>
        <span class="oss-purpose-text">${escapeHtml(purpose)}</span>
      </p>
      <a href="${escapeHtml(project.url)}" target="_blank" rel="${extRel()}" class="oss-repo-btn" data-track="oss-read" aria-label="${escapeHtml(repoBtnLabel)}">
        <span class="oss-repo-btn-icon" aria-hidden="true">↗</span>
        打开 GitHub 仓库
      </a>
    </article>
  `;
}

function fetchOssData() {
  if (!ossDataPromise) {
    if (!window.BioAI?.fetchJson) {
      return Promise.reject(new Error('加载器未就绪，请稍后重试'));
    }
    ossDataPromise = window.BioAI.fetchJson(OSS_JSON, { label: '开源精选' });
  }
  return ossDataPromise;
}

function resetOssFetch() {
  window.BioAI?.invalidateFetch?.(OSS_JSON);
  ossDataPromise = null;
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

function renderOssDomainBody(domain) {
  const projects = domain.projects || [];
  const apps = domain.apps || [];
  if (!apps.length) {
    return `<div class="oss-grid">${projects.map((p) => renderOssCard(p, domain.label)).join('')}</div>`;
  }

  const byApp = Object.fromEntries(apps.map((a) => [a.id, []]));
  const other = [];
  for (const project of projects) {
    const appId = project.app || project.role;
    if (appId && byApp[appId]) byApp[appId].push(project);
    else other.push(project);
  }

  const sections = apps
    .map((app) => {
      const items = [...(byApp[app.id] || [])].sort((a, b) => (b.stars || 0) - (a.stars || 0));
      if (!items.length) return '';
      return `
        <div class="oss-app-block" data-oss-app="${escapeHtml(app.id)}">
          <h5 class="oss-app-title">
            ${escapeHtml(app.label)}
            ${app.blurb ? `<span class="oss-app-blurb">${escapeHtml(app.blurb)}</span>` : ''}
          </h5>
          <div class="oss-grid">${items.map((p) => renderOssCard(p, app.label)).join('')}</div>
        </div>
      `;
    })
    .join('');

  const leftover = other.length
    ? `<div class="oss-grid">${other.map((p) => renderOssCard(p, domain.label)).join('')}</div>`
    : '';
  return sections + leftover;
}

function renderOssByDomain(data, activeDomain = 'all') {
  const domains = data.domains || [];
  const toolbar = `
    <div class="library-toolbar oss-toolbar" id="oss-toolbar">
      <button type="button" class="library-filter active" data-oss-domain="all">全部领域</button>
      ${domains.map((d) => `<button type="button" class="library-filter" data-oss-domain="${escapeHtml(d.id)}">${escapeHtml(d.label)}</button>`).join('')}
    </div>
  `;

  if (activeDomain === 'all') {
    const blocks = domains
      .map((domain) => {
        const projects = domain.projects || [];
        if (!projects.length) return '';
        return `
        <div class="oss-domain-block" data-oss-block="${escapeHtml(domain.id)}">
          <h4 class="oss-domain-title">${escapeHtml(domain.label)} <span class="oss-domain-desc">${escapeHtml(domain.description || '')}</span></h4>
          ${renderOssDomainBody(domain)}
        </div>
      `;
      })
      .join('');
    return toolbar + blocks;
  }

  const domain = domains.find((d) => d.id === activeDomain);
  if (!domain) return toolbar + '<p class="loading-hint">暂无该领域项目。</p>';
  return (
    toolbar +
    `
    <div class="oss-domain-block">
      <h4 class="oss-domain-title">${escapeHtml(domain.label)} <span class="oss-domain-desc">${escapeHtml(domain.description || '')}</span></h4>
      ${renderOssDomainBody(domain)}
    </div>
  `
  );
}

function bindOssToolbar(data) {
  const toolbar = document.getElementById('oss-toolbar');
  if (!toolbar) return;
  const root = document.getElementById('oss-project-list');
  toolbar.querySelectorAll('[data-oss-domain]').forEach((btn) => {
    btn.addEventListener('click', () => {
      toolbar.querySelectorAll('[data-oss-domain]').forEach((b) => b.classList.remove('active'));
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
    root.innerHTML = renderOssGrid(items, { limit: 6 });
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
      meta.textContent = `Star 数更新：${data.updated_at}（每日自动刷新）`;
    }
    root.innerHTML = renderOssByDomain(data, 'all');
    bindOssToolbar(data);
    if (typeof window.refreshScrollReveal === 'function') window.refreshScrollReveal(root);
  } catch (err) {
    root.innerHTML = window.BioAI?.renderErrorBlock
      ? window.BioAI.renderErrorBlock(err.message || '加载失败')
      : `<p class="loading-hint error-hint">${escapeHtml(err.message)}</p>`;
    window.BioAI?.bindRetry?.(root, () => {
      resetOssFetch();
      loadOssSection();
    });
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
