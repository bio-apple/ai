/* 首页 AI 推荐助手：场景点选 + 自由文本（规则来自 recommend-rules.json / 内嵌同源配置） */
(function initRecommendAssistant() {
  const form = document.getElementById('recommend-form');
  const input = document.getElementById('recommend-input');
  const out = document.getElementById('recommend-result');
  const cfgEl = document.getElementById('recommend-config');
  if (!form || !input || !out || !cfgEl) return;

  let cfg;
  try {
    cfg = JSON.parse(cfgEl.textContent || '{}');
  } catch {
    return;
  }

  let options = cfg.options || [];
  let fallback = cfg.fallback || {};
  const toolMeta = cfg.tools || {};

  function applyRules(rules) {
    if (!rules || !Array.isArray(rules.options)) return;
    options = rules.options;
    fallback = rules.fallback || fallback;
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

  function render(opt, query) {
    const tools = (opt?.tools || fallback.tools || []).slice(0, 5);
    const pathTitle = opt?.path_title || fallback.path_title || '学习路线';
    const steps = opt?.steps || fallback.steps || [];
    const guide = opt?.guide || fallback.guide || 'guides/beginner.html';
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

    const stepsHtml = steps.map((s) => `<li>${escape(s)}</li>`).join('');

    out.hidden = false;
    out.innerHTML = `
      <p class="recommend-result-meta">${escape(why)}${query ? ` · 「${escape(query)}」` : ''}</p>
      <p class="recommend-card-lead">推荐工具</p>
      <ul class="recommend-tools">${toolHtml}</ul>
      <p class="recommend-card-lead">${escape(pathTitle)}</p>
      <ol class="recommend-path-steps">${stepsHtml}</ol>
      <div class="recommend-next">
        <p class="recommend-card-lead">下一步</p>
        <div class="recommend-links">
          <a class="recommend-link" href="${escape(guide)}" data-track="recommend_guide_query">打开学习路线 →</a>
          <a class="recommend-link" href="#home-favorites" data-track="recommend_goto_favorites">加入收藏清单 →</a>
          <a class="recommend-link" href="cases/index.html" data-track="recommend_goto_cases">看实战案例 →</a>
        </div>
      </div>
    `;
    out.querySelectorAll('.recommend-tool-btn[data-tool]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tool = btn.dataset.tool;
        if (typeof window.showSection === 'function') window.showSection(`section-${tool}`);
        else location.hash = `section-${tool}`;
        if (typeof trackEvent === 'function') trackEvent('recommend_query_tool', { tool });
      });
    });
  }

  function escape(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) {
      input.focus();
      return;
    }
    const opt = matchOption(q);
    render(opt, q);
    if (typeof trackEvent === 'function') {
      trackEvent('recommend_submit', { matched: opt?.id || 'fallback' });
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
