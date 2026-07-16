/* 首页 AI 推荐助手：场景点选 + 自由文本（规则来自 recommend-rules.json / 内嵌同源配置） */
(function initRecommendAssistant() {
  const form = document.getElementById('recommend-form');
  const input = document.getElementById('recommend-input');
  const out = document.getElementById('recommend-result');
  const cfgEl = document.getElementById('recommend-config');
  const root = document.getElementById('home-recommend');
  if (!form || !input || !out || !cfgEl || !root) return;

  let cfg;
  try {
    cfg = JSON.parse(cfgEl.textContent || '{}');
  } catch {
    return;
  }

  let options = cfg.options || [];
  let fallback = cfg.fallback || {};
  let relations = cfg.relations || {};
  const toolMeta = cfg.tools || {};

  function applyRules(rules) {
    if (!rules || !Array.isArray(rules.options)) return;
    options = rules.options;
    fallback = rules.fallback || fallback;
    if (rules.relations && typeof rules.relations === 'object') {
      relations = rules.relations;
    }
  }

  fetch('recommend-rules.json', { cache: 'default' })
    .then((r) => (r.ok ? r.json() : null))
    .then((rules) => {
      if (rules) applyRules(rules);
    })
    .catch(() => {});

  function matchOption(query) {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    let best = null;
    let bestScore = 0;
    for (const opt of options) {
      const keys = [...(opt.keywords || []), opt.label || '', opt.id || ''];
      let score = 0;
      for (const k of keys) {
        const key = String(k).toLowerCase();
        if (!key) continue;
        if (q.includes(key) || key.includes(q)) score += key.length;
      }
      if (score > bestScore) {
        bestScore = score;
        best = opt;
      }
    }
    return bestScore > 0 ? best : null;
  }

  function siteBase() {
    const raw = document.documentElement.dataset.base || '/';
    return raw.endsWith('/') ? raw : `${raw}/`;
  }

  function escape(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function collectRelated(toolIds) {
    const seen = new Set(toolIds);
    const chips = [];
    for (const id of toolIds) {
      const rel = relations[id];
      if (!rel) continue;
      const edges = [
        ...(rel.alternatives || []).slice(0, 1).map((e) => ({ ...e, kind: 'alt' })),
        ...(rel.complements || []).slice(0, 1).map((e) => ({ ...e, kind: 'comp' })),
      ];
      for (const edge of edges) {
        if (!edge?.id || seen.has(edge.id)) continue;
        seen.add(edge.id);
        chips.push(edge);
        if (chips.length >= 3) return chips;
      }
    }
    return chips;
  }

  function openTool(tool) {
    if (!tool) return;
    if (typeof window.showSection === 'function') window.showSection(`section-${tool}`);
    else location.hash = `section-${tool}`;
    if (typeof window.bioProgress?.record === 'function') {
      window.bioProgress.record({
        id: tool,
        title: (toolMeta[tool] && toolMeta[tool].name) || tool,
        href: `${siteBase()}tools/${tool}.html`,
        kind: 'tool',
      });
    }
  }

  function render(opt, query) {
    const tools = (opt?.tools || fallback.tools || []).slice(0, 5);
    const base = siteBase();
    const guidePath = opt?.guide || fallback.guide || 'guides/beginner.html';
    const guide =
      guidePath.startsWith('http') || guidePath.startsWith('/')
        ? guidePath
        : `${base}${guidePath.replace(/^\//, '')}`;
    const roadmapHref = `${base}ai-learning-roadmap.html`;
    const why = opt
      ? `因为你的需求匹配场景「${opt.label}」：优先这些工具上手更快。`
      : '未精确匹配场景，先给出通用主力工具；你可以换个说法再试。';

    const toolHtml = tools
      .map((id, i) => {
        const t = toolMeta[id] || { name: id, tagline: '' };
        return `<li>
          <button type="button" class="recommend-tool-btn" data-tool="${id}" data-track="recommend_query_tool">
            <span class="recommend-rank">${i + 1}</span>
            <span><strong>${escape(t.name)}</strong>${t.tagline ? `<small>${escape(t.tagline)}</small>` : ''}</span>
          </button>
        </li>`;
      })
      .join('');

    const related = collectRelated(tools);
    const relatedHtml = related.length
      ? `<div class="recommend-related">
          <p class="recommend-card-lead">也可以看看</p>
          <div class="recommend-links">
            ${related
              .map((edge) => {
                const t = toolMeta[edge.id] || { name: edge.id };
                const kind = edge.kind === 'comp' ? '搭配' : '替代';
                return `<button type="button" class="recommend-link recommend-related-btn" data-tool="${escape(edge.id)}" data-track="recommend_related_${edge.kind}">
                ${escape(kind)} · ${escape(t.name)}
              </button>`;
              })
              .join('')}
          </div>
          <p class="recommend-related-note">${escape(related[0].note || '')}</p>
        </div>`
      : '';

    out.hidden = false;
    out.innerHTML = `
      <p class="recommend-result-meta">${escape(why)}${query ? ` · 「${escape(query)}」` : ''}</p>
      <p class="recommend-card-lead">推荐工具</p>
      <ul class="recommend-tools">${toolHtml}</ul>
      ${relatedHtml}
      <div class="recommend-next">
        <p class="recommend-card-lead">下一步</p>
        <div class="recommend-links">
          <a class="recommend-link" href="${escape(roadmapHref)}" data-track="recommend_goto_learning">查看学习路线 →</a>
          <a class="recommend-link" href="${escape(guide)}" data-track="recommend_guide_query">打开完整指南 →</a>
          <a class="recommend-link" href="#home-favorites" data-track="recommend_goto_favorites">加入收藏清单 →</a>
        </div>
      </div>
    `;
  }

  // 统一委托：结果区 + 场景卡片里的工具按钮都能点
  root.addEventListener('click', (e) => {
    const btn = e.target.closest(
      '.recommend-tool-btn[data-tool], .recommend-related-btn[data-tool]',
    );
    if (!btn || !root.contains(btn)) return;
    const tool = btn.dataset.tool;
    openTool(tool);
    if (typeof trackEvent === 'function') {
      trackEvent(
        btn.classList.contains('recommend-related-btn')
          ? 'recommend_related_tool'
          : 'recommend_query_tool',
        {
          tool,
          funnel_step: 2,
        },
      );
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) {
      out.hidden = false;
      out.innerHTML = `
        <p class="recommend-result-meta">请先描述你想用 AI 做什么，例如「写周报」或「开发网站」。</p>
        <div class="recommend-links">
          <a class="recommend-link" href="#home-daily" data-track="recommend_empty_daily">先看 AI 简报 →</a>
        </div>`;
      input.focus();
      if (typeof trackEvent === 'function')
        trackEvent('recommend_empty_submit', { funnel_step: 0 });
      return;
    }
    const opt = matchOption(q);
    render(opt, q);
    if (typeof trackEvent === 'function') {
      trackEvent('recommend_submit', { matched: opt?.id || 'fallback', funnel_step: 1 });
    }
    const url = new URL(location.href);
    url.hash = 'home-recommend';
    url.searchParams.set('rq', q);
    history.replaceState(null, '', url);
  });

  document.querySelectorAll('.recommend-card[data-picker]').forEach((card) => {
    card.addEventListener('toggle', () => {
      if (!card.open) return;
      const id = card.dataset.picker;
      if (typeof trackEvent === 'function') trackEvent('recommend_scenario', { choice: id });
    });
  });

  const params = new URLSearchParams(location.search);
  const rq = params.get('rq');
  if (rq) {
    input.value = rq;
    render(matchOption(rq), rq);
  }
})();
