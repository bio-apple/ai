# 开发速查

线上：https://bio-apple.github.io/ai/ · **v3.0**  
技术栈：Astro 7 SSG + GitHub Pages（本地可选 `./start.sh`）。

按角色入口见 [README.md](./README.md)。产品改 `data/site.json`；前端改 `src/` / `css/` / `lib/`；运维改 `config/*.yaml` 与 Actions。

## 文档

| 文档                                                 | 用途                        |
| ---------------------------------------------------- | --------------------------- |
| [docs/SETUP.md](./docs/SETUP.md)                     | 环境搭建、三种预览、排障    |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)       | 系统架构                    |
| [docs/DATA-MODEL.md](./docs/DATA-MODEL.md)           | JSON / Schema               |
| [docs/FRONTEND.md](./docs/FRONTEND.md)               | 搜索、首页、新闻、视频、PWA |
| [docs/CONTENT-OPS.md](./docs/CONTENT-OPS.md)         | 日更与救急                  |
| [docs/CI-CD.md](./docs/CI-CD.md)                     | 部署、Secrets               |
| [docs/SECURITY.md](./docs/SECURITY.md)               | CSP、密钥                   |
| [docs/CLOUDFLARE-SYNC.md](./docs/CLOUDFLARE-SYNC.md) | 视频云端同步                |

## 命令

```bash
nvm use                    # Node 22，见 .nvmrc
npm ci && pip install -r requirements.txt
npm run build && ./start.sh          # http://127.0.0.1:8765/ai/
npm run quality && npm run test:unit && npm run build && DIST=dist python3 scripts/validate_ci.py
```

仅静态：`npm run build && npm run preview` → http://127.0.0.1:8766/ai/

## 改哪里

| 目标         | 改哪里                                                                                  |
| ------------ | --------------------------------------------------------------------------------------- |
| 导航 / 文案  | `data/site.json`                                                                        |
| 工具教程     | `data/tools.json` + `home_tool_categories`                                              |
| 排行榜       | `data/rankings.json` / `fetch_rankings.py`                                              |
| 开源精选     | `config/oss-fetch.yaml` → `fetch_oss_heating.py`；卡片热度条 `lib/content-display.js`   |
| 新闻主列表   | `config/news-fetch.yaml` 的 `feeds`（7×24h）                                            |
| 量子位热门   | `config/news-fetch.yaml` 的 `qbitai_hot`；按既有分类并入 `news.js` 主列表               |
| 课程         | `config/courses-fetch.yaml`                                                             |
| 日更视频榜   | `config/video-fetch.yaml` → `fetch_daily_videos.py`；展示 `SsrVideosList.astro`         |
| 视频收藏     | `videos.js` · `lib/video-preview*.js` · [CLOUDFLARE-SYNC.md](./docs/CLOUDFLARE-SYNC.md) |
| 进阶指南     | `data/site.json` 的 `guides` + `learning_paths`                                         |
| 知识版图     | `src/components/HomeAiMap.astro`（绿圈链接，黄圈图示）                                  |
| 本地部署文稿 | `content/local-deploy/*.md`（搜索与 `local/{id}.html`）                                 |
| CSP          | `config/csp.json`（`npm run build` 同步 `_headers`）                                    |

站内链接用 `src/lib/paths.ts` 的 `asset()`。推送 `main` → `pages.yml` + `ci.yml`。
