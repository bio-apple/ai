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
  gh repo create bio-apple/ai --public --source=. --remote=origin --push --description "Personal website"
fi

gh api repos/bio-apple/ai/pages -X POST -f build_type=workflow -f source[branch]=main -f source[path]=/ 2>/dev/null \
  || gh api repos/bio-apple/ai/pages -X PUT -f build_type=workflow -f source[branch]=main -f source[path]=/

echo ""
echo "部署完成！网站地址: https://bio-apple.github.io/ai/"
