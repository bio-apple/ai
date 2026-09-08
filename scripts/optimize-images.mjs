#!/usr/bin/env node
/**
 * 压缩 OG 图、将 video-thumbs 转为 WebP，并回写 daily-videos.json 中的路径。
 * 用法：node scripts/optimize-images.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const THUMB_DIR = path.join(ROOT, 'video-thumbs', 'bilibili');
const OG_JPG = path.join(ROOT, 'og-image.jpg');
const OG_PNG = path.join(ROOT, 'og-image.png');
const FAVICON_SVG = path.join(ROOT, 'favicon.svg');
const DAILY = path.join(ROOT, 'daily-videos.json');

const WEBP_QUALITY = 78;
const THUMB_MAX_WIDTH = 640;
const OG_QUALITY = 82;

function walkImages(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => /\.(jpe?g|png)$/i.test(name))
    .map((name) => path.join(dir, name));
}

async function toWebp(srcPath) {
  const dest = srcPath.replace(/\.(jpe?g|png)$/i, '.webp');
  const before = fs.statSync(srcPath).size;
  try {
    await sharp(srcPath)
      .rotate()
      .resize({ width: THUMB_MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY, effort: 4 })
      .toFile(dest);
  } catch (err) {
    // 损坏 JPEG 时回退 ffmpeg（更宽容）
    const ff = spawnSync(
      'ffmpeg',
      [
        '-y',
        '-loglevel',
        'error',
        '-i',
        srcPath,
        '-vf',
        `scale='min(${THUMB_MAX_WIDTH},iw)':-2`,
        '-c:v',
        'libwebp',
        '-quality',
        String(WEBP_QUALITY),
        dest,
      ],
      { encoding: 'utf8' },
    );
    if (ff.status !== 0 || !fs.existsSync(dest) || fs.statSync(dest).size < 512) {
      console.warn(`⚠ skip corrupt image ${path.relative(ROOT, srcPath)}: ${err.message}`);
      return null;
    }
    console.warn(`⚠ sharp failed, used ffmpeg for ${path.relative(ROOT, srcPath)}`);
  }
  const after = fs.statSync(dest).size;
  if (path.resolve(srcPath) !== path.resolve(dest)) {
    fs.unlinkSync(srcPath);
  }
  return { srcPath, dest, before, after };
}

async function compressOg() {
  if (!fs.existsSync(OG_JPG)) return null;
  const before = fs.statSync(OG_JPG).size;
  const meta = await sharp(OG_JPG).metadata();
  if (meta.width === 1200 && meta.height === 630) {
    return { before, after: before };
  }
  const buf = await sharp(OG_JPG)
    .rotate()
    .resize({ width: 1200, height: 630, fit: 'cover', position: 'centre' })
    .jpeg({ quality: OG_QUALITY, mozjpeg: true })
    .toBuffer();
  fs.writeFileSync(OG_JPG, buf);
  const after = fs.statSync(OG_JPG).size;
  return { before, after };
}

async function writePwaIcons() {
  if (!fs.existsSync(FAVICON_SVG)) return [];
  const jobs = [
    [192, 'icon-192.png'],
    [512, 'icon-512.png'],
    [180, 'apple-touch-icon.png'],
  ];
  const written = [];
  for (const [size, name] of jobs) {
    const dest = path.join(ROOT, name);
    await sharp(FAVICON_SVG, { density: 384 }).resize(size, size).png().toFile(dest);
    written.push(name);
  }
  return written;
}

function rewriteDailyVideos(extMap) {
  if (!fs.existsSync(DAILY) || !extMap.size) return 0;
  let raw = fs.readFileSync(DAILY, 'utf8');
  let hits = 0;
  for (const [from, to] of extMap) {
    const re = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const next = raw.replace(re, () => {
      hits += 1;
      return to;
    });
    raw = next;
  }
  if (hits) fs.writeFileSync(DAILY, raw);
  return hits;
}

async function main() {
  const results = [];
  const extMap = new Map();

  for (const src of walkImages(THUMB_DIR)) {
    const r = await toWebp(src);
    if (!r) continue;
    results.push(r);
    const fromRel = path.relative(ROOT, r.srcPath).replace(/\\/g, '/');
    const toRel = path.relative(ROOT, r.dest).replace(/\\/g, '/');
    extMap.set(fromRel, toRel);
    console.log(
      `✓ ${fromRel} → ${toRel} (${(r.before / 1024).toFixed(0)}KB → ${(r.after / 1024).toFixed(0)}KB)`,
    );
  }

  const rewritten = rewriteDailyVideos(extMap);
  console.log(`✓ daily-videos.json 路径更新 ${rewritten} 处`);

  const og = await compressOg();
  if (og) {
    console.log(
      `✓ og-image.jpg ${(og.before / 1024).toFixed(0)}KB → ${(og.after / 1024).toFixed(0)}KB`,
    );
  }

  const icons = await writePwaIcons();
  if (icons.length) {
    console.log(`✓ PWA icons ${icons.join(', ')}`);
  }

  if (fs.existsSync(OG_PNG)) {
    fs.unlinkSync(OG_PNG);
    console.log('✓ 删除未使用的 og-image.png（约 1.6MB）');
  }
  const publicPng = path.join(ROOT, 'public', 'og-image.png');
  if (fs.existsSync(publicPng)) {
    fs.unlinkSync(publicPng);
    console.log('✓ 删除 public/og-image.png');
  }

  const saved = results.reduce((n, r) => n + (r.before - r.after), 0);
  console.log(
    `完成：${results.length} 张封面转 WebP，约节省 ${(saved / 1024 / 1024).toFixed(2)}MB`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
