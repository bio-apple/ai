#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { loadEnvLocal } from './load-env-local.mjs';
import { buildArtifacts } from './build-artifacts.mjs';
import { syncPublic } from './sync-public.mjs';
import { bundleCss } from './bundle-css.mjs';
import { syncHeadersCsp } from './csp-policy.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(ROOT, 'public');

loadEnvLocal(ROOT);

// 构建前把残留 JPG/PNG 封面压成 WebP，避免 dist 体积回潮
const optimize = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'optimize-images.mjs')], {
  cwd: ROOT,
  stdio: 'inherit',
});
if (optimize.status !== 0) {
  console.warn('⚠ optimize-images 未完全成功，继续构建（已有 webp 仍可部署）');
}

syncHeadersCsp(path.join(ROOT, '_headers'));
syncPublic(publicDir);
bundleCss({
  entry: path.join(ROOT, 'style.css'),
  outFile: path.join(publicDir, 'style.css'),
});
buildArtifacts(publicDir);
