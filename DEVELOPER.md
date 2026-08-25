# 开发速查

线上：https://bio-apple.github.io/ai/ · **v2.0**（见 [CHANGELOG.md](./CHANGELOG.md)）  
技术栈：Astro SSG + GitHub Pages（本地可选 `./start.sh`）。

## 文档

| 文档 | 用途 |
|------|------|
| [docs/SETUP.md](./docs/SETUP.md) | 环境搭建、三种预览、排障 |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | 系统架构概览 |
| [docs/DATA-MODEL.md](./docs/DATA-MODEL.md) | JSON / Schema |
| [docs/FRONTEND.md](./docs/FRONTEND.md) | 搜索 / 推荐 / 视频页 |
| [docs/CONTENT-OPS.md](./docs/CONTENT-OPS.md) | 日更与救急 |
| [docs/CI-CD.md](./docs/CI-CD.md) | 部署、Secrets |
| [docs/SECURITY.md](./docs/SECURITY.md) | CSP、密钥 |
| [docs/CLOUDFLARE-SYNC.md](./docs/CLOUDFLARE-SYNC.md) | 视频云端同步 |

## 命令

```bash
nvm use && npm ci
npm run build && ./start.sh          # http://127.0.0.1:8765/ai/
npm run quality && npm run test:unit
DIST=dist python3 scripts/validate_ci.py
```

仅静态：`npm run build && npm run preview` → http://127.0.0.1:8766/ai/

## 改哪里

| 目标 | 改哪里 |
|------|--------|
| 导航 / 文案 | `data/site.json` |
| 工具教程 | `data/tools.json` + `home_tool_categories` |
| 对比专题 | `data/compares.json` |
| 排行榜 | `data/rankings.json` / `fetch_rankings.py` |
| 开源精选 | `config/oss-fetch.yaml` → `fetch_oss_heating.py` |
| 新闻 / 课程 | `config/news-fetch.yaml` / `config/courses-fetch.yaml` |
| 视频链接页 | `videos.js` · `lib/video-preview*.js` · [CLOUDFLARE-SYNC.md](./docs/CLOUDFLARE-SYNC.md) |
| 实战案例 | `content/local-deploy/*.md` |
| CSP | `config/csp.json`（`npm run build` 同步 `_headers`） |

站内链接用 `src/lib/paths.ts` 的 `asset()`。推送 `main` → `pages.yml` + `ci.yml`。
