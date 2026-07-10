#!/usr/bin/env bash
# 从 data/*.json 生成静态页面
set -euo pipefail
cd "$(dirname "$0")"
python3 scripts/build_site.py
