#!/usr/bin/env bash
# 云端冒烟测试：静态站 + 可选本地服务
set -euo pipefail

STATIC_URL="${STATIC_URL:-https://bio-apple.github.io/ai/}"
API_URL="${API_URL:-}"

echo "=== 1. 测试 GitHub Pages 静态站 ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 15 "$STATIC_URL")
echo "  $STATIC_URL → HTTP $CODE"
if [ "$CODE" != "200" ]; then
  echo "  ❌ 静态站不可访问"
  exit 1
fi
echo "  ✅ 静态站正常"

BODY=$(curl -s --connect-timeout 15 "$STATIC_URL")
echo "$BODY" | grep -q "AI 应用指南" && echo "  ✅ 页面标题正确" || echo "  ⚠️  页面内容可能未更新"

if [ -z "$API_URL" ]; then
  echo ""
  echo "=== 2. 本地服务（跳过）==="
  echo "  未设置 API_URL。如需测试本地预览服务："
  echo "    API_URL=http://127.0.0.1:8765 ./cloud-test.sh"
  exit 0
fi

echo ""
echo "=== 2. 测试本地/云端预览服务 ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 15 "$API_URL/")
echo "  $API_URL/ → HTTP $CODE"
if [ "$CODE" = "200" ]; then
  echo "  ✅ 预览服务正常"
else
  echo "  ❌ 预览服务不可访问"
  exit 1
fi
