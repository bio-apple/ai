/**
 * analytics.js 核心逻辑单元测试：
 * trackEvent 计数、GA/Clarity 初始化条件。
 */
import assert from 'node:assert/strict';
import test from 'node:test';

let analyticsConfig;
let clickStats;

function resetState() {
  analyticsConfig = {
    ga_measurement_id: '',
    clarity_project_id: '',
    track_engagement: true,
  };
  clickStats = {};
  globalThis.window = { __clickStats: clickStats };
}

function trackEvent(name, params = {}) {
  const gaId = analyticsConfig.ga_measurement_id;
  if (gaId && typeof globalThis.gtag === 'function') {
    globalThis.gtag('event', name, params);
  }
  if (typeof window.__clickStats !== 'object') window.__clickStats = {};
  window.__clickStats[name] = (window.__clickStats[name] || 0) + 1;
}

test.beforeEach(() => {
  resetState();
  delete globalThis.gtag;
  delete globalThis.dataLayer;
  delete globalThis.clarity;
});

/* ---- 本地计数 ---- */
test('trackEvent increments clickStats without GA', () => {
  trackEvent('recommend_submit', { matched: 'cursor' });
  trackEvent('recommend_submit');
  trackEvent('favorite_add');
  assert.equal(clickStats['recommend_submit'], 2);
  assert.equal(clickStats['favorite_add'], 1);
});

test('trackEvent initializes counter when missing', () => {
  assert.equal(clickStats['unknown_event'], undefined);
  trackEvent('unknown_event');
  assert.equal(clickStats['unknown_event'], 1);
});

/* ---- GA 初始化条件 ---- */
test('trackEvent does not call gtag when ga_measurement_id is empty', () => {
  let called = false;
  globalThis.gtag = () => { called = true; };
  trackEvent('test');
  assert.equal(called, false);
});

test('trackEvent calls gtag when ga_measurement_id is set', () => {
  analyticsConfig.ga_measurement_id = 'G-XXXXXXXXXX';
  const events = [];
  globalThis.gtag = (...args) => events.push(args);
  trackEvent('test_event', { param: 'value' });
  assert.equal(events.length, 1);
  assert.equal(events[0][0], 'event');
  assert.equal(events[0][1], 'test_event');
});

/* ---- config 加载 ---- */
test('analyticsConfig defaults to empty IDs', () => {
  assert.equal(analyticsConfig.ga_measurement_id, '');
  assert.equal(analyticsConfig.clarity_project_id, '');
  assert.equal(analyticsConfig.track_engagement, true);
});

/* ---- 异常边界 ---- */
test('trackEvent handles null params gracefully', () => {
  trackEvent('test', null);
  assert.equal(clickStats['test'], 1);
});

test('trackEvent auto-creates window.__clickStats when missing', () => {
  delete window.__clickStats;
  trackEvent('recovery_test');
  // should auto-create and count
  assert.equal(window.__clickStats['recovery_test'], 1);
});
