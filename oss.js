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

function formatStarDelta(n) {
  const abs = Math.abs(n);
  const body = abs >= 10_000 ? `${(abs / 10_000).toFixed(1)}万` : abs.toLocaleString('en-US');
  if (n > 0) return `+${body}`;
  if (n < 0) return `-${body}`;
  return '0';
}

function uniqueCategories(items) {
  return [...new Set((items || []).map((i) => i.category).filter(Boolean))];
}

function categoryFromHash() {
  const raw = decodeURIComponent((location.hash || '').replace(/^#/, ''))
    .trim()
    .toLowerCase();
  if (!raw || raw === 'all') return 'all';
  const key = raw.replace(/-/g, '_');
  return OSS_CATEGORY_ORDER.includes(key) ? key : 'all';
}

function filterOssItems(items) {
  return (items || []).filter((item) => {
    const catOk = ossState.category === 'all' || item.category === ossState.category;
    return catOk;
  });
}

function sourceBadge(item) {
  const heat = item.heatLabel;
  if (heat?.text) {
    return `<span class="oss-card-heat" title="${html(heat.title || '')}">${html(heat.text)}</span>`;
  }
  const sources = item.sources || [];
  const hasTrending = sources.some((s) => String(s).startsWith('trending'));
  if (hasTrending) {
    return '<span class="oss-card-heat" title="来自 GitHub Trending">升温</span>';
  }
  return '';
}

function tagBadges(item) {
  let out = '';
  if (item.isNew) out += '<span class="oss-tag oss-tag--new">上周新增</span>';
  if (item.isFastest) out += '<span class="oss-tag oss-tag--fast">本周上升最快</span>';
  return out;
}

function growthHtml(item) {
  if (item.starsDelta) {
    const up = item.starsDelta > 0;
    const dir = up ? 'up' : 'down';
    const arrow = up ? '↑' : '↓';
    return `<span class="oss-card-delta oss-card-delta--${dir}" title="相对上次日更快照的 Star 变化">${arrow} ${formatStarDelta(item.starsDelta)}</span>`;
  }
  if (item.starsWeekly && item.starsWeekly > 0) {
    return `<span class="oss-card-delta oss-card-delta--est" title="按仓库年龄估算的周均 Star 增长（静态）">约 ${formatStarDelta(item.starsWeekly)}/周</span>`;
  }
  if (item.trendingDailyRank != null) {
    return `<span class="oss-card-delta oss-card-delta--est" title="GitHub Trending 日榜，可作近期热度参考">日榜 #${html(item.trendingDailyRank)}</span>`;
  }
  if (item.trendingWeeklyRank != null) {
    return `<span class="oss-card-delta oss-card-delta--est" title="GitHub Trending 周榜，可作近期热度参考">周榜 #${html(item.trendingWeeklyRank)}</span>`;
  }
  return '';
}

function renderOssCard(item) {
  const starsHtml = `
    <span class="oss-card-stars" title="GitHub Stars">
      <span aria-hidden="true">★</span> ${formatStars(item.stars)}
    </span>`;
  return `
    <article class="oss-card-item" data-oss-cat="${html(item.category || '')}">
      <div class="oss-card-item-head">
        <div class="oss-card-tags">
          <span class="oss-chip oss-chip--${html(item.category)}">${html(item.categoryLabel || '')}</span>
          ${tagBadges(item)}
          ${sourceBadge(item)}
        </div>
        <div class="oss-card-metrics">
          ${growthHtml(item)}
          ${starsHtml}
        </div>
      </div>
      <h4>
        <a href="${html(item.url)}" target="_blank" rel="${extRel()}" data-track="oss-click"
          data-oss-name="${html(item.name || '')}" data-oss-category="${html(item.category || '')}">
          ${html(item.name || '')}
        </a>
      </h4>
      <p class="oss-card-item-repo">${html(item.repo || '')}</p>
      ${item.summary ? `<p class="oss-card-item-summary">${html(item.summary)}</p>` : ''}
      ${
        item.audienceTags?.length
          ? `<ul class="oss-audience">${item.audienceTags.map((tag) => `<li>${html(tag)}</li>`).join('')}</ul>`
          : ''
      }
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
      <section class="oss-cat-block" data-oss-cat="${html(cat)}">
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
      return `<a class="oss-filter${active ? ' active' : ''}" href="#${html(c)}" data-oss-category="${html(c)}" aria-pressed="${active}">${html(label)} · ${count}</a>`;
    })
    .join('');

  toolbar.innerHTML = `
    <span class="oss-toolbar-label">方向</span>
    ${catHtml}
  `;

  toolbar.querySelectorAll('[data-oss-category]').forEach((btn) => {
    btn.addEventListener('click', (ev) => {
      ev.preventDefault();
      setOssCategory(btn.dataset.ossCategory || 'all', 'click');
    });
  });
}

function setOssCategory(cat, source) {
  const next = OSS_CATEGORY_ORDER.includes(cat) || cat === 'all' ? cat : 'all';
  const changed = ossState.category !== next;
  ossState.category = next;
  const want = `#${next}`;
  if (location.hash !== want) {
    history.replaceState(null, '', want);
  }
  paintOss();
  if (changed && source === 'click' && typeof trackEvent === 'function') {
    trackEvent('oss-filter-category', { category: ossState.category });
  }
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
    ossState.category = categoryFromHash();
    renderOssMeta(ossState.items);
    paintOss();
    window.addEventListener('hashchange', () => {
      setOssCategory(categoryFromHash(), 'hash');
    });
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
