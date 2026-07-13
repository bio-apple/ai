/* 点击追踪：从 analytics-config.json 读取 GA4 / Clarity 配置 */
let analyticsConfig = {
  ga_measurement_id: '',
  clarity_project_id: '',
  track_engagement: true,
};

function trackEvent(name, params = {}) {
  const gaId = analyticsConfig.ga_measurement_id;
  if (gaId && typeof gtag === 'function') {
    gtag('event', name, params);
  }
  if (typeof window.__clickStats !== 'object') window.__clickStats = {};
  window.__clickStats[name] = (window.__clickStats[name] || 0) + 1;
}

function initGA4() {
  const gaId = (analyticsConfig.ga_measurement_id || '').trim();
  if (!gaId) return;
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  gtag('js', new Date());
  gtag('config', gaId, { send_page_view: true });
}

function initClarity() {
  const clarityId = (analyticsConfig.clarity_project_id || '').trim();
  if (!clarityId) return;
  window.clarity = window.clarity || function clarityStub() {
    (window.clarity.q = window.clarity.q || []).push(arguments);
  };
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.clarity.ms/tag/${clarityId}`;
  document.head.appendChild(s);
}

function initEngagementTracking() {
  if (!analyticsConfig.track_engagement) return;
  const gaId = (analyticsConfig.ga_measurement_id || '').trim();
  if (!gaId) return;

  let visibleMs = 0;
  let visibleSince = document.visibilityState === 'visible' ? Date.now() : null;

  const flush = (reason) => {
    if (visibleSince !== null) {
      visibleMs += Date.now() - visibleSince;
      visibleSince = document.visibilityState === 'visible' ? Date.now() : null;
    }
    const seconds = Math.round(visibleMs / 1000);
    if (seconds >= 5) {
      trackEvent('page_engagement', {
        engagement_time_sec: seconds,
        page_path: location.pathname,
        reason,
      });
    }
    visibleMs = 0;
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush('visibility_hidden');
    else visibleSince = Date.now();
  });
  window.addEventListener('pagehide', () => flush('pagehide'));
}

async function loadAnalyticsConfig() {
  const base = document.body?.dataset?.assetBase || '';
  try {
    const res = await fetch(`${base}analytics-config.json`, { cache: 'default' });
    if (res.ok) {
      const data = await res.json();
      analyticsConfig = { ...analyticsConfig, ...data };
    }
  } catch {
    /* 离线或本地文件预览时忽略 */
  }
}

function bindClickTracking() {
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-track]');
    if (!el) return;
    trackEvent(el.dataset.track, {
      element: el.tagName,
      text: (el.textContent || '').trim().slice(0, 80),
    });
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadAnalyticsConfig();
  initGA4();
  initClarity();
  initEngagementTracking();
  bindClickTracking();
});
