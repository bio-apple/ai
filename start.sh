#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d ".venv" ]; then
  python3 -m venv .venv
  .venv/bin/pip install -r requirements.txt
fi

export PYTHONPATH="."

HOST=$(python3 -c "import yaml; c=yaml.safe_load(open('config.yaml')); print(c['server']['host'])")
PORT=$(python3 -c "import yaml; c=yaml.safe_load(open('config.yaml')); print(c['server']['port'])")

echo "启动 AI 工具指南: http://127.0.0.1:${PORT}"
echo "  - 用户注册/登录与资料上传需通过此服务访问"
exec .venv/bin/uvicorn backend.main:app --host "$HOST" --port "$PORT" --reload
