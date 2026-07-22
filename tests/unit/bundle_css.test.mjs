/**
 * CSS 打包与轻量压缩。
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bundleCss } from '../../scripts/bundle-css.mjs';

test('bundleCss minifies comments and excess whitespace', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'css-bundle-'));
  const entry = path.join(tmp, 'entry.css');
  const out = path.join(tmp, 'out.css');
  fs.writeFileSync(entry, `/* comment */\n.foo {\n  color: red;\n  margin: 0;\n}\n`);
  bundleCss({ entry, outFile: out, minify: true });
  const css = fs.readFileSync(out, 'utf8');
  assert.ok(!css.includes('comment'));
  assert.ok(css.includes('.foo{'));
  assert.ok(css.includes('color:red'));
});
