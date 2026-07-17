/**
 * 共享 JSON 拉取与 DOM 工具（courses / news / videos / oss 复用）
 */
(function () {
  const memo = new Map();

  function siteBase() {
    const raw = document.documentElement.dataset.base || '/ai/';
    return raw.endsWith('/') ? raw : `${raw}/`;
  }

  function resolveDataUrl(path) {
    if (/^https?:\/\//i.test(path)) return path;
    return `${siteBase()}${String(path).replace(/^\//, '')}`;
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function externalRel() {
    return 'noopener noreferrer';
  }

  /**
   * @param {string} path 相对 data-base 的路径
   * @param {{ cache?: RequestCache, retries?: number, timeoutMs?: number, label?: string, memoKey?: string }} opts
   */
  async function fetchJson(path, opts = {}) {
    const {
      cache = 'default',
      retries = 1,
      timeoutMs = 8000,
      label = '数据',
      memoKey = path,
    } = opts;
    const url = resolveDataUrl(path);

    if (cache !== 'no-store' && memo.has(memoKey)) {
      return memo.get(memoKey);
    }

    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const res = await fetch(url, {
          cache,
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!res.ok) throw new Error(`无法加载${label}（HTTP ${res.status}）`);
        const data = await res.json();
        if (cache !== 'no-store') memo.set(memoKey, data);
        return data;
      } catch (err) {
        lastErr = err;
      }
    }

    if (typeof trackEvent === 'function') {
      trackEvent('data_load_error', {
        source: path,
        message: String(lastErr?.message || lastErr),
      });
    }
    throw lastErr;
  }

  function invalidate(path) {
    memo.delete(path);
  }

  function bindRetry(root, retryFn) {
    if (!root) return;
    root.querySelectorAll('[data-retry]').forEach((btn) => {
      btn.addEventListener('click', () => {
        retryFn();
      });
    });
  }

  function renderErrorBlock(message, retryLabel = '重试') {
    return `
      <div class="data-error-block">
        <p class="loading-hint error-hint">${escapeHtml(message)}</p>
        <button type="button" class="data-retry-btn" data-retry>${escapeHtml(retryLabel)}</button>
      </div>
    `;
  }

  window.BioAI = window.BioAI || {};
  window.BioAI.fetchJson = fetchJson;
  window.BioAI.invalidateFetch = invalidate;
  window.BioAI.escapeHtml = escapeHtml;
  window.BioAI.externalRel = externalRel;
  window.BioAI.bindRetry = bindRetry;
  window.BioAI.renderErrorBlock = renderErrorBlock;
})();
