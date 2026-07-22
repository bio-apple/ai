# 开发说明

线上：https://bio-apple.github.io/ai/  
栈：Astro 5 SSG + GitHub Pages（本地可选 FastAPI 预览 `./start.sh`）。

**架构与数据**：[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) · [docs/DATA-MODEL.md](./docs/DATA-MODEL.md)  
**前端能力**：[docs/FRONTEND.md](./docs/FRONTEND.md) · **内容漏斗**：[docs/CONTENT-FUNNEL.md](./docs/CONTENT-FUNNEL.md)  
**环境搭建**：[docs/SETUP.md](./docs/SETUP.md)（Node 22 / Python 3.12、本地预览、故障排除）

## 目录要点

```
data/                 # 内容源（JSON）
src/pages|components  # Astro 页面
css/ + *.js           # 样式与运行时脚本（courses.js / news.js / videos.js / funnel.js …）
lib/                  # 共享前端工具（见下）
config/               # 抓取配置（courses / news / video）+ csp.json
scripts/              # 构建 / 抓取 / 校验
schemas/              # JSON Schema（CI 门禁）
.github/workflows/    # CI、Pages、daily-refresh 串行日更、单频道手动救急
dist/                 # 构建产物（不提交）
```

**`lib/` 清单：**

| 文件              | 作用                                                       |
| ----------------- | ---------------------------------------------------------- |
| `fetch-json.js`   | JSON 拉取（重试 / 超时 / 缓存）、`escapeHtml`、错误重试 UI |
| `virtual-list.js` | 长列表可视区渲染 + `mapInChunks`                           |
| `link-guard.js`   | 外链 `noreferrer`、图片兜底、GitHub 仓库 404 探测弹窗      |

## 数据文件

| 文件                   | 来源                              | 刷新       |
| ---------------------- | --------------------------------- | ---------- |
| `data/site.json` 等    | 手工维护                          | 随代码发布 |
| `daily-videos.json`    | `fetch_daily_videos.py`           | 每日       |
| `ai-news.json`         | `fetch_ai_news.py`                | 每日       |
| `local-deploy.json`    | 手工维护（`data/`）               | 随代码发布 |
| `ai-courses.json`      | `fetch_ai_courses.py`             | 每日       |
| `data/rankings.json`   | `fetch_rankings.py`               | 每日       |
| `search-index.json`    | `build-artifacts.mjs`（prebuild） | 每次构建   |
| `recommend-rules.json` | `build-artifacts.mjs`             | 每次构建   |

`prebuild` 会把根目录运行时 JSON 与静态 JS/CSS 同步到 `public/`，再经 Astro 打进 `dist/`。

**搜索索引来源**（`build-artifacts.mjs` → 约 150 条）：`tools.json`（→ `tools/{id}.html`）、`site.json`（导航/场景/对比入口，**不含**逐工具 hub-compare 重复项）、`ai-news.json`、`local-deploy.json`、`ai-courses.json`、`daily-videos.json`、排行榜模型名。联想词：`site.hero.search_suggestions`。校验：`validate_ci.py search`。

**推荐规则**：`ai_picker.options[].examples`（现实实例）随 `recommend-rules.json` 透传。

**前端共享层**：见上表 `lib/*`；懒加载频道由 `lazy-sections.js` 保证先加载 `lib/`。Layout 默认加载 `link-guard.js`、`funnel.js` → `analytics.js`。领域地图（`#home-ai-map`）、面包屑、搜索交互见 [docs/FRONTEND.md](./docs/FRONTEND.md)。

**性能**：视频 Tab 用 `daily-videos.latest.json`（近 2 批）；视频 / 榜单 / GitHub 热门接入虚拟列表；动态区块 `min-height` 降 CLS；`style.css` 带内容哈希 `?v=`；领域地图为原生 HTML（`#home-ai-map`），随主题与窄屏自适应。

`prebuild` 同步静态资源时包含 `_headers`（安全响应头与 JSON 缓存策略）。

## 课程资源

**产品定义**（`config/courses-fetch.yaml`）：

- 仅收录 **免费** 课程
- 五条路线：`入门` → `机器学习` → `深度学习` → `LLM 大模型` → `AI Agent`
- **`required_only: true`**：只写入 `required` + `hubs`，不抓 Coursera / HF / YouTube 补充课
- 斯坦福课链至 **Stanford Online YouTube 播放列表**（标题标注最新已公开学年）

**必推荐 URL**（CI 校验）：

- Microsoft Generative AI for Beginners
- Google Machine Learning Crash Course
- Stanford YouTube：CS230（2025）、CS231n（2025）、CS224n（2024）、CS336（2026）；卡片同时提供 `official_url` 官网

**去重规则**（抓取 + 前端 + CI）：

| 规则         | 说明                                                 |
| ------------ | ---------------------------------------------------- |
| URL / 标题   | 全局唯一                                             |
| 合集 vs 单课 | `prefer_hub_over_children`：有合集入口则抑制下属单课 |
| 每路线限额   | ≤ 5 门                                               |
| 平台×路线    | 非必学每平台每路线 ≤ 2                               |
| 标题近重复   | 同路线 Jaccard ≥ 0.5 合并                            |
| YouTube      | 须匹配 AI 关键词                                     |

前端：`courses.js` 按 `track_order` 分组展示，筛选「路线 / 平台」。  
Schema：`schemas/ai-courses.schema.json` · 校验：`validate_ci.py courses`

