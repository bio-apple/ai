#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

CREDS=$(printf 'protocol=https\nhost=github.com\n\n' | git credential fill)
USER=$(printf '%s\n' "$CREDS" | awk -F= '/^username=/{print $2}')
TOKEN=$(printf '%s\n' "$CREDS" | awk -F= '/^password=/{print $2}')

if [[ -z "${TOKEN:-}" ]]; then
  echo "未找到 GitHub 凭据，请先配置 git 登录信息"
  exit 1
fi

export GH_TOKEN="$TOKEN"

if ! gh api repos/bio-apple/ai --silent 2>/dev/null; then
  gh api orgs/bio-apple/repos -X POST \
    -f name=ai \
    -f description='Personal website' \
    -f visibility=public \
    -f has_issues=false \
    -f has_projects=false \
    -f has_wiki=false
  echo "已创建仓库 bio-apple/ai"
else
  echo "仓库 bio-apple/ai 已存在"
fi

if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "https://github.com/bio-apple/ai.git"
else
  git remote add origin "https://github.com/bio-apple/ai.git"
fi

git push -u origin main

gh api repos/bio-apple/ai/pages -X POST \
  -f build_type=workflow \
  -f source[branch]=main \
  -f source[path]=/ 2>/dev/null \
  || gh api repos/bio-apple/ai/pages -X PUT \
    -f build_type=workflow \
    -f source[branch]=main \
    -f source[path]=/

echo ""
echo "部署完成！网站地址: https://bio-apple.github.io/ai/"
