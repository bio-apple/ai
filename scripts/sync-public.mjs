#!/usr/bin/env node
/** 将根目录静态资源同步到 public/，供 Astro 构建 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// css/ 仅作 bundle-css 源；页面只加载打包后的 style.css，勿整目录拷贝
const COPY_DIRS = ['vendor', 'video-thumbs', 'lib'];
const COPY_FILES = [
  'funnel.js',
  'analytics.js',
  'app.js',
  'ux.js',
  'lazy-sections.js',
  'videos.js',
  'news.js',
  'courses.js',
  'knowledge.js',
  'recommend.js',
  'progress.js',
  'engagement.js',
  'ranking-tabs.js',
  'robots.txt',
  '_headers',
  '_redirects',
  'daily-videos.json',
  'ai-news.json',
  'ai-courses.json',
  'favicon.svg',
  'og-image.jpg',
];

function copyRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyRecursive(s, d);
    else fs.copyFileSync(s, d);
  }
}

export function syncPublic(outDir = path.join(ROOT, 'public')) {
  // 清空后再同步，避免历史产物（整包 css/、已废弃 JSON）残留进 dist
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  for (const dir of COPY_DIRS) {
    const src = path.join(ROOT, dir);
    if (fs.existsSync(src)) copyRecursive(src, path.join(outDir, dir));
  }
  const wellKnown = path.join(ROOT, 'well-known');
  if (fs.existsSync(wellKnown)) {
    copyRecursive(wellKnown, path.join(outDir, '.well-known'));
  }
  for (const file of COPY_FILES) {
    const src = path.join(ROOT, file);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(outDir, file));
  }
  console.log(`✓ static assets → ${outDir}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  syncPublic(process.argv[2] || path.join(ROOT, 'public'));
}
