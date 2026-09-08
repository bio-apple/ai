import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const src = readFileSync(path.join(ROOT, 'lib/tool-shelf.js'), 'utf8');

function loadShelf() {
  const store = new Map();
  const localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => {
      store.set(key, String(value));
    },
    removeItem: (key) => {
      store.delete(key);
    },
  };
  const context = {
    localStorage,
    Date,
    JSON,
    Math,
    Number,
    String,
    Set,
    Array,
    Object,
    Boolean,
    console,
  };
  context.globalThis = context;
  context.window = context;
  vm.runInNewContext(src, context);
  return { shelf: context.BioAI.toolShelf, store };
}

test('toggleFavorite persists ids and isFavorite reflects them', () => {
  const { shelf, store } = loadShelf();
  assert.equal(JSON.stringify(shelf.loadFavorites()), '[]');
  assert.equal(shelf.toggleFavorite('Cursor').on, true);
  assert.equal(JSON.stringify(shelf.loadFavorites()), '["cursor"]');
  assert.equal(shelf.isFavorite('cursor'), true);
  assert.equal(shelf.toggleFavorite('cursor').on, false);
  assert.equal(JSON.stringify(shelf.loadFavorites()), '[]');
  assert.match(store.get(shelf.FAV_KEY) || '', /\[\]/);
});

test('recordVisit moves a tool to the front and skips hub', () => {
  const { shelf } = loadShelf();
  shelf.recordVisit('chatgpt', '2026-09-08T01:00:00+08:00');
  shelf.recordVisit('hub', '2026-09-08T02:00:00+08:00');
  shelf.recordVisit('cursor', '2026-09-08T03:00:00+08:00');
  shelf.recordVisit('chatgpt', '2026-09-08T04:00:00+08:00');
  const hist = shelf.loadHistory();
  assert.equal(
    JSON.stringify(hist.map((x) => x.id)),
    '["chatgpt","cursor"]',
  );
  assert.equal(hist[0].at, '2026-09-08T04:00:00+08:00');
});

test('normalizeId rejects junk and formatWhen uses relative hours', () => {
  const { shelf } = loadShelf();
  assert.equal(shelf.normalizeId('../x'), '');
  assert.equal(shelf.normalizeId('Claude'), 'claude');
  const now = Date.parse('2026-09-08T13:00:00+08:00');
  assert.equal(shelf.formatWhen('2026-09-08T11:00:00+08:00', now), '2小时前');
});

test('funnel treats shelf as its own page type', () => {
  const funnel = readFileSync(path.join(ROOT, 'funnel.js'), 'utf8');
  assert.match(funnel, /tools\/shelf\.html/);
  assert.match(funnel, /return 'shelf'/);
});
