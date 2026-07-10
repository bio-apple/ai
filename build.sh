#!/usr/bin/env bash
# Astro SSG 构建入口
set -euo pipefail
cd "$(dirname "$0")"
npm run build
