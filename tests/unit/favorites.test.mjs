/**
 * favorites.js 核心逻辑单元测试：
 * localStorage 读写、去重、导入合并、导出结构。
 */
import assert from 'node:assert/strict';
import test from 'node:test';

const KEY = 'bioai.favorites.v1';

/* ---- 模拟 localStorage ---- */
let store = {};

function mockLocalStorage() {
  store = {};
  globalThis.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };
}

/* ---- 提取 favorites.js 核心逻辑（去 DOM 依赖） ---- */
function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function save(ids) {
  localStorage.setItem(KEY, JSON.stringify([...new Set(ids)]));
}

function isFav(id) {
  return load().includes(id);
}

function toggle(id) {
  const cur = load();
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
  save(next);
  return next.includes(id);
}

function importMerge(fileJson) {
  const data = typeof fileJson === 'string' ? JSON.parse(fileJson) : fileJson;
  const list = Array.isArray(data) ? data : data.tools;
  if (!Array.isArray(list)) throw new Error('invalid');
  const ids = list.filter((x) => typeof x === 'string' && x.trim());
  save([...new Set([...load(), ...ids])]);
  return ids;
}

function exportJson() {
  return {
    schema_version: 1,
    exported_at: new Date().toISOString(),
    tools: load(),
  };
}

test.beforeEach(() => {
  mockLocalStorage();
});

/* ---- 基础读写 ---- */
test('load returns empty array when store is empty', () => {
  assert.deepEqual(load(), []);
});

test('save and load round-trip', () => {
  save(['chatgpt', 'cursor']);
  assert.deepEqual(load(), ['chatgpt', 'cursor']);
});

/* ---- 去重 ---- */
test('save deduplicates ids', () => {
  save(['chatgpt', 'chatgpt', 'cursor', 'chatgpt']);
  assert.deepEqual(load(), ['chatgpt', 'cursor']);
});

/* ---- toggle ---- */
test('toggle adds new id', () => {
  const added = toggle('chatgpt');
  assert.equal(added, true);
  assert.deepEqual(load(), ['chatgpt']);
});

test('toggle removes existing id', () => {
  save(['chatgpt', 'cursor']);
  const removed = toggle('chatgpt');
  assert.equal(removed, false);
  assert.deepEqual(load(), ['cursor']);
});

test('isFav checks membership', () => {
  save(['chatgpt']);
  assert.equal(isFav('chatgpt'), true);
  assert.equal(isFav('cursor'), false);
});

/* ---- 导入合并 ---- */
test('import merge adds new tools without duplicating', () => {
  save(['chatgpt']);
  importMerge({ tools: ['cursor', 'chatgpt'] });
  assert.deepEqual(load(), ['chatgpt', 'cursor']);
});

test('import merge accepts flat array', () => {
  save(['chatgpt']);
  importMerge(['cursor', 'deepseek']);
  assert.deepEqual(load(), ['chatgpt', 'cursor', 'deepseek']);
});

test('import merge filters non-string entries', () => {
  importMerge({ tools: ['chatgpt', '', null, 123, 'cursor'] });
  assert.deepEqual(load(), ['chatgpt', 'cursor']);
});

test('import merge throws on invalid input', () => {
  assert.throws(() => importMerge({ tools: 42 }), /invalid/);
});

/* ---- 导出 ---- */
test('export produces valid structure', () => {
  save(['chatgpt', 'cursor']);
  const exported = exportJson();
  assert.equal(exported.schema_version, 1);
  assert.deepEqual(exported.tools, ['chatgpt', 'cursor']);
  assert.ok(new Date(exported.exported_at).getTime() > 0);
});

/* ---- 异常存储容错 ---- */
test('load handles corrupt localStorage gracefully', () => {
  localStorage.setItem(KEY, '{not valid json');
  assert.deepEqual(load(), []);
});
