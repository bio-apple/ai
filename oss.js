const OSS_CATEGORY_ORDER = ['agent', 'mcp', 'coding_agent', 'agent_harness', 'skills', 'memory'];
const OSS_CATEGORY_LABELS = {
  agent: 'Agent',
  mcp: 'MCP',
  coding_agent: 'Coding Agent',
  agent_harness: 'Agent Harness',
  skills: 'Skills',
  memory: 'Memory',
};

let ossState = { category: 'all', items: [] };

function html(s) {
  return window.BioAI?.escapeHtml ? window.BioAI.escapeHtml(s) : String(s ?? '');
}

function extRel() {
  return window.BioAI?.externalRel ? window.BioAI.externalRel() : 'noopener noreferrer';
}

function formatStars(n) {
  if (n == null || Number.isNaN(Number(n))) return '0';
  return Number(n).toLocaleString('en-US');
}

function uniqueCategories(items) {
  return [...new Set((items || []).map((i) => i.category).filter(Boolean))];
}

function filterOssItems(items) {
  return (items || []).filter((item) => {
    const catOk = ossState.category === 'all' || item.category === ossState.category;
    return catOk;
  });
}

function sourceBadge(item) {
  const sources = item.sources || [];
  const hasTrending = sources.some((s) => String(s).startsWith('trending'));
  if (hasTrending) {
    return '<span class="oss-card-heat" title="来自 GitHub Trending">升温</span>';
  }
  return '';
}

function renderOssCard(item) {
  const starsHtml = `
    <span class="oss-card-stars" title="GitHub Stars">
      <span aria-hidden="true">★</span> ${formatStars(item.stars)}
    </span>`;
  return `
    <article class="oss-card-item">
      <div class="oss-card-item-head">
        <span class="oss-chip oss-chip--${html(item.category)}">${html(item.categoryLabel || '')}</span>
        ${sourceBadge(item)}
        ${starsHtml}
      </div>
      <h4>
        <a href="${html(item.url)}" target="_blank" rel="${extRel()}" data-track="oss-click"
          data-oss-name="${html(item.name || '')}" data-oss-category="${html(item.category || '')}">
          ${html(item.name || '')}
        </a>
      </h4>
      <p class="oss-card-item-repo">${html(item.repo || '')}</p>
      ${item.summary ? `<p class="oss-card-item-summary">${html(item.summary)}</p>` : ''}
      <div class="oss-card-item-actions">
        <a href="${html(item.url)}" target="_blank" rel="${extRel()}" class="oss-card-item-link" data-track="oss-open"
          data-oss-name="${html(item.name || '')}" data-oss-category="${html(item.category || '')}">在 GitHub 打开 →</a>
      </div>
    </article>
  `;
}

function groupByCategory(items) {
  const order = OSS_CATEGORY_ORDER;
  const groups = new Map();
  for (const cat of order) groups.set(cat, []);
  for (const item of items) {
    const cat = item.category || 'other';
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push(item);
  }
  return [...groups.entries()].filter(([, list]) => list.length);
}

function renderOssGrid(items) {
  if (!items.length) {
    return '<p class="loading-hint">当前筛选下暂无开源项目，请切换类别。</p>';
  }
  if (ossState.category !== 'all') {
    return `<div class="oss-grid">${items.map(renderOssCard).join('')}</div>`;
  }
  return groupByCategory(items)
    .map(
      ([cat, list]) => `
      <section class="oss-cat-block">
        <h3 class="oss-cat-block-title">${html(OSS_CATEGORY_LABELS[cat] || cat)}</h3>
        <div class="oss-grid">${list.map(renderOssCard).join('')}</div>
      </section>
    `,
    )
    .join('');
}

function renderToolbar(items) {
  const toolbar = document.getElementById('oss-toolbar');
  if (!toolbar) return;
  const present = new Set(uniqueCategories(items));
  const categories = [
    'all',
    ...OSS_CATEGORY_ORDER.filter((c) => present.has(c)),
    ...uniqueCategories(items).filter((c) => !OSS_CATEGORY_ORDER.includes(c)),
  ];

  const catHtml = categories
    .map((c) => {
      const label = c === 'all' ? '全部方向' : OSS_CATEGORY_LABELS[c] || c;
      const count = c === 'all' ? items.length : items.filter((i) => i.category === c).length;
      const active = ossState.category === c;
      return `<button type="button" class="video-filter${active ? ' active' : ''}" data-oss-category="${html(c)}" aria-pressed="${active}">${html(label)} · ${count}</button>`;
    })
    .join('');

  toolbar.innerHTML = `
    <div class="video-toolbar-group">
      <span class="video-toolbar-label">方向</span>
      ${catHtml}
    </div>
  `;

  toolbar.querySelectorAll('[data-oss-category]').forEach((btn) => {
    btn.addEventListener('click', () => {
      ossState.category = btn.dataset.ossCategory || 'all';
      paintOss();
      if (typeof trackEvent === 'function') {
        trackEvent('oss-filter-category', { category: ossState.category });
      }
    });
    btn.setAttribute('aria-pressed', btn.classList.contains('active') ? 'true' : 'false');
  });
}

function paintOss() {
  const list = document.getElementById('oss-list');
  if (!list) return;
  const filtered = filterOssItems(ossState.items);
  list.innerHTML = renderOssGrid(filtered);
  renderToolbar(ossState.items);
}

function renderOssMeta(data) {
  const meta = document.getElementById('oss-update-meta');
  const leadEl = document.getElementById('oss-lead');
  if (!meta && !leadEl) return;
  const n = (data || []).length;
  const catCounts = OSS_CATEGORY_ORDER.map((cat) => {
    const count = (data || []).filter((i) => i.category === cat).length;
    return count ? `${OSS_CATEGORY_LABELS[cat]} ${count}` : '';
  })
    .filter(Boolean)
    .join(' · ');
  if (leadEl) {
    leadEl.textContent =
      '收集近期 GitHub 上正在升温的 AI 开源项目（非纯 Star 榜，入选至少 ★1 万）。数据源：GitHub Trending + Search/API；方向：Agent / MCP / Coding Agent / Agent Harness / Skills / Memory；每天更新，每方向最多 Top 3。';
  }
  if (meta) {
    meta.textContent = catCounts
      ? `日更加热精选 ${n} 个 · ${catCounts}`
      : `日更加热精选 ${n} 个 · 每方向 Top 3`;
  }
}

function initOssSection() {
  const list = document.getElementById('oss-list');
  if (!list) return;
  try {
    const raw = document.getElementById('oss-data');
    if (!raw) {
      if (!list.querySelector('[data-ssr-oss], .oss-card-item')) {
        list.innerHTML = '<p class="loading-hint error-hint">数据未加载，请刷新页面后重试。</p>';
      }
      return;
    }
    const data = JSON.parse(raw.textContent || '[]');
    if (!Array.isArray(data) || !data.length) {
      list.innerHTML = '<p class="loading-hint">暂无开源项目数据。</p>';
      return;
    }
    ossState.items = data.filter((item) => item.repo && item.name);
    renderOssMeta(ossState.items);
    paintOss();
  } catch (err) {
    list.innerHTML = window.BioAI?.renderErrorBlock
      ? window.BioAI.renderErrorBlock(err.message || '加载失败')
      : `<p class="loading-hint error-hint">${html(err.message || '加载失败')}</p>`;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initOssSection);
} else {
  initOssSection();
}
