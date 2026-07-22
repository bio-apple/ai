/* AI 知识库助手：客户端 Fuse 检索 + 可选 /api/ask */
(function initKnowledgeAssistant() {
  const fab = document.getElementById('knowledge-fab');
  const panel = document.getElementById('knowledge-panel');
  const closeBtn = document.getElementById('knowledge-close');
  const form = document.getElementById('knowledge-form');
  const input = document.getElementById('knowledge-input');
  const submitBtn = document.getElementById('knowledge-submit');
  const messages = document.getElementById('knowledge-messages');
  if (!fab || !panel || !closeBtn || !form || !input || !messages) return;

  const FEEDBACK_KEY = 'bio-ai-lab-knowledge-feedback';
  let fuse = null;
  let index = [];
  let apiAvailable = null;
  let asking = false;
  let msgSeq = 0;

  function loadFeedback() {
    try {
      return JSON.parse(localStorage.getItem(FEEDBACK_KEY) || '{}');
    } catch {
      return {};
    }
  }

  function saveFeedback(map) {
    try {
      localStorage.setItem(FEEDBACK_KEY, JSON.stringify(map));
    } catch {
      /* ignore */
    }
  }

  function nextMsgId() {
    msgSeq += 1;
    return `k-${Date.now()}-${msgSeq}`;
  }

  function autoGrowTextarea() {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
  }

  function scrollMessages() {
    messages.scrollTop = messages.scrollHeight;
  }

  function setComposerDisabled(disabled) {
    input.disabled = disabled;
    if (submitBtn) submitBtn.disabled = disabled;
    asking = disabled;
  }

  function appendUserMsg(text) {
    const el = document.createElement('div');
    el.className = 'knowledge-msg user';
    el.dataset.msgId = nextMsgId();
    const body = document.createElement('div');
    body.className = 'knowledge-msg-body';
    body.textContent = text;
    el.appendChild(body);
    messages.appendChild(el);
    scrollMessages();
    return el;
  }

  function showThinking() {
    const el = document.createElement('div');
    el.className = 'knowledge-msg bot is-thinking';
    el.dataset.msgId = 'thinking';
    const body = document.createElement('div');
    body.className = 'knowledge-msg-body';
    body.innerHTML = `
      <div class="knowledge-thinking">
        <span>正在检索</span><span class="knowledge-cursor" aria-hidden="true"></span>
      </div>
      <div class="knowledge-skeleton" aria-hidden="true">
        <div class="knowledge-skeleton-line"></div>
        <div class="knowledge-skeleton-line"></div>
        <div class="knowledge-skeleton-line"></div>
      </div>`;
    el.appendChild(body);
    messages.appendChild(el);
    scrollMessages();
    return el;
  }

  function removeThinking() {
    const el = messages.querySelector('[data-msg-id="thinking"]');
    if (el) el.remove();
  }

  function buildSourceLink(src) {
    const a = document.createElement('a');
    a.className = 'knowledge-source';
    if (src.url) {
      a.href = src.url;
    } else if (src.section) {
      const anchor = src.anchor ? `?anchor=${src.anchor}#${src.section}` : `#${src.section}`;
      a.href = `index.html${anchor}`;
    } else {
      return null;
    }
    a.textContent = `→ ${src.label || '查看'}`;
    return a;
  }

  function createActionBar(msgId, answerText, query) {
    const bar = document.createElement('div');
    bar.className = 'knowledge-actions';

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'knowledge-action-btn';
    copyBtn.textContent = '复制';
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(answerText);
        copyBtn.textContent = '已复制';
        copyBtn.classList.add('is-copied');
        setTimeout(() => {
          copyBtn.textContent = '复制';
          copyBtn.classList.remove('is-copied');
        }, 1600);
      } catch {
        copyBtn.textContent = '复制失败';
      }
    });

    const regenBtn = document.createElement('button');
    regenBtn.type = 'button';
    regenBtn.className = 'knowledge-action-btn';
    regenBtn.textContent = '重新生成';
    regenBtn.addEventListener('click', () => {
      if (query && !asking) ask(query, { regenerate: true });
    });

    const upBtn = document.createElement('button');
    upBtn.type = 'button';
    upBtn.className = 'knowledge-action-btn';
    upBtn.dataset.feedback = 'up';
    upBtn.textContent = '👍';
    upBtn.setAttribute('aria-label', '有帮助');

    const downBtn = document.createElement('button');
    downBtn.type = 'button';
    downBtn.className = 'knowledge-action-btn';
    downBtn.dataset.feedback = 'down';
    downBtn.textContent = '👎';
    downBtn.setAttribute('aria-label', '无帮助');

    const feedback = loadFeedback();
    const saved = feedback[msgId];
    if (saved === 'up') upBtn.classList.add('is-active');
    if (saved === 'down') downBtn.classList.add('is-active');

    function setVote(kind) {
      const map = loadFeedback();
      map[msgId] = kind;
      saveFeedback(map);
      upBtn.classList.toggle('is-active', kind === 'up');
      downBtn.classList.toggle('is-active', kind === 'down');
      if (typeof trackEvent === 'function') {
        trackEvent('knowledge_feedback', { msg_id: msgId, vote: kind });
      }
    }

    upBtn.addEventListener('click', () => setVote('up'));
    downBtn.addEventListener('click', () => setVote('down'));

    bar.append(copyBtn, regenBtn, upBtn, downBtn);
    return bar;
  }

  function appendBotAnswer(answer, sources, query) {
    const msgId = nextMsgId();
    const el = document.createElement('div');
    el.className = 'knowledge-msg bot';
    el.dataset.msgId = msgId;

    const body = document.createElement('div');
    body.className = 'knowledge-msg-body';
    body.textContent = answer;
    el.appendChild(body);

    (sources || []).slice(0, 4).forEach((src) => {
      const link = buildSourceLink(src);
      if (link) body.appendChild(link);
    });

    el.appendChild(createActionBar(msgId, answer, query));
    messages.appendChild(el);
    scrollMessages();
    return el;
  }

  async function loadIndex() {
    try {
      const res = await fetch('search-index.json', { cache: 'default' });
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
        answer: '暂未找到相关内容。可换用工具名或「课程 / 开源 / 视频」等关键词。',
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

  async function ask(query, opts = {}) {
    const q = (query || '').trim();
    if (!q || asking) return;

    if (!opts.regenerate) appendUserMsg(q);

    input.value = '';
    autoGrowTextarea();
    setComposerDisabled(true);
    showThinking();

    try {
      let result;
      if (await probeApi()) {
        try {
          result = await remoteAnswer(q);
        } catch {
          result = localAnswer(q);
        }
      } else {
        await new Promise((r) => setTimeout(r, 280));
        result = localAnswer(q);
      }
      removeThinking();
      appendBotAnswer(result.answer, result.sources, q);
      if (typeof trackEvent === 'function') {
        trackEvent('knowledge_ask', { query: q.slice(0, 80), regenerate: !!opts.regenerate });
      }
    } catch {
      removeThinking();
      appendBotAnswer('检索时出现问题，请稍后重试。', [], q);
    } finally {
      setComposerDisabled(false);
      input.focus();
    }
  }

  function setOpen(open) {
    panel.classList.toggle('open', open);
    panel.setAttribute('aria-hidden', open ? 'false' : 'true');
    document.body.classList.toggle('knowledge-panel-open', open);
    if (open) {
      syncMobileViewport();
      input.focus();
    } else {
      resetMobileViewport();
      if (document.activeElement && panel.contains(document.activeElement)) {
        fab.focus();
      }
    }
  }

  function focusablesInPanel() {
    return [
      ...panel.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ].filter((el) => el.offsetParent !== null || el === document.activeElement);
  }

  function syncMobileViewport() {
    if (window.innerWidth > 640) return;
    const vv = window.visualViewport;
    if (!vv) return;
    panel.style.height = `${vv.height}px`;
    panel.style.top = `${vv.offsetTop}px`;
  }

  function resetMobileViewport() {
    panel.style.height = '';
    panel.style.top = '';
  }

  fab.addEventListener('click', () => setOpen(!panel.classList.contains('open')));
  closeBtn.addEventListener('click', () => setOpen(false));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    ask(input.value);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      ask(input.value);
    }
  });

  input.addEventListener('input', autoGrowTextarea);

  document.addEventListener('keydown', (e) => {
    if (!panel.classList.contains('open')) return;
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (e.key !== 'Tab') return;
    const nodes = focusablesInPanel();
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', syncMobileViewport);
    window.visualViewport.addEventListener('scroll', syncMobileViewport);
  }

  loadIndex();
  autoGrowTextarea();
})();
