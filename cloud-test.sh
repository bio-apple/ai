#!/usr/bin/env bash
# 云端冒烟测试：静态站 + API 健康检查
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
  echo "=== 2. 后端 API（跳过）==="
  echo "  未设置 API_URL。云端完整功能需部署后端，例如："
  echo "    API_URL=https://你的服务.onrender.com ./cloud-test.sh"
  exit 0
fi

echo ""
echo "=== 2. 测试云端后端 API ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 15 "$API_URL/")
echo "  $API_URL/ → HTTP $CODE"

STATUS=$(curl -s --connect-timeout 15 "$API_URL/api/auth/google/status")
echo "  Google OAuth: $STATUS"

RES=$(curl -s --connect-timeout 15 "$API_URL/api/resources")
echo "  社区资料 API: ${RES:0:80}..."

echo ""
echo "  ✅ 云端 API 可达。请在浏览器打开 $API_URL 测试登录与上传。"
