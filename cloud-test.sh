#!/usr/bin/env bash
# 云端冒烟测试：静态站可访问性 + 内容新鲜度（可调用 check_site_health.py）
set -euo pipefail
cd "$(dirname "$0")"

STATIC_URL="${STATIC_URL:-https://bio-apple.github.io/ai/}"
API_URL="${API_URL:-}"
SITE_BASE="${SITE_BASE:-${STATIC_URL%/}}"

echo "=== 1. 测试 GitHub Pages 静态站 ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 15 "$STATIC_URL")
echo "  $STATIC_URL → HTTP $CODE"
if [ "$CODE" != "200" ]; then
  echo "  ❌ 静态站不可访问"
  exit 1
fi
echo "  ✅ 静态站正常"

BODY=$(curl -s --connect-timeout 15 "$STATIC_URL")
if echo "$BODY" | grep -q "Bio AI Lab"; then
  echo "  ✅ 页面含 Bio AI Lab"
else
  echo "  ⚠️  页面内容可能未更新"
fi

echo ""
echo "=== 2. 内容新鲜度探针 ==="
SITE_BASE="$SITE_BASE" python3 scripts/check_site_health.py

if [ -z "$API_URL" ]; then
  echo ""
  echo "=== 3. 本地服务（跳过）==="
  echo "  未设置 API_URL。如需测试本地预览："
  echo "    API_URL=http://127.0.0.1:8765 ./cloud-test.sh"
  exit 0
fi

echo ""
echo "=== 3. 测试本地/云端预览服务 ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 15 "$API_URL/ai/")
echo "  $API_URL/ai/ → HTTP $CODE"
if [ "$CODE" = "200" ]; then
  echo "  ✅ /ai/ 预览正常"
else
  echo "  ❌ /ai/ 不可访问"
  exit 1
fi
