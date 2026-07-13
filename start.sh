#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

PYTHON="${PYTHON:-python3}"

if [ ! -d ".venv" ]; then
  "$PYTHON" -m venv .venv
fi

# 始终用 venv 内解释器安装/更新依赖，避免系统 Python 与 venv 分裂
.venv/bin/python -m pip install -q -r requirements.txt

export PYTHONPATH="."

HOST="$(.venv/bin/python -c "import yaml; c=yaml.safe_load(open('config.yaml')); print(c['server']['host'])")"
PORT="$(.venv/bin/python -c "import yaml; c=yaml.safe_load(open('config.yaml')); print(c['server']['port'])")"

if [ ! -f "dist/index.html" ]; then
  echo "未找到 dist/index.html，先执行 ./build.sh"
  exit 1
fi

echo "启动 AI 应用指南: http://127.0.0.1:${PORT}/ai/"
echo "（根路径 / 会重定向到 /ai/，与 Astro base 一致）"
exec .venv/bin/uvicorn backend.main:app --host "$HOST" --port "$PORT" --reload