```bash
python3 scripts/fetch_ai_courses.py
DIST=dist python3 scripts/validate_ci.py courses
```

## 新闻

- 新闻去重：`scripts/news_dedupe.py`（标题 + URL，保留最新 `published_at`）

## 本地开发

> 完整环境搭建、三种预览模式、端口占用与依赖故障排除见 **[docs/SETUP.md](./docs/SETUP.md)**。  
> 数据抓取、定时刷新与内容运营见 **[docs/CONTENT-OPS.md](./docs/CONTENT-OPS.md)**。

### 环境版本

| 组件         | 版本     | 说明                                                |
| ------------ | -------- | --------------------------------------------------- |
| Node.js      | **22.x** | `.nvmrc`；`package.json` → `engines.node: >=22 <26` |
| Python       | **3.12** | 与 CI 一致；`./start.sh` 自动创建 `.venv`           |
| 本地预览端口 | **8765** | `config.yaml`；可用 `PORT=8770 ./start.sh` 覆盖     |

### 标准流程

```bash
nvm use                                  # 或 fnm use
npm ci
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt   # 可选；start.sh 也会做
cp .env.local.example .env.local         # 可选：本地环境变量（勿提交）
npm run build                            # prebuild → Astro → dist/
./start.sh                               # http://127.0.0.1:8765/ai/
DIST=dist python3 scripts/validate_ci.py
npm run quality && npm run test:unit
```

### 预览模式速查

| 目的                          | 命令                               | 地址                      |
| ----------------------------- | ---------------------------------- | ------------------------- |
| 完整预览（静态 + `/api/ask`） | `./build.sh && ./start.sh`         | http://127.0.0.1:8765/ai/ |
| 改 Astro 页面（HMR）          | `npm run dev`                      | 终端提示（通常 `:4321`）  |
| 仅验证 dist（无 Python）      | `npm run build && npm run preview` | http://127.0.0.1:8766/ai/ |

**安全**：禁止硬编码 LLM API Key；本地用 `.env.local`，用户密钥仅存浏览器本地存储并直连官方 API。详见 [docs/SECURITY.md](./docs/SECURITY.md)。

手动刷新运行时数据：

```bash
python3 scripts/fetch_ai_news.py
python3 scripts/fetch_daily_videos.py
python3 scripts/fetch_ai_courses.py
python3 scripts/fetch_rankings.py   # AICPB / LMSYS Elo / AA Intelligence Index
cp ai-courses.json ai-news.json public/   # 本地预览需同步到 public/
npm run build
```

## 构建与部署

1. `prebuild`（`scripts/prebuild.mjs`）：清空 `public/` → 同步静态资源 → 打包 CSS → 生成 search / recommend / analytics
2. `astro build` → `dist/`
3. push `main`：`.github/workflows/ci.yml` 校验 → `deploy.yml` 部署（见 [docs/CI-CD.md](./docs/CI-CD.md)）

分析 Secrets（可选）：`UMAMI_*` · `CLOUDFLARE_BEACON_TOKEN` · `GA_MEASUREMENT_ID` / `CLARITY_PROJECT_ID`  
本地同名变量可写入 `.env.local`（prebuild 自动加载）；**禁止**将 LLM 服务商 API Key 写入仓库。

## 定时任务（北京时间）

详见 **[docs/CONTENT-OPS.md](./docs/CONTENT-OPS.md)**（含各 `fetch_*.py` 配置说明与手动刷新步骤）。

| 工作流                | 内容（北京时间）                                                |
| --------------------- | --------------------------------------------------------------- |
| `daily-refresh.yml`   | **00:00 串行日更**：视频 → 课程 → 排行 → 推送/部署 → 死链       |
| `daily-news.yml`      | **07:30 / 10:00 / 12:00 / 20:00** 新闻热点多档刷新并派发 Deploy |
| `daily-*.yml`（单频） | 仅手动 `workflow_dispatch`（救急单频道重跑）                    |
| `site-health.yml`     | 线上探针 08:00 / 20:00                                          |

行为分析（内容漏斗）见 **[docs/CONTENT-FUNNEL.md](./docs/CONTENT-FUNNEL.md)**。

失败处置见 [docs/OPS-RUNBOOK.md](./docs/OPS-RUNBOOK.md)。

## 常见改动

- **新工具**：`data/tools.json` + `site.home_tool_categories` / `compare_table` + `tool-relations.json`；若进对比表，同步 `src/lib/hub.ts` 的 `HUB_FEATURED_TOOLS` 名→id 映射
- **即梦等新教程页**：在 `tools.json` 增加条目即可生成 `tools/{id}.html`
- **推荐现实实例**：`site.ai_picker.options[].examples`（数组文案）
- **新必学课程**：`config/courses-fetch.yaml` → `required` 或 `hubs`，并更新 `validate_ci.py` 中 `REQUIRED_COURSE_URLS`
- **调整路线**：改 `track_order` / `track_keywords`，重跑 `fetch_ai_courses.py`
- **工具中心对比行**：`site.compare_table`（构建时自动链到教程）
- **AI 领域地图**：改 `HomeAiMap.astro` / `css/home.css` 中 `.ai-map*` 后 `npm run build`（展示于首页 `#home-ai-map`）
- **排行榜**：`data/rankings.json`（00:00 日更；也可手动 `fetch_rankings.py`）

站内链接用 `src/lib/paths.ts` 的 `asset()`（base `/ai/`）。
