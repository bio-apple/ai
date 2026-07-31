#!/usr/bin/env node
/** 轻量 CSS/JS 压缩：去除注释与多余空白，无外部依赖 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function minifyCss(content) {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, '')          // 去除 /* ... */ 注释
    .replace(/\n\s*\n/g, '\n')                 // 合并空行
    .replace(/[ \t]*\n[ \t]*/g, '\n')          // 行首尾空白
    .replace(/;\s*/g, ';')                     // 分号后空白
    .replace(/{\s*/g, '{')                     // { 后空白
    .replace(/}\s*/g, '}')                     // } 后空白（保留选择器间的 } 换行）
    .replace(/,\s*/g, ',')                     // 逗号后空白
    .replace(/:\s*/g, ':')                     // 冒号后空白（保留属性值可读性）
    .replace(/;\}/g, '}')                      // 最后一个分号
    .replace(/}\n/g, '}\n')                    // 保留规则间换行
    .trim();
}

function minifyJs(content) {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, '')          // 块注释
    .replace(/\/\/[^\n]*/g, '')                // 行注释
    .replace(/\n\s*\n/g, '\n')                 // 合并空行
    .trim();
}

function minifyFilesInDir(dir, ext, minifier) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!entry.name.startsWith('.')) minifyFilesInDir(full, ext, minifier);
    } else if (entry.name.endsWith(ext)) {
      const raw = fs.readFileSync(full, 'utf-8');
      const min = minifier(raw);
      if (min.length < raw.length) {
        fs.writeFileSync(full, min, 'utf-8');
      }
    }
  }
}

export function minifyPublicAssets(dir = path.join(ROOT, 'public')) {
  const cssDir = path.join(dir, 'css');
  let cssTotal = 0;
  let cssSaved = 0;

  if (fs.existsSync(cssDir)) {
    for (const f of fs.readdirSync(cssDir)) {
      if (!f.endsWith('.css')) continue;
      const fp = path.join(cssDir, f);
      const raw = fs.readFileSync(fp, 'utf-8');
      const min = minifyCss(raw);
      cssTotal += raw.length;
      cssSaved += raw.length - min.length;
      fs.writeFileSync(fp, min, 'utf-8');
    }
  }

  // 根级 style.css
  const styleCss = path.join(dir, 'style.css');
  if (fs.existsSync(styleCss)) {
    const raw = fs.readFileSync(styleCss, 'utf-8');
    const min = minifyCss(raw);
    cssTotal += raw.length;
    cssSaved += raw.length - min.length;
    fs.writeFileSync(styleCss, min, 'utf-8');
  }

  if (cssTotal > 0) {
    console.log(`✓ CSS minified: ${(cssTotal / 1024).toFixed(1)} KB → ${((cssTotal - cssSaved) / 1024).toFixed(1)} KB (${((cssSaved / cssTotal) * 100).toFixed(1)}% saved)`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  minifyPublicAssets(process.argv[2] || path.join(ROOT, 'public'));
}
