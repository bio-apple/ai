import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('PWA manifest and service worker cover the knowledge shell', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.start_url, '/ai/');
  assert.equal(manifest.scope, '/ai/');
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.icons?.length);

  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  assert.match(sw, /search-index\.json/);
  assert.match(sw, /knowledge\.js/);
  assert.match(sw, /skipWaiting/);
  assert.match(sw, /clients\.claim/);
});
