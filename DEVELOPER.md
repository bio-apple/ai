# 开发速查

线上：https://bio-apple.github.io/ai/  
技术栈：Astro 5 SSG + GitHub Pages（本地可选 `./start.sh` 预览 FastAPI）。

## 文档导航

| 文档                                           | 用途                              |
| ---------------------------------------------- | --------------------------------- |
| [docs/SETUP.md](./docs/SETUP.md)               | 环境搭建、三种预览模式、排错      |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | 系统架构、构建流水线、数据流      |
| [docs/DATA-MODEL.md](./docs/DATA-MODEL.md)     | JSON 字段、Schema、交叉引用       |
| [docs/FRONTEND.md](./docs/FRONTEND.md)         | 搜索 / 推荐 / 虚拟列表 / 漏斗埋点 |
| [docs/CONTENT-OPS.md](./docs/CONTENT-OPS.md)   | 内容运营、日更抓取、故障救急      |
| [docs/CI-CD.md](./docs/CI-CD.md)               | CI/CD、Deploy、Secrets            |
| [docs/SEO.md](./docs/SEO.md)                   | TDK / OG / JSON-LD                |
| [docs/SECURITY.md](./docs/SECURITY.md)         | CSP、gitleaks、API Key 规范       |

## 快速命令

```bash
nvm use && npm ci
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt   # 可选；start.sh 会自动创建
npm run build && ./start.sh          # http://127.0.0.1:8765/ai/
DIST=dist python3 scripts/validate_ci.py
npm run quality && npm run test:unit && npm run test:e2e
```

仅静态预览：`npm run build && npm run preview` → http://127.0.0.1:8766/ai/

手动刷新运行时数据后需 `npm run build`（prebuild 同步 JSON 到 `public/`）：

```bash
python3 scripts/fetch_ai_news.py
python3 scripts/fetch_daily_videos.py
python3 scripts/fetch_ai_courses.py
python3 scripts/fetch_rankings.py
```

## 目录要点

```
data/                 # 手工内容源（site / tools / local-deploy …）
src/pages|components  # Astro 页面与组件
css/ + *.js           # 样式与运行时（courses / news / videos / funnel …）
lib/                  # fetch-json / virtual-list / link-guard
config/               # 抓取 YAML + csp.json
scripts/              # prebuild / 抓取 / validate_ci
schemas/              # JSON Schema（CI 门禁）
dist/                 # 构建产物（不提交）
```

## 常见改动

| 目标           | 改哪里                                                                                             |
| -------------- | -------------------------------------------------------------------------------------------------- |
| 导航 / 文案    | `data/site.json`                                                                                   |
| 新工具教程     | `data/tools.json` + `site.home_tool_categories` / `compare_table` + `tool-relations.json`          |
| 工具中心对比行 | `site.compare_table`（`src/lib/hub.ts` 映射名→id）                                                 |
| 推荐现实实例   | `site.ai_picker.options[].examples`                                                                |
| 本地部署条目   | `data/local-deploy.json`                                                                           |
| 必学课程       | `config/courses-fetch.yaml` → `required` / `hubs`；更新 `validate_ci.py` 中 `REQUIRED_COURSE_URLS` |
| 课程路线       | `track_order` / `track_keywords` → 重跑 `fetch_ai_courses.py`                                      |
| AI 领域地图    | `HomeAiMap.astro` / `css/home.css`（`#home-ai-map`）                                               |
| 排行榜         | `data/rankings.json` 或 `fetch_rankings.py`                                                        |
| 新闻 / 视频源  | `config/news-fetch.yaml` / `config/video-fetch.yaml`                                               |

站内链接统一用 `src/lib/paths.ts` 的 `asset()`（base `/ai/`）。

推送 `main` → Actions 自动 Lint / Build / Deploy。日更与救急见 [docs/CONTENT-OPS.md](./docs/CONTENT-OPS.md)。
