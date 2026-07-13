/* 首页 AI 推荐助手：场景点选 + 自由文本规则匹配 */
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

  const options = cfg.options || [];
  const fallback = cfg.fallback || {};
  const toolMeta = cfg.tools || {};

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

    const toolHtml = tools
      .map((id, i) => {
        const t = toolMeta[id] || { name: id, tagline: '' };
        return `<li>
          <button type="button" class="recommend-tool-btn" data-tool="${id}" data-track="recommend-query">
            <span class="recommend-rank">${i + 1}</span>
            <span><strong>${escape(t.name)}</strong>${t.tagline ? `<small>${escape(t.tagline)}</small>` : ''}</span>
          </button>
        </li>`;
      })
      .join('');

    const stepsHtml = steps.map((s) => `<li>${escape(s)}</li>`).join('');
    const matched = opt ? `匹配场景：${escape(opt.label)}` : '未精确匹配场景，给出通用推荐';

    out.hidden = false;
    out.innerHTML = `
      <p class="recommend-result-meta">${matched}${query ? ` · 「${escape(query)}」` : ''}</p>
      <p class="recommend-card-lead">推荐工具</p>
      <ul class="recommend-tools">${toolHtml}</ul>
      <p class="recommend-card-lead">${escape(pathTitle)}</p>
      <ol class="recommend-path-steps">${stepsHtml}</ol>
      <div class="recommend-links">
        <a class="recommend-link" href="${escape(guide)}" data-track="recommend-guide-query">学习路线 →</a>
      </div>
    `;
    out.querySelectorAll('.recommend-tool-btn[data-tool]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tool = btn.dataset.tool;
        const section = document.getElementById(`section-${tool}`);
        if (section && typeof window.showSection === 'function') {
          window.showSection(`section-${tool}`);
        } else {
          location.hash = `section-${tool}`;
        }
        if (typeof trackEvent === 'function') trackEvent('recommend-query-tool', { tool });
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
      trackEvent('recommend-query', { q, matched: opt?.id || 'fallback' });
    }
  });

  document.querySelectorAll('.recommend-card[data-picker]').forEach((card) => {
    card.addEventListener('toggle', () => {
      if (!card.open) return;
      const id = card.dataset.picker;
      const opt = options.find((o) => o.id === id);
      if (opt && input) {
        /* 场景展开时不覆盖文本结果，仅埋点 */
        if (typeof trackEvent === 'function') trackEvent('recommend-scenario', { choice: id });
      }
    });
  });
})();
