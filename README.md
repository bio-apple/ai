# AI 导航

**v3.0** · Bio-Apple · AI 工具中心 · 开源精选 · 课程 · 热点 · 视频

[![Version](https://img.shields.io/badge/version-3.0.0-0d8c6d?style=flat-square)](https://bio-apple.github.io/ai/)
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

本地预览：**http://127.0.0.1:8765/ai/**（`./start.sh`，带本地 API）  
仅静态：`npm run preview` → **http://127.0.0.1:8766/ai/**  
校验：`npm run quality && npm run test:unit && npm run build && DIST=dist python3 scripts/validate_ci.py`

## 按角色看哪里

| 角色            | 先看                                                                  | 改哪里                                 |
| --------------- | --------------------------------------------------------------------- | -------------------------------------- |
| 产品 / 文案     | 下表「入口」；`data/site.json` 的 `meta` / `nav` / `hero`             | 导航、TDK、推荐场景                    |
| 架构            | [ARCHITECTURE.md](./docs/ARCHITECTURE.md)                             | 页面、构建链路、PWA                    |
| 前端            | [FRONTEND.md](./docs/FRONTEND.md)                                     | `src/components`、`css/`、`lib/*.js`   |
| 运维 / 日更     | [CONTENT-OPS.md](./docs/CONTENT-OPS.md) · [CI-CD.md](./docs/CI-CD.md) | `config/*.yaml`、Actions Secrets       |
| 测试 / QA       | `tests/unit` · `tests/e2e/smoke.spec.js`                              | 夹具单测、页面冒烟                     |
| 安全            | [SECURITY.md](./docs/SECURITY.md)                                     | `config/csp.json`、勿提交 `.env.local` |
| 数据 / 内容结构 | [DATA-MODEL.md](./docs/DATA-MODEL.md)                                 | `data/*.json`、根目录日更 JSON         |

开发命令与文件地图：[DEVELOPER.md](./DEVELOPER.md)

## 文档

| 文档                                                 | 说明                        |
| ---------------------------------------------------- | --------------------------- |
| [DEVELOPER.md](./DEVELOPER.md)                       | 开发速查与「改哪里」        |
| [docs/SETUP.md](./docs/SETUP.md)                     | 环境搭建与排障              |
| [docs/CONTENT-OPS.md](./docs/CONTENT-OPS.md)         | 日更抓取与救急              |
| [docs/CI-CD.md](./docs/CI-CD.md)                     | 部署与 Secrets              |
| [docs/SECURITY.md](./docs/SECURITY.md)               | CSP 与密钥规范              |
| [docs/CLOUDFLARE-SYNC.md](./docs/CLOUDFLARE-SYNC.md) | 视频链接云端同步            |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)       | 系统架构                    |
| [docs/FRONTEND.md](./docs/FRONTEND.md)               | 搜索、首页、新闻、视频、PWA |
| [docs/DATA-MODEL.md](./docs/DATA-MODEL.md)           | JSON 数据约定               |

## 做什么

| 入口        | 说明                                                                             |
| ----------- | -------------------------------------------------------------------------------- |
| 首页        | 匹配助手、AI 简报、知识版图（绿圈可点，黄圈只作图示）、下一步（工具中心 + 开源） |
| AI 工具中心 | AICPB / LMSYS / AA 三榜 Top 10；工具详情                                         |
| 开源精选    | Agent / MCP / Coding Agent 等方向加热 Top 3                                      |
| 课程资源    | 日更免费课程                                                                     |
| 新闻热点    | 滚动 7×24 小时资讯；量子位官网「热门文章」（近 30 天）按既有分类并入             |
| AI 视频     | 近 1 个月 YouTube / B 站各播放量 Top 3；粘贴收藏（Cloudflare 同步）              |

顶栏入口见 `data/site.json` 的 `nav.menu`。进阶指南在 `guides/advanced.html`（搜索与推荐路径可达，不在顶栏）。本地部署文稿在 `local/{id}.html`。

推送 `main` → `pages.yml` 部署 Pages；日更见 [CONTENT-OPS.md](./docs/CONTENT-OPS.md)。

## License

MIT
