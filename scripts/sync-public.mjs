#!/usr/bin/env node
/** 将根目录静态资源同步到 public/，供 Astro 构建 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const COPY_DIRS = ['css', 'vendor', 'video-thumbs'];
const COPY_FILES = [
  'style.css',
  'analytics.js',
  'app.js',
  'ux.js',
  'lazy-sections.js',
  'videos.js',
  'news.js',
  'oss.js',
  'prompts.js',
  'knowledge.js',
  'recommend.js',
  'progress.js',
  'engagement.js',
  'robots.txt',
  '_headers',
  '_redirects',
  'daily-videos.json',
  'ai-news.json',
  'oss-projects.json',
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
