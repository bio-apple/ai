/**
 * 外链安全与失效兜底：统一 noreferrer；GitHub 仓库 404 弹窗提示。
 */
(function initLinkGuard() {
  const FALLBACK_IMG =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='360' viewBox='0 0 640 360'%3E%3Crect fill='%23e8edf6' width='640' height='360'/%3E%3Ctext x='50%25' y='50%25' fill='%235a6b85' font-size='18' text-anchor='middle' dy='.3em'%3E图片暂不可用%3C/text%3E%3C/svg%3E";

  function isExternal(href) {
    if (
      !href ||
      href.startsWith('#') ||
      href.startsWith('mailto:') ||
      href.startsWith('javascript:')
    ) {
      return false;
    }
    try {
      const u = new URL(href, location.href);
      return u.origin !== location.origin;
    } catch {
      return false;
    }
  }

  function ensureRel(a) {
    if (!isExternal(a.getAttribute('href') || '')) return;
    a.setAttribute('target', a.getAttribute('target') || '_blank');
    const rel = new Set(
      String(a.getAttribute('rel') || '')
        .split(/\s+/)
        .filter(Boolean),
    );
    rel.add('noopener');
    rel.add('noreferrer');
    a.setAttribute('rel', [...rel].join(' '));
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function showDeadLinkDialog(url, reason) {
    const existing = document.getElementById('bio-deadlink-dialog');
    if (existing) existing.remove();
    const dlg = document.createElement('div');
    dlg.id = 'bio-deadlink-dialog';
    dlg.className = 'deadlink-dialog';
    dlg.setAttribute('role', 'alertdialog');
    dlg.setAttribute('aria-modal', 'true');
    dlg.innerHTML = `
      <div class="deadlink-dialog-card">
        <h3>链接可能已失效</h3>
        <p>${escapeHtml(reason || '目标页面暂时无法访问（仓库下架、视频删除或网络限制）。')}</p>
        <p class="deadlink-url">${escapeHtml(url)}</p>
        <div class="deadlink-actions">
          <button type="button" class="deadlink-btn" data-action="copy">复制链接</button>
          <button type="button" class="deadlink-btn deadlink-btn-primary" data-action="open">仍要打开</button>
          <button type="button" class="deadlink-btn" data-action="close">关闭</button>
        </div>
      </div>`;
    document.body.appendChild(dlg);
    dlg.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) {
        if (e.target === dlg) dlg.remove();
        return;
      }
      const action = btn.dataset.action;
      if (action === 'copy') {
        navigator.clipboard?.writeText(url).catch(() => {});
      } else if (action === 'open') {
        window.open(url, '_blank', 'noopener,noreferrer');
        dlg.remove();
      } else {
        dlg.remove();
      }
    });
  }

  /** GitHub 仓库可达性（api.github.com 支持 CORS） */
  async function probeGithubRepo(url) {
    const m = String(url).match(/github\.com\/([^/]+)\/([^/#?]+)/i);
    if (!m) return { ok: true };
    const api = `https://api.github.com/repos/${encodeURIComponent(m[1])}/${encodeURIComponent(m[2])}`;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(api, {
        headers: { Accept: 'application/vnd.github+json' },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.status === 404) return { ok: false, reason: '该 GitHub 仓库不存在或已删除。' };
      if (res.status === 403) return { ok: true }; // 限流时放行
      return { ok: res.ok || res.status < 500 };
    } catch {
      return { ok: true }; // 网络异常不拦截
    }
  }

  document.addEventListener(
    'click',
    (e) => {
      const a = e.target.closest('a[href]');
      if (!a) return;
      ensureRel(a);
      const href = a.href || a.getAttribute('href') || '';
      if (!isExternal(href) || a.dataset.linkGuard === 'skip') return;
      if (!/github\.com\/[^/]+\/[^/]+/i.test(href)) return;

      e.preventDefault();
      a.setAttribute('aria-busy', 'true');
      probeGithubRepo(href).then((result) => {
        a.removeAttribute('aria-busy');
        if (result.ok) {
          window.open(href, '_blank', 'noopener,noreferrer');
        } else {
          showDeadLinkDialog(href, result.reason);
          if (typeof trackEvent === 'function') {
            trackEvent('dead_link_blocked', { url: href.slice(0, 120) });
          }
        }
      });
    },
    true,
  );

  function bindImgFallback(img) {
    if (!(img instanceof HTMLImageElement) || img.dataset.fallbackBound) return;
    img.dataset.fallbackBound = '1';
    if (!img.getAttribute('loading')) img.setAttribute('loading', 'lazy');
    if (!img.getAttribute('decoding')) img.setAttribute('decoding', 'async');
    if (!img.getAttribute('width')) img.setAttribute('width', '640');
    if (!img.getAttribute('height')) img.setAttribute('height', '360');
    img.addEventListener(
      'error',
      () => {
        if (img.dataset.fallbackApplied) return;
        img.dataset.fallbackApplied = '1';
        img.src = FALLBACK_IMG;
        img.removeAttribute('srcset');
        img.alt = img.alt || '图片暂不可用';
      },
      { once: true },
    );
  }

  document.querySelectorAll('a[href]').forEach(ensureRel);
  document.querySelectorAll('img').forEach(bindImgFallback);

  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        if (node.tagName === 'IMG') bindImgFallback(node);
        else {
          node.querySelectorAll?.('img').forEach(bindImgFallback);
          node.querySelectorAll?.('a[href]').forEach(ensureRel);
        }
      });
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();
