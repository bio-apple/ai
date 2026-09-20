# 系统架构

纯前端静态站：`data/` JSON + 抓取脚本 → Astro SSG → GitHub Pages。  
线上：https://bio-apple.github.io/ai/

## 总览

```mermaid
flowchart TB
  DATA["data/*.json"] --> PRE["prebuild.mjs"]
  FETCH["抓取 JSON"] --> PRE
  CFG["config/*.yaml"] --> FETCH
  PRE --> ASTRO["astro build"]
  ASTRO --> DIST["dist/"]
  DIST --> GHA["pages.yml"]
  GHA --> PAGES["GitHub Pages"]
```

| 层级 | 技术                           | 职责                           |
| ---- | ------------------------------ | ------------------------------ |
| 内容 | `data/` + `scripts/fetch_*.py` | 文案、工具、新闻/OSS/课程日更  |
| 构建 | Astro 7 + prebuild             | HTML / CSS / 搜索索引 / PWA    |
| 交付 | GitHub Pages                   | 静态托管（`base: /ai/`）       |
| 交互 | 原生 JS                        | 搜索、推荐、新闻、视频页、漏斗 |
| 云端 | Cloudflare Worker              | 视频列表 KV + `/meta` 封面     |

## 构建要点

- `base: '/ai/'` · `output: 'static'` · `build.format: 'file'`
- `scripts/prebuild.mjs`：同步 public、CSP `_headers`、搜索索引、视频 slim JSON、本地部署文稿
- Layout：`HomeLayout`（首页）· `StandaloneLayout`（独立页 + 本页目录）
- PWA：`sw.js` scope `/ai/`；改版核对需强制刷新，避免旧 HTML

## 页面

| 路径                          | 作用                                                         |
| ----------------------------- | ------------------------------------------------------------ |
| `/ai/`                        | 首页                                                         |
| `/ai/tools/hub.html`          | AI 工具中心（三榜 Top 10）                                   |
| `/ai/ai-tools-ranking.html`   | 完整三榜排行（工具中心可进入）                               |
| `/ai/tools/{id}.html`         | 工具详情                                                     |
| `/ai/oss.html`                | 开源精选                                                     |
| `/ai/courses.html`            | 课程资源                                                     |
| `/ai/news/daily-ai-news.html` | 新闻热点：7×24h 资讯 + 量子位官网热门（30 天，并入既有分类） |
| `/ai/videos.html`             | AI 视频：近 1 个月每平台 Top 3 + 粘贴收藏                    |
| `/ai/guides/advanced.html`    | 进阶指南                                                     |
| `/ai/local/{id}.html`         | 本地部署文稿                                                 |

## 首页信息架构

匹配工具 → AI 简报（资讯 / 开源升温 / 编辑视频各 1 条）→ 知识版图 → 下一步（工具中心 + 开源）。  
知识版图：绿圈可点并写明这一层是什么；外围基础学科黄圈只作图示。

## 视频

两套数据：首页编辑片单（`data/home-video-picks.json`）、日更榜（`daily-videos.json` → 视频页每平台 Top 3，经关键词/拒绝表过滤）与用户粘贴收藏（`localStorage` + Cloudflare KV）。共享码见 [CLOUDFLARE-SYNC.md](./CLOUDFLARE-SYNC.md)。

## 目录

```
data/  config/  content/  src/  lib/  scripts/  workers/video-sync/  schemas/
```

日更与救急 → [CONTENT-OPS.md](./CONTENT-OPS.md)  
部署 → [CI-CD.md](./CI-CD.md)  
开发改动 → [DEVELOPER.md](../DEVELOPER.md)
