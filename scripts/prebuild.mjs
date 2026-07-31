#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { loadEnvLocal } from './load-env-local.mjs';
import { buildArtifacts } from './build-artifacts.mjs';
import { writeLocalDeployGuides } from './build-local-guides.mjs';
import { syncPublic } from './sync-public.mjs';
import { bundleCss } from './bundle-css.mjs';
import { syncHeadersCsp } from './csp-policy.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(ROOT, 'public');

/** GitHub Pages 不读 _redirects；写入带 /ai/ 基路径的静态跳转页 */
function writeLegacyRedirects(outDir) {
  const stubs = [
    { rel: 'labs/index.html', to: '/ai/tools/hub.html', label: 'AI 工具中心' },
    { rel: 'cases/index.html', to: '/ai/tools/hub.html', label: 'AI 工具中心' },
    { rel: 'prompts/library.html', to: '/ai/local/ollama-open-webui.html', label: '实战案例' },
    { rel: 'local/agent.html', to: '/ai/index.html#section-oss', label: '开源精选' },
  ];
  for (const stub of stubs) {
    const dest = path.join(outDir, stub.rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(
      dest,
      `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="refresh" content="0;url=${stub.to}" />
  <meta name="robots" content="noindex" />
  <link rel="canonical" href="https://bio-apple.github.io${stub.to.replace(/#.*$/, '')}" />
  <title>Redirecting…</title>
  <script>location.replace(${JSON.stringify(stub.to)})</script>
</head>
<body>
  <p>页面已迁移，正在前往 <a href="${stub.to}">${stub.label}</a>…</p>
</body>
</html>
`,
    );
  }
  console.log(`✓ legacy redirects → ${outDir}`);
}

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
writeLegacyRedirects(publicDir);
bundleCss({
  entry: path.join(ROOT, 'style.css'),
  outFile: path.join(publicDir, 'style.css'),
});
{
  const guides = writeLocalDeployGuides();
  console.log(`✓ local-deploy guides (${guides.guides.length} 篇)`);
}
buildArtifacts(publicDir);
