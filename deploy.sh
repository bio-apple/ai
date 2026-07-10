#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v gh >/dev/null 2>&1; then
  echo "请先安装 GitHub CLI: brew install gh"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "请先登录 GitHub:"
  gh auth login
fi

if git remote get-url origin >/dev/null 2>&1; then
  git push -u origin main
else
  gh api user/repos -X POST -f name=ai -f description="Personal website" -f visibility=public
  git remote add origin https://github.com/bio-apple/ai.git
  git push -u origin main
fi

gh api repos/bio-apple/ai/pages -X POST -f build_type=workflow -f 'source[branch]=main' -f 'source[path]=/' 2>/dev/null \
  || gh api repos/bio-apple/ai/pages -X PUT -f build_type=workflow -f 'source[branch]=main' -f 'source[path]=/'

RUN_ID=$(gh run list --repo bio-apple/ai --workflow "Deploy GitHub Pages" --limit 1 --json databaseId --jq '.[0].databaseId' 2>/dev/null || true)
if [[ -n "${RUN_ID:-}" ]]; then
  gh run rerun "$RUN_ID" --repo bio-apple/ai --failed 2>/dev/null || true
fi

echo ""
echo "部署完成！网站地址: https://bio-apple.github.io/ai/"
