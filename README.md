# Bio AI Lab

**Bio-Apple · AI 工具导航 · 开源精选 · 实战案例 · 课程 · 热点 · 视频**

[![Website](https://img.shields.io/badge/Website-Live-2563eb?style=flat-square)](https://bio-apple.github.io/ai/)
[![Stars](https://img.shields.io/github/stars/bio-apple/ai?style=flat-square&logo=github)](https://github.com/bio-apple/ai/stargazers)
[![Deploy](https://img.shields.io/github/actions/workflow/status/bio-apple/ai/pages.yml?branch=main&style=flat-square&label=Deploy)](https://github.com/bio-apple/ai/actions/workflows/pages.yml)
[![CI](https://img.shields.io/github/actions/workflow/status/bio-apple/ai/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/bio-apple/ai/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-0d8c6d?style=flat-square)](./LICENSE)

站点：https://bio-apple.github.io/ai/

## 快速开始

```bash
git clone https://github.com/bio-apple/ai.git && cd ai
nvm use                    # Node 22，见 .nvmrc
npm ci && pip install -r requirements.txt
./build.sh && ./start.sh
```

本地预览：**http://127.0.0.1:8765/ai/**  
校验：`npm run quality && npm run build && DIST=dist python3 scripts/validate_ci.py`

## 文档

| 文档 | 说明 |
|------|------|
| [DEVELOPER.md](./DEVELOPER.md) | 开发速查与「改哪里」 |
| [docs/SETUP.md](./docs/SETUP.md) | 环境搭建与排障 |
| [docs/CONTENT-OPS.md](./docs/CONTENT-OPS.md) | 日更抓取与救急 |
| [docs/CI-CD.md](./docs/CI-CD.md) | 部署与 Secrets |
| [docs/SECURITY.md](./docs/SECURITY.md) | CSP 与密钥规范 |
| [docs/CLOUDFLARE-SYNC.md](./docs/CLOUDFLARE-SYNC.md) | 视频链接云端同步 |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | 系统架构概览 |
| [docs/FRONTEND.md](./docs/FRONTEND.md) | 搜索 / 推荐 / 视频页 |
| [docs/DATA-MODEL.md](./docs/DATA-MODEL.md) | JSON 数据约定 |

## 做什么

| 入口 | 说明 |
|------|------|
| 首页 | Hero、推荐助手、AI 简报、领域地图 |
| AI工具中心 | AICPB / LMSYS / AA 三榜 Top 10 |
| 开源精选 | Agent / MCP / Coding Agent 等方向加热 Top 3 |
| 课程 / 新闻 / 视频 | 日更内容；视频页支持粘贴链接 + Cloudflare 云端同步 |

推送 `main` → `pages.yml` 部署 Pages；日更见 [CONTENT-OPS.md](./docs/CONTENT-OPS.md)。

## License

MIT
