const PROMPTS_DATA_URL = (typeof document !== 'undefined' && document.documentElement.dataset.base
  ? document.documentElement.dataset.base.replace(/\/?$/, '/')
  : (window.location.pathname.includes('/prompts/') ? '../' : '')) + 'prompts.json';

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

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function fetchPromptsData() {
  if (!promptsDataPromise) {
    promptsDataPromise = fetch(PROMPTS_DATA_URL, { cache: 'default' })
      .then(res => {
        if (!res.ok) throw new Error('无法加载 Prompt 数据');
        return res.json();
      })
      .catch(err => {
        promptsDataPromise = null;
        throw err;
      });
  }
  return promptsDataPromise;
}

function renderPromptCard(prompt) {
  const catLabel = CATEGORY_LABELS[prompt.category] || prompt.category;
  const caseLink = prompt.case_anchor
    ? `cases/index.html#${encodeURIComponent(prompt.case_anchor)}`
    : 'cases/index.html';
  const prefix = window.location.pathname.includes('/prompts/') ? '../' : '';
  return `
    <article class="prompt-card reveal" id="${escapeHtml(prompt.id)}" data-category="${escapeHtml(prompt.category)}">
      <div class="prompt-card-head">
        <span class="prompt-category">${escapeHtml(catLabel)}</span>
        <span class="case-badge ${escapeHtml(prompt.tool)}">${escapeHtml(prompt.tool)}</span>
      </div>
      <h4>${escapeHtml(prompt.title)}</h4>
      <p class="prompt-case-ref">来自：${escapeHtml(prompt.case_title)}</p>
      <pre class="prompt-content">${escapeHtml(prompt.content)}</pre>
      <div class="prompt-card-actions">
        <button type="button" class="prompt-copy-btn" data-prompt-copy>复制 Prompt</button>
        <a href="${prefix}${caseLink}" class="prompt-case-link" data-track="prompt-case-link">查看案例 →</a>
      </div>
    </article>
  `;
}

function bindPromptCards(root) {
  root.querySelectorAll('[data-prompt-copy]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const card = btn.closest('.prompt-card');
      const text = card?.querySelector('.prompt-content')?.textContent?.trim();
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = '已复制 ✓';
        setTimeout(() => { btn.textContent = '复制 Prompt'; }, 2000);
        if (typeof trackEvent === 'function') trackEvent('prompt-library-copy');
      } catch {
        btn.textContent = '复制失败';
      }
    });
  });
}

function renderPromptsList(data, category = 'all') {
  const root = document.getElementById('prompts-list');
  const meta = document.getElementById('prompts-count-meta');
  if (!root) return;

  let items = data.prompts || [];
  if (category !== 'all') {
    items = items.filter(p => p.category === category);
  }

  if (meta) {
    meta.textContent = `共 ${data.count || items.length} 条 Prompt · 当前显示 ${items.length} 条`;
  }

  if (!items.length) {
    root.innerHTML = '<p class="loading-hint">该分类暂无 Prompt。</p>';
    return;
  }

  root.innerHTML = items.map(renderPromptCard).join('');
  bindPromptCards(root);
  if (typeof window.refreshScrollReveal === 'function') window.refreshScrollReveal(root);
}

function initPromptFilters() {
  const toolbar = document.getElementById('prompts-toolbar');
  if (!toolbar) return;

  toolbar.querySelectorAll('[data-prompt-cat]').forEach(btn => {
    btn.addEventListener('click', async () => {
      toolbar.querySelectorAll('[data-prompt-cat]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activePromptCategory = btn.dataset.promptCat;
      try {
        const data = await fetchPromptsData();
        renderPromptsList(data, activePromptCategory);
        if (typeof trackEvent === 'function') trackEvent('prompt-filter', { category: activePromptCategory });
      } catch {
        /* ignore */
      }
    });
  });
}

async function loadPromptLibrary() {
  const root = document.getElementById('prompts-list');
  if (!root) return;

  root.innerHTML = '<p class="loading-hint">加载 Prompt 库…</p>';

  try {
    const data = await fetchPromptsData();
    renderPromptsList(data, activePromptCategory);
    initPromptFilters();
  } catch (err) {
    root.innerHTML = `<p class="loading-hint error-hint">${escapeHtml(err.message)}</p>`;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadPromptLibrary);
} else {
  loadPromptLibrary();
}
