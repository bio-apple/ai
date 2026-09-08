/**
 * app.js 只做启动；导航 / 搜索在 lib/ 中。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function withAppModules(scripts) {
  if (!scripts.includes('app.js')) return [...scripts];
  const extras = ['lib/navigation.js', 'lib/search.js'];
  const out = scripts.filter((s) => !extras.includes(s));
  const i = out.indexOf('app.js');
  out.splice(i, 0, ...extras);
  return out;
}

test('withAppModules inserts navigation and search before app.js', () => {
  assert.deepEqual(withAppModules(['lib/link-guard.js', 'ux.js', 'app.js']), [
    'lib/link-guard.js',
    'ux.js',
    'lib/navigation.js',
    'lib/search.js',
    'app.js',
  ]);
});

test('app.js only boots navigation and search', () => {
  const src = readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  assert.match(src, /initNavigation/);
  assert.match(src, /initSearch/);
  assert.doesNotMatch(src, /function showSection/);
  assert.doesNotMatch(src, /function initSearchWrap/);
});

test('navigation and search libs expose init hooks', () => {
  const nav = readFileSync(path.join(ROOT, 'lib/navigation.js'), 'utf8');
  const search = readFileSync(path.join(ROOT, 'lib/search.js'), 'utf8');
  assert.match(nav, /BioAI\.initNavigation/);
  assert.match(nav, /window\.showSection/);
  assert.match(search, /BioAI\.initSearch/);
  assert.match(search, /bindSearchHotkey/);
  assert.match(search, /ask-knowledge/);
});
