/* 分析：隐私优先 Umami / Cloudflare Web Analytics；可选 GA4 / Clarity */
let analyticsConfig = {
  ga_measurement_id: '',
  clarity_project_id: '',
  umami_script_url: '',
  umami_website_id: '',
  cloudflare_beacon_token: '',
  track_engagement: true,
};

function trackEvent(name, params = {}) {
  const gaId = analyticsConfig.ga_measurement_id;
  if (gaId && typeof gtag === 'function') {
    gtag('event', name, params);
  }
  if (typeof window.umami?.track === 'function') {
    try {
      window.umami.track(name, params);
    } catch {
      /* ignore */
    }
  }
  if (typeof window.__clickStats !== 'object') window.__clickStats = {};
  window.__clickStats[name] = (window.__clickStats[name] || 0) + 1;
  if (typeof window.bioEngagement?.onEvent === 'function') {
    try {
      window.bioEngagement.onEvent(name, params);
    } catch {
      /* ignore */
    }
  }
}

function initGA4() {
  const gaId = (analyticsConfig.ga_measurement_id || '').trim();
  if (!gaId) return;
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  gtag('js', new Date());
  gtag('config', gaId, { send_page_view: true });
}

function initClarity() {
  const clarityId = (analyticsConfig.clarity_project_id || '').trim();
  if (!clarityId) return;
  window.clarity =
    window.clarity ||
    function clarityStub() {
      (window.clarity.q = window.clarity.q || []).push(arguments);
    };
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.clarity.ms/tag/${clarityId}`;
  document.head.appendChild(s);
}

/** 无 cookie：Umami（自托管或 cloud.umami.is） */
function initUmami() {
  const scriptUrl = (analyticsConfig.umami_script_url || '').trim();
  const websiteId = (analyticsConfig.umami_website_id || '').trim();
  if (!scriptUrl || !websiteId) return;
  const s = document.createElement('script');
  s.defer = true;
  s.src = scriptUrl;
  s.dataset.websiteId = websiteId;
  s.dataset.autoTrack = 'true';
  document.head.appendChild(s);
}

/** 无 cookie：Cloudflare Web Analytics beacon */
function initCloudflareWebAnalytics() {
  const token = (analyticsConfig.cloudflare_beacon_token || '').trim();
  if (!token) return;
  const s = document.createElement('script');
  s.defer = true;
  s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  s.setAttribute('data-cf-beacon', JSON.stringify({ token }));
  document.head.appendChild(s);
}

function initEngagementTracking() {
  if (!analyticsConfig.track_engagement) return;
  const hasSink =
    (analyticsConfig.ga_measurement_id || '').trim() ||
    (analyticsConfig.umami_website_id || '').trim();
  if (!hasSink) return;

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
  const base = document.documentElement?.dataset?.base || document.body?.dataset?.assetBase || '';
  const prefix = String(base).replace(/\/?$/, '/');
  try {
    const res = await fetch(`${prefix}analytics-config.json`, { cache: 'default' });
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
    const params = {
      element: el.tagName,
      text: (el.textContent || '').trim().slice(0, 80),
    };
    if (el.dataset.trackPanel) params.panel = el.dataset.trackPanel;
    if (el.dataset.tool) params.tool = el.dataset.tool;
    trackEvent(el.dataset.track, params);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadAnalyticsConfig();
  initUmami();
  initCloudflareWebAnalytics();
  initGA4();
  initClarity();
  initEngagementTracking();
  bindClickTracking();
});
