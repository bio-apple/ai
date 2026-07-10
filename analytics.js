/* 点击追踪：在 GA_MEASUREMENT_ID 填入 ID 后自动启用 GA4 */
const GA_MEASUREMENT_ID = '';

function trackEvent(name, params = {}) {
  if (GA_MEASUREMENT_ID && typeof gtag === 'function') {
    gtag('event', name, params);
  }
  if (typeof window.__clickStats !== 'object') window.__clickStats = {};
  window.__clickStats[name] = (window.__clickStats[name] || 0) + 1;
}

function initAnalytics() {
  if (!GA_MEASUREMENT_ID) return;
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  gtag('js', new Date());
  gtag('config', GA_MEASUREMENT_ID, { send_page_view: true });
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

document.addEventListener('DOMContentLoaded', () => {
  initAnalytics();
  bindClickTracking();
});
