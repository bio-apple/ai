#!/usr/bin/env node
/**
 * 将 style.css 的 @import 链展开为单文件，消除首屏 CSS 瀑布请求。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const IMPORT_RE = /@import\s+url\(['"]?([^'"]+)['"]?\)\s*;?/g;

function resolveImports(entryFile, seen = new Set()) {
  const abs = path.resolve(entryFile);
  if (seen.has(abs)) return '';
  seen.add(abs);
  const dir = path.dirname(abs);
  let css = fs.readFileSync(abs, 'utf8');
  css = css.replace(IMPORT_RE, (_, rel) => {
    const child = path.resolve(dir, rel);
    if (!fs.existsSync(child)) {
      console.warn(`⚠ missing CSS import: ${rel}`);
      return '';
    }
    return `\n/* <<< ${path.relative(ROOT, child)} >>> */\n${resolveImports(child, seen)}\n`;
  });
  return css;
}

export function bundleCss({
  entry = path.join(ROOT, 'style.css'),
  outFile = path.join(ROOT, 'public', 'style.css'),
} = {}) {
  const bundled = `/* bundled by scripts/bundle-css.mjs — do not edit */\n${resolveImports(entry)}`;
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, bundled);
  console.log(
    `✓ CSS bundle → ${path.relative(ROOT, outFile)} (${(bundled.length / 1024).toFixed(1)}KB)`,
  );
  return outFile;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  bundleCss();
}
