const PROMPTS_DATA_URL =
  (typeof document !== 'undefined' && document.documentElement.dataset.base
    ? document.documentElement.dataset.base.replace(/\/?$/, '/')
    : window.location.pathname.includes('/prompts/')
      ? '../'
      : '') + 'prompts.json';

const CATEGORY_LABELS = {
  research: '科研',
  coding: '编程',
  data: '数据分析',
  writing: '写作',
  productivity: '办公',
  market: '市场分析',
};

let promptsDataPromise = null;
let activePromptCategory = 'all';
let activePromptSource = 'all';
let activePromptQuery = '';

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

function fetchPromptsData() {
  if (!promptsDataPromise) {
    promptsDataPromise = fetch(PROMPTS_DATA_URL, { cache: 'default' })
      .then((res) => {
        if (!res.ok) throw new Error('无法加载 Prompt 数据');
        return res.json();
      })
      .catch((err) => {
        promptsDataPromise = null;
        throw err;
      });
  }
  return promptsDataPromise;
}

function chatgptTryUrl(content) {
  return `https://chatgpt.com/?q=${encodeURIComponent(content)}`;
}

function filterPrompts(data) {
  let items = data.prompts || [];
  if (activePromptCategory !== 'all') {
    items = items.filter((p) => p.category === activePromptCategory);
  }
  if (activePromptSource === 'case') {
    items = items.filter((p) => p.source !== 'prompts.chat');
  } else if (activePromptSource === 'prompts.chat') {
    items = items.filter((p) => p.source === 'prompts.chat');
  }
  const q = activePromptQuery.trim().toLowerCase();
  if (q) {
    items = items.filter((p) => {
      const blob = [p.title, p.title_en, p.content, p.case_title, p.tool, ...(p.tags || [])]
        .filter(Boolean)
        .join('\n')
        .toLowerCase();
      return blob.includes(q);
    });
  }
  return items;
}

function renderPromptCard(prompt) {
  const catLabel = CATEGORY_LABELS[prompt.category] || prompt.category;
  const isClassic = prompt.source === 'prompts.chat';
  const prefix = window.location.pathname.includes('/prompts/') ? '../' : '';
  const toolBadge = isClassic ? 'prompts.chat' : prompt.tool;
  const refLine = isClassic
    ? `角色：${escapeHtml(prompt.title_en || prompt.case_title || prompt.title)}`
    : `来自：${escapeHtml(prompt.case_title)}`;
  const secondaryAction = isClassic
    ? `<a href="${chatgptTryUrl(prompt.content)}" target="_blank" rel="noopener" class="prompt-case-link" data-track="prompt-try-chatgpt">在 ChatGPT 试用 →</a>`
    : `<a href="${prefix}cases/index.html#${encodeURIComponent(prompt.case_anchor || '')}" class="prompt-case-link" data-track="prompt-case-link">查看案例 →</a>`;

  return `
    <article class="prompt-card reveal" id="${escapeHtml(prompt.id)}" data-category="${escapeHtml(prompt.category)}" data-source="${escapeHtml(prompt.source || 'case')}">
      <div class="prompt-card-head">
        <span class="prompt-category">${escapeHtml(catLabel)}</span>
        <span class="case-badge ${isClassic ? 'classic' : escapeHtml(prompt.tool)}">${escapeHtml(toolBadge)}</span>
      </div>
      <h4>${escapeHtml(prompt.title)}</h4>
      <p class="prompt-case-ref">${refLine}</p>
      <pre class="prompt-content">${escapeHtml(prompt.content)}</pre>
      <div class="prompt-card-actions">
        <button type="button" class="prompt-copy-btn" data-prompt-copy>复制 Prompt</button>
        ${secondaryAction}
      </div>
    </article>
  `;
}

function bindPromptCards(root) {
  root.querySelectorAll('[data-prompt-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const card = btn.closest('.prompt-card');
      const text = card?.querySelector('.prompt-content')?.textContent?.trim();
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = '已复制 ✓';
        setTimeout(() => {
          btn.textContent = '复制 Prompt';
        }, 2000);
        if (typeof trackEvent === 'function') {
          trackEvent('prompt-library-copy', {
            source: card?.dataset.source || 'case',
            id: card?.id || '',
          });
        }
      } catch {
        btn.textContent = '复制失败';
      }
    });
  });
}

function renderPromptsList(data) {
  const root = document.getElementById('prompts-list');
  const meta = document.getElementById('prompts-count-meta');
  if (!root) return;

  const items = filterPrompts(data);
  const classicCount = data.classic_count || 0;
  const caseCount = Math.max(0, (data.count || 0) - classicCount);

  if (meta) {
    meta.textContent = `共 ${data.count || items.length} 条（案例 ${caseCount} · prompts.chat ${classicCount}）· 当前 ${items.length} 条`;
  }

  if (!items.length) {
    root.innerHTML = '<p class="loading-hint">没有匹配的 Prompt，试试其他关键词或分类。</p>';
    return;
  }

  root.innerHTML = items.map(renderPromptCard).join('');
  bindPromptCards(root);
  if (typeof window.refreshScrollReveal === 'function') window.refreshScrollReveal(root);
}

async function refreshList() {
  try {
    const data = await fetchPromptsData();
    renderPromptsList(data);
  } catch {
    /* ignore */
  }
}

function initPromptFilters() {
  const toolbar = document.getElementById('prompts-toolbar');
  if (!toolbar) return;

  toolbar.querySelectorAll('[data-prompt-cat]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      toolbar.querySelectorAll('[data-prompt-cat]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      activePromptCategory = btn.dataset.promptCat;
      await refreshList();
      if (typeof trackEvent === 'function')
        trackEvent('prompt-filter', { category: activePromptCategory });
    });
  });

  toolbar.querySelectorAll('[data-prompt-source]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      toolbar.querySelectorAll('[data-prompt-source]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      activePromptSource = btn.dataset.promptSource;
      await refreshList();
      if (typeof trackEvent === 'function')
        trackEvent('prompt-source-filter', { source: activePromptSource });
    });
  });
}

function initPromptSearch() {
  const input = document.getElementById('prompts-search');
  if (!input) return;
  let timer = null;
  const run = async () => {
    activePromptQuery = input.value || '';
    await refreshList();
  };
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(run, 180);
  });
  input.addEventListener('search', run);
}

async function loadPromptLibrary() {
  const root = document.getElementById('prompts-list');
  if (!root) return;

  root.innerHTML = '<p class="loading-hint">加载 Prompt 库…</p>';

  try {
    const data = await fetchPromptsData();
    const hashId = location.hash.replace(/^#/, '');
    if (hashId && data?.prompts?.some((p) => p.id === hashId)) {
      const hit = data.prompts.find((p) => p.id === hashId);
      if (hit?.category) activePromptCategory = hit.category;
      if (hit?.source === 'prompts.chat') activePromptSource = 'prompts.chat';
      const toolbar = document.getElementById('prompts-toolbar');
      toolbar?.querySelectorAll('[data-prompt-cat]').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.promptCat === activePromptCategory);
      });
      toolbar?.querySelectorAll('[data-prompt-source]').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.promptSource === activePromptSource);
      });
    }
    renderPromptsList(data);
    initPromptFilters();
    initPromptSearch();
    if (hashId) {
      requestAnimationFrame(() => {
        const el = document.getElementById(hashId);
        if (!el) return;
        el.classList.add('is-target');
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  } catch (err) {
    root.innerHTML = `<p class="loading-hint error-hint">${escapeHtml(err.message)}</p>`;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadPromptLibrary);
} else {
  loadPromptLibrary();
}
