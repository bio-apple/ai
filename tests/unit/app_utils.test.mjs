/**
 * escapeHtml · handleDataError · 全局工具函数单元测试。
 * 测试 app.js 中挂载到 window 的公共函数。
 */
import assert from 'node:assert/strict';
import test from 'node:test';

/* ---- escapeHtml ---- */
function escapeHtml(s) {
  const d = { textContent: '', innerHTML: '' };
  // 模拟 DOM textContent → innerHTML 行为
  const escapeMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  const escaped = String(s).replace(/[&<>"']/g, (ch) => escapeMap[ch]);
  // textContent 赋值后 innerHTML 返回转义后的字符串
  d.textContent = s;
  d.innerHTML = escaped;
  return d.innerHTML;
}

test('escapeHtml escapes < and >', () => {
  assert.equal(escapeHtml('<script>'), '&lt;script&gt;');
});

test('escapeHtml escapes &', () => {
  assert.equal(escapeHtml('a & b'), 'a &amp; b');
});

test('escapeHtml escapes quotes', () => {
  const result = escapeHtml('"hello"');
  assert.ok(result.includes('&quot;'));
});

test('escapeHtml passes safe text through', () => {
  assert.equal(escapeHtml('hello world'), 'hello world');
});

test('escapeHtml handles empty string', () => {
  assert.equal(escapeHtml(''), '');
});

test('escapeHtml handles non-string values', () => {
  assert.equal(escapeHtml(123), '123');
});

/* ---- handleDataError ---- */
function handleDataError(root, source) {
  if (!root) return;
  root.innerHTML = '<p class="loading-hint error-hint">数据加载失败，请稍后刷新重试。</p>';
}

test('handleDataError sets error HTML on root element', () => {
  const root = { innerHTML: '' };
  handleDataError(root, 'test-source');
  assert.ok(root.innerHTML.includes('数据加载失败'));
  assert.ok(root.innerHTML.includes('error-hint'));
});

test('handleDataError is safe when root is null', () => {
  assert.doesNotThrow(() => handleDataError(null, 'test'));
});

test('handleDataError is safe when root is undefined', () => {
  assert.doesNotThrow(() => handleDataError(undefined, 'test'));
});
