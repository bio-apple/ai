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

/** 轻量压缩：去注释与多余空白（保留字符串内空格与 !important 等）。 */
function minifyCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,>~+])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim();
}

export function bundleCss({
  entry = path.join(ROOT, 'style.css'),
  outFile = path.join(ROOT, 'public', 'style.css'),
  minify = true,
} = {}) {
  const raw = `/* bundled by scripts/bundle-css.mjs — do not edit */\n${resolveImports(entry)}`;
  const bundled = minify ? minifyCss(raw) : raw;
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, bundled);
  console.log(
    `✓ CSS bundle → ${path.relative(ROOT, outFile)} (${(bundled.length / 1024).toFixed(1)}KB${minify ? ', minified' : ''})`,
  );
  return outFile;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  bundleCss();
}
