/* AI 知识库助手：客户端 Fuse 检索 + 可选 /api/ask */
(function initKnowledgeAssistant() {
  const fab = document.getElementById('knowledge-fab');
  const panel = document.getElementById('knowledge-panel');
  const closeBtn = document.getElementById('knowledge-close');
  const form = document.getElementById('knowledge-form');
  const input = document.getElementById('knowledge-input');
  const messages = document.getElementById('knowledge-messages');
  if (!fab || !panel || !form || !input || !messages) return;

  let fuse = null;
  let index = [];
  let apiAvailable = null;

  function appendMsg(text, role) {
    const el = document.createElement('div');
    el.className = `knowledge-msg ${role}`;
    el.textContent = text;
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
    return el;
  }

  function appendBotAnswer(answer, sources) {
    const el = document.createElement('div');
    el.className = 'knowledge-msg bot';
    el.textContent = answer;
    (sources || []).slice(0, 4).forEach((src) => {
      const a = document.createElement('a');
      a.className = 'knowledge-source';
      if (src.url) {
        a.href = src.url;
      } else if (src.section) {
        const anchor = src.anchor ? `?anchor=${src.anchor}#${src.section}` : `#${src.section}`;
        a.href = `index.html${anchor}`;
      } else {
        return;
      }
      a.textContent = `→ ${src.label || '查看'}`;
      el.appendChild(a);
    });
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
  }

  async function loadIndex() {
    try {
      const res = await fetch('search-index.json', { cache: 'no-store' });
      if (!res.ok) return;
      index = await res.json();
      if (typeof Fuse !== 'undefined' && Array.isArray(index) && index.length) {
        fuse = new Fuse(index, {
          keys: [
            { name: 'label', weight: 0.55 },
            { name: 'keywords', weight: 0.45 },
          ],
          threshold: 0.42,
          includeScore: true,
        });
      }
    } catch {
      /* ignore */
    }
  }

  function localAnswer(query) {
    if (!fuse) {
      return {
        answer: '知识库索引尚未加载，请刷新页面后重试。',
        sources: [],
      };
    }
    const hits = fuse.search(query, { limit: 5 }).map((r) => r.item);
    if (!hits.length) {
      return {
        answer: '暂未找到相关内容。可换用工具名或「Prompt / 案例 / 视频」等关键词。',
        sources: [],
      };
    }
    const lines = [`根据站内知识库，为你找到 ${hits.length} 条相关内容：`];
    hits.forEach((h, i) => {
      lines.push(`${i + 1}. ${h.type ? `[${h.type}] ` : ''}${h.label}`);
    });
    return { answer: lines.join('\n'), sources: hits };
  }

  async function remoteAnswer(query) {
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit: 5 }),
    });
    if (!res.ok) throw new Error('api failed');
    return res.json();
  }

  async function probeApi() {
    if (apiAvailable !== null) return apiAvailable;
    try {
      const res = await fetch('/api/health', { cache: 'no-store' });
      apiAvailable = res.ok;
    } catch {
      apiAvailable = false;
    }
    return apiAvailable;
  }

  async function ask(query) {
    appendMsg(query, 'user');
    input.value = '';
    input.disabled = true;
    try {
      let result;
      if (await probeApi()) {
        try {
          result = await remoteAnswer(query);
        } catch {
          result = localAnswer(query);
        }
      } else {
        result = localAnswer(query);
      }
      appendBotAnswer(result.answer, result.sources);
      if (typeof trackEvent === 'function') {
        trackEvent('knowledge_ask', { query: query.slice(0, 80) });
      }
    } finally {
      input.disabled = false;
      input.focus();
    }
  }

  function setOpen(open) {
    panel.classList.toggle('open', open);
    panel.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (open) input.focus();
  }

  fab.addEventListener('click', () => setOpen(!panel.classList.contains('open')));
  closeBtn.addEventListener('click', () => setOpen(false));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = (input.value || '').trim();
    if (q) ask(q);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setOpen(false);
  });

  loadIndex();
})();
