#!/usr/bin/env bash
# CI：创建 KV（若不存在）并部署 video-sync Worker，输出 Workers URL
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/workers/video-sync"

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo "CLOUDFLARE_API_TOKEN 未设置，跳过 Worker 部署" >&2
  exit 0
fi

KV_ID="${CLOUDFLARE_KV_NAMESPACE_ID:-}"
if [ -z "$KV_ID" ]; then
  KV_ID="$(npx wrangler kv namespace list 2>/dev/null | node -e "
    let d='';
    process.stdin.on('data', (c) => (d += c));
    process.stdin.on('end', () => {
      try {
        const rows = JSON.parse(d || '[]');
        const hit = rows.find((r) => r.title === 'SYNC_KV' || r.title === 'bioai-video-sync-SYNC_KV');
        process.stdout.write(hit?.id || '');
      } catch {
        process.stdout.write('');
      }
    });
  ")"
fi

if [ -z "$KV_ID" ]; then
  echo "创建 KV namespace SYNC_KV…"
  KV_ID="$(npx wrangler kv namespace create SYNC_KV 2>&1 | grep -oE '[a-f0-9]{32}' | head -1)"
fi

if [ -z "$KV_ID" ]; then
  echo "无法获取 KV namespace id" >&2
  exit 1
fi

echo "使用 KV id: $KV_ID"
cp wrangler.toml wrangler.deploy.toml
if [[ "$OSTYPE" == "darwin"* ]]; then
  sed -i '' "s/REPLACE_WITH_KV_NAMESPACE_ID/${KV_ID}/" wrangler.deploy.toml
else
  sed -i "s/REPLACE_WITH_KV_NAMESPACE_ID/${KV_ID}/" wrangler.deploy.toml
fi

DEPLOY_LOG="$(mktemp)"
npx wrangler deploy --config wrangler.deploy.toml 2>&1 | tee "$DEPLOY_LOG"
rm -f wrangler.deploy.toml

API_URL="$(grep -oE 'https://[a-zA-Z0-9._-]+\.workers\.dev' "$DEPLOY_LOG" | head -1)"
if [ -z "$API_URL" ]; then
  # wrangler 3+ 有时只输出 Published bioai-video-sync
  API_URL="https://bioai-video-sync.${CLOUDFLARE_ACCOUNT_SUBDOMAIN:-unknown}.workers.dev"
fi

echo "VIDEO_SYNC_API_URL=$API_URL"
if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "api_url=$API_URL" >> "$GITHUB_OUTPUT"
fi
