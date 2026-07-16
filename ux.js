const THEME_KEY = 'bioai-theme';

function getStoredTheme() {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  const resolved = theme === 'dark' || theme === 'light' ? theme : getSystemTheme();
  document.documentElement.dataset.theme = resolved;
  document.querySelectorAll('.theme-toggle').forEach((btn) => {
    const isDark = resolved === 'dark';
    btn.setAttribute('aria-label', isDark ? '切换到浅色模式' : '切换到深色模式');
    btn.textContent = isDark ? '☀' : '☾';
  });
}

function initTheme() {
  applyTheme(getStoredTheme() || getSystemTheme());

  document.querySelectorAll('.theme-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        /* ignore */
      }
      applyTheme(next);
      if (typeof trackEvent === 'function') trackEvent('theme-toggle', { theme: next });
    });
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!getStoredTheme()) applyTheme(e.matches ? 'dark' : 'light');
  });
}

function initReadingProgress() {
  const bar = document.querySelector('.reading-progress-bar');
  const label = document.querySelector('.reading-progress-label');
  if (!bar) return;

  function update() {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const height = document.documentElement.scrollHeight - window.innerHeight;
    const pct = height > 0 ? Math.min(100, Math.round((scrollTop / height) * 100)) : 0;
    bar.style.width = `${pct}%`;
    if (label) {
      label.textContent = `阅读进度 ${pct}%`;
      label.classList.toggle('visible', scrollTop > 120);
    }
  }

  window.addEventListener('scroll', update, { passive: true });
  update();
}

function initBackToTop() {
  const btn = document.querySelector('.back-to-top');
  if (!btn) return;

  function update() {
    const show = (window.scrollY || document.documentElement.scrollTop) > 500;
    btn.classList.toggle('visible', show);
  }

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (typeof trackEvent === 'function') trackEvent('back-to-top');
  });

  window.addEventListener('scroll', update, { passive: true });
  update();
}

const TOC_PRIMARY = [
  { id: 'section-home', label: '首页' },
  { id: 'section-chatgpt', label: 'ChatGPT' },
  { id: 'section-claude', label: 'Claude' },
  { id: 'section-gemini', label: 'Gemini' },
  { id: 'section-deepseek', label: 'DeepSeek' },
  { id: 'section-kimi', label: 'Kimi' },
  { id: 'section-qwen', label: '通义千问' },
  { id: 'section-doubao', label: '豆包' },
  { id: 'section-cursor', label: 'Cursor' },
  { id: 'section-codex', label: 'Codex' },
  { id: 'section-copilot', label: 'Copilot' },
  { id: 'section-create', label: 'AI 创作' },
  { id: 'section-cases', label: '案例库' },
  { id: 'section-prompts', label: 'Prompt库' },
  { id: 'section-news', label: 'AI 新闻' },
  { id: 'section-videos', label: 'AI 视频' },
];

function headingLevel(tag) {
  return Number(tag.replace('h', '')) || 2;
}

function collectHeadings(root) {
  if (!root) return [];
  const seen = new Set();
  const items = [];
  root.querySelectorAll('h2, h3, h4').forEach((el, index) => {
    const text = el.textContent.trim();
    if (!text || seen.has(text)) return;
    seen.add(text);
    if (!el.id) el.id = `toc-h-${index}`;
    items.push({
      id: el.id,
      label: text,
      level: headingLevel(el.tagName.toLowerCase()),
    });
  });
  return items;
}

function renderTocPrimary(activeId) {
  return TOC_PRIMARY.filter((item) => document.getElementById(item.id))
    .map((item) => {
      const active = item.id === activeId ? ' active' : '';
      return `<li><button type="button" class="page-toc-link${active}" data-section="${item.id}">${item.label}</button></li>`;
    })
    .join('');
}

function renderTocSubheadings(headings, activeHeadingId) {
  if (!headings.length) return '';
  const links = headings
    .map((h) => {
      const active = h.id === activeHeadingId ? ' active' : '';
      return `<li><button type="button" class="page-toc-link${active}" data-level="${h.level}" data-heading="${h.id}">${h.label}</button></li>`;
    })
    .join('');
  return `<div class="page-toc-subtitle">本页目录</div><ul class="page-toc-nav">${links}</ul>`;
}

function bindTocLinks(container) {
  if (!container) return;
  container.querySelectorAll('[data-section]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (typeof showSection === 'function') {
        showSection(btn.dataset.section);
      }
    });
  });
  container.querySelectorAll('[data-heading]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const el = document.getElementById(btn.dataset.heading);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      container.querySelectorAll('.page-toc-link').forEach((l) => l.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

function updatePageToc(activeSectionId) {
  const toc = document.getElementById('page-toc');
  if (!toc) return;

  const activeSection = activeSectionId
    ? document.getElementById(activeSectionId)
    : document.querySelector('.section.active');

  const sectionId = activeSection?.id || 'section-home';
  const headingRoot =
    sectionId === 'section-home'
      ? document.querySelector('#section-home .home-main')
      : activeSection;

  const sub = collectHeadings(headingRoot);
  const promptHeading =
    sectionId === 'section-cases'
      ? [{ id: 'section-cases', label: 'Prompt 提示词库', level: 2 }]
      : [];

  toc.innerHTML = `
    <div class="page-toc-title">页面导航</div>
    <ul class="page-toc-nav">${renderTocPrimary(sectionId)}</ul>
    <div class="page-toc-divider"></div>
    ${renderTocSubheadings([...promptHeading, ...sub])}
  `;

  document.body.classList.add('toc-enabled');
  bindTocLinks(toc);
}

function initStandaloneToc() {
  const toc = document.getElementById('page-toc');
  const main = document.querySelector('main');
  if (!toc || !main || document.querySelector('.section')) return;

  const headings = collectHeadings(main);
  if (!headings.length) {
    document.body.classList.remove('toc-enabled');
    return;
  }

  toc.innerHTML = `
    <div class="page-toc-title">本页目录</div>
    <ul class="page-toc-nav">
      ${headings.map((h) => `<li><button type="button" class="page-toc-link" data-level="${h.level}" data-heading="${h.id}">${h.label}</button></li>`).join('')}
    </ul>
  `;
  document.body.classList.add('toc-enabled');
  bindTocLinks(toc);
}

function initPageToc() {
  if (document.getElementById('page-toc')) {
    if (document.querySelector('.section')) {
      updatePageToc(document.querySelector('.section.active')?.id);
      window.addEventListener('bioai:section-change', (e) => {
        updatePageToc(e.detail?.sectionId);
      });
    } else {
      initStandaloneToc();
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initReadingProgress();
  initBackToTop();
  initPageToc();
  initScrollReveal();
});

function initScrollReveal(root = document) {
  const targets = root.querySelectorAll('.reveal:not(.visible)');
  if (!targets.length) return;
  if (!('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('visible'));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.08, rootMargin: '0px 0px -30px 0px' },
  );
  targets.forEach((el) => observer.observe(el));
}

window.refreshScrollReveal = initScrollReveal;

window.updatePageToc = updatePageToc;
