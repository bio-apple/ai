/* 首页按任务匹配工具：场景点选 + 自由文本（规则来自 recommend-rules.json / 内嵌同源配置） */
(function initRecommendAssistant() {
  const form = document.getElementById('recommend-form');
  const input = document.getElementById('recommend-input');
  const out = document.getElementById('recommend-result');
  const cfgEl = document.getElementById('recommend-config');
  const root = document.getElementById('home-recommend');
  const chips = document.getElementById('recommend-chips');
  if (!form || !input || !out || !cfgEl || !root) return;

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
        if (q === key) score += key.length + 20;
        else if (q.includes(key) || key.includes(q)) score += key.length;
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

  function toolHref(id) {
    const meta = toolMeta[id];
    if (meta?.href) return meta.href;
    return `${siteBase()}tools/${encodeURIComponent(id)}.html`;
  }

  function setActiveChip(pickerId) {
    if (!chips) return;
    chips.querySelectorAll('[data-picker]').forEach((chip) => {
      const on = Boolean(pickerId) && chip.dataset.picker === pickerId;
      chip.classList.toggle('is-active', on);
      chip.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function clearResult() {
    out.innerHTML = '';
    out.hidden = true;
    out.setAttribute('hidden', '');
    setActiveChip(null);
    const emptyHint = document.getElementById('recommend-empty-hint');
    if (emptyHint) emptyHint.hidden = false;
    const url = new URL(location.href);
    if (url.searchParams.has('rq')) {
      url.searchParams.delete('rq');
      history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    }
  }

  function syncEmptyResult() {
    if (!String(input.value || '').trim()) clearResult();
  }

  function logFlywheel(name, params) {
    if (typeof trackEvent === 'function') trackEvent(name, params);
    try {
      const key = 'bioai.flywheel';
      const prev = JSON.parse(localStorage.getItem(key) || '[]');
      prev.push({ e: name, t: Date.now(), ...params });
      localStorage.setItem(key, JSON.stringify(prev.slice(-100)));
    } catch {
      /* private mode */
    }
  }

  function render(opt, query) {
    const tools = (opt?.tools || fallback.tools || []).slice(0, 3);
    const base = siteBase();
    const guidePath = opt?.guide || fallback.guide || 'courses.html';
    const guide =
      guidePath.startsWith('http') || guidePath.startsWith('/')
        ? guidePath
        : `${base}${guidePath.replace(/^\//, '')}`;
    const pathTitle = opt?.path_title || fallback.path_title || '学习路径';
    const examples = opt?.examples || [];
    const scenario = opt?.label || '通用入门';

    const graftNodes = [
      `<li class="graft-node graft-node--task"><span class="graft-node-label">任务</span><strong>${escape(scenario)}</strong></li>`,
      ...tools.map((id, i) => {
        const t = toolMeta[id] || { name: id, tagline: '' };
        const role = i === 0 ? '主工具' : i === tools.length - 1 ? '收尾' : '搭配';
        return `<li class="graft-node">
          <span class="graft-node-label">${role}</span>
          <a class="recommend-tool-btn graft-tool" href="${escape(toolHref(id))}" data-tool="${escape(id)}" data-track="recommend_query_tool">
            <strong>${escape(t.name)}</strong>
            ${t.tagline ? `<small>${escape(t.tagline)}</small>` : ''}
            <span class="recommend-tool-cta">教程</span>
          </a>
        </li>`;
      }),
    ].join('<li class="graft-edge" aria-hidden="true"></li>');

    const examplesHtml = examples[0]
      ? `<p class="recommend-card-lead">例如：${escape(examples[0])}</p>`
      : '';

    setActiveChip(opt?.id || null);
    out.hidden = false;
    out.removeAttribute('hidden');
    const emptyHint = document.getElementById('recommend-empty-hint');
    if (emptyHint) emptyHint.hidden = true;
    out.innerHTML = `
      <header class="recommend-result-head">
        <p class="recommend-result-badge">${opt ? `已匹配：${escape(scenario)}` : '通用匹配'}</p>
        <p class="recommend-result-meta">
          ${
            opt
              ? `按「${escape(scenario)}」给出 2～3 个工具，再走一步。`
              : '未匹配到场景，先给通用主力工具。可换个说法或点选场景再试。'
          }
          ${query && opt && query !== opt.label ? ` <span class="recommend-query-echo">查询：${escape(query)}</span>` : ''}
        </p>
      </header>
      ${examplesHtml}
      <p class="recommend-card-lead">工具</p>
      <ol class="graft-path" aria-label="推荐工具">${graftNodes}</ol>
      <div class="recommend-next">
        <p class="recommend-card-lead">下一步</p>
        <div class="recommend-links">
          <a class="recommend-link" href="${escape(guide)}" data-track="recommend_guide_query">${escape(pathTitle)} →</a>
        </div>
      </div>
    `;
  }

  function runQuery(q, { fromChip = false, pickerId = null } = {}) {
    const query = String(q || '').trim();
    if (!query) {
      clearResult();
      input.focus();
      return;
    }
    const opt = (pickerId && options.find((o) => o.id === pickerId)) || matchOption(query) || null;
    render(opt, query);
    const payload = {
      matched: opt?.id || 'fallback',
      choice: pickerId || opt?.id || query.slice(0, 80),
      q: query.slice(0, 80),
      funnel_step: 1,
    };
    if (fromChip) logFlywheel('recommend_chip', payload);
    else if (!opt) logFlywheel('recommend_miss', payload);
    else logFlywheel('recommend_submit', payload);
    const url = new URL(location.href);
    url.hash = 'home-recommend';
    url.searchParams.set('rq', query);
    history.replaceState(null, '', url);
  }

  root.addEventListener('click', (e) => {
    const btn = e.target.closest(
      '.recommend-tool-btn[data-tool], .recommend-related-btn[data-tool]',
    );
    if (!btn || !root.contains(btn)) return;
    const tool = btn.dataset.tool;
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
    // 默认走链接到教程页；若同页仍有工具分区则允许 showSection 加速
    if (typeof window.showSection === 'function' && document.getElementById(`section-${tool}`)) {
      e.preventDefault();
      window.showSection(`section-${tool}`);
    }
  });

  // 兼容：键盘删除、粘贴清空、以及 type=search 的 ✕ 清空（部分浏览器只派发 search）
  ['input', 'change', 'keyup', 'cut', 'paste'].forEach((evt) => {
    input.addEventListener(evt, () => {
      // paste/cut 后值可能尚未写入，下一微任务再确认
      syncEmptyResult();
      queueMicrotask(syncEmptyResult);
    });
  });
  input.addEventListener('search', () => {
    syncEmptyResult();
    queueMicrotask(syncEmptyResult);
    requestAnimationFrame(syncEmptyResult);
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) {
      clearResult();
      input.focus();
      logFlywheel('recommend_empty_submit', { funnel_step: 0 });
      return;
    }
    runQuery(q);
  });

  if (chips) {
    chips.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-recommend-chip]');
      if (!chip || !chips.contains(chip)) return;
      const q = chip.dataset.recommendChip || chip.textContent.trim();
      input.value = q;
      runQuery(q, { fromChip: true, pickerId: chip.dataset.picker || null });
      input.focus();
    });
  }

  const params = new URLSearchParams(location.search);
  const rq = params.get('rq');
  if (rq) {
    input.value = rq;
    runQuery(rq);
  }
})();
