# Bio AI Lab — 开发者文档

本文档面向维护与二次开发本项目的开发者，说明**当前线上实现**（1.x）的架构、目录结构、数据格式、构建流程、自动化与常见改动方式。

- **线上地址**：https://bio-apple.github.io/ai/
- **仓库**：https://github.com/bio-apple/ai
- **类型**：数据驱动静态站（Astro SSG）+ 可选本地 FastAPI 预览 + GitHub Actions 自动化
- **2.0 产品愿景与目标架构**：[docs/VISION-2.0.md](./docs/VISION-2.0.md)（Roadmap，非当前生产栈）

---

## 目录

1. [架构概览](#架构概览)
2. [技术栈](#技术栈)
3. [目录结构](#目录结构)
4. [构建流程（Astro SSG）](#构建流程astro-ssg)
5. [数据格式](#数据格式)
6. [前端设计](#前端设计)
7. [本地开发](#本地开发)
8. [每日视频流水线](#每日视频流水线)
9. [每周新闻与开源 Star 流水线](#每周新闻与开源-star-流水线)
10. [CI/CD 与部署](#cicd-与部署)
11. [内容维护指南](#内容维护指南)
12. [配置参考](#配置参考)
13. [故障排查](#故障排查)

---

## 架构概览

```
┌──────────────────────────────────────────────────────────────────────┐
│                        GitHub 仓库 (main)                             │
├──────────────────────────────────────────────────────────────────────┤
│  【内容源】data/*.json                                                │
│  【SSG 源】src/pages · src/components · src/layouts (Astro)           │
│  【运行时 JSON】daily-videos.json · ai-news.json · oss-projects.json  │
│  【构建产物】dist/（CI 生成，部署到 Pages，不提交仓库）                  │
│  【prebuild】public/（从根目录 css/js/json 同步，gitignore）           │
└───────────────┬────────────────────────────┬────────────────────────┘
                │ push                         │ cron
                ▼                              ▼
     ┌────────────────────┐         ┌──────────────────────────┐
     │ npm run build      │         │ daily-videos.yml（每日）   │
     │ → dist/ → Pages    │         │ weekly-news.yml（每周）    │
     └────────────────────┘         │ → commit JSON 到仓库根目录 │
                                      └──────────────────────────┘
```

**设计原则**

- **内容源**在 `data/*.json`；**页面模板**在 `src/`（Astro 组件化）。
- `npm run build`（`prebuild` → `astro build`）生成 `dist/`，含首页、工具页、Labs、工具中心等 HTML + JSON 索引。
- 10 个 AI 工具详情页由 `src/pages/tools/[id].astro` + `getStaticPaths` **自动生成**。
- 生产环境以 **GitHub Pages** 部署 `dist/`；`backend/` 本地预览挂载 **`/ai/`**（与 Astro `base` 一致），`/` 重定向到 `/ai/`。
- **每日视频**通过 `daily-videos.json` + `daily-videos.yml` 定时写入（六类推荐）。
- **每周新闻**与 **GitHub Stars** 通过 `weekly-news.yml` 定时刷新 `ai-news.json` 与 `oss-projects.json`。
- 部署前必须通过 **Pages 校验**（`validate_ci.py`）；完整 CI 另含 FastAPI smoke 与 Playwright E2E（E2E **不挡** Pages）。
- 站内链接与静态资源统一走 **`src/lib/paths.ts`**（`/ai/...`）；`validate_ci.py links` 会解析 `/ai/` 绝对路径并拒绝逃出 `dist/` 的相对路径。

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 内容源 | JSON（`data/`） |
| 构建 | **Astro 5** SSG + `scripts/build-artifacts.mjs` |
| 页面 | Astro 组件（`src/pages` · `src/components`） |
| 样式 | 原生 CSS 模块化（`css/*.css` + `style.css` 入口） |
| 交互 | 原生 JavaScript（无框架） |
| 搜索 | `search-index.json`（构建时自动生成）+ Fuse.js |
| 知识库 | `knowledge.js`（客户端检索）+ `/api/ask`（FastAPI BM25） |
| 分析 | GA4 + Microsoft Clarity（`data/analytics.json`） |
| 视频 | `daily-videos.json` + `videos.js`（Promise 缓存） |
| 新闻 | `ai-news.json` + `news.js`（每周更新） |
| 开源精选 | `oss-projects.json` + `oss.js`（每周刷新 Star） |
| 视频抓取 | Python 3.12 + [yt-dlp](https://github.com/yt-dlp/yt-dlp) |
| 新闻抓取 | Python 3.12 + RSS / HTML 抓取 / GitHub API |
| 校验 | jsonschema + BeautifulSoup + [Playwright](https://playwright.dev/) |
| 本地服务 | FastAPI + Uvicorn（可选） |
| 部署 | GitHub Pages + GitHub Actions |

---

## 目录结构

```
ai/
├── data/                       # ★ 内容源（版本控制）
│   ├── site.json               # 站点配置、导航、排行、对比表
│   ├── tools.json · cases.json · compares.json
│   └── oss-projects.json       # GitHub Stars 开源精选（Star 每周刷新）
├── src/                        # ★ Astro SSG 源
│   ├── pages/                  # 路由（含 tools/[id].astro 自动生成 10 页）
│   ├── components/             # Nav、ToolSection、CasesSection…
│   ├── layouts/                # HomeLayout · StandaloneLayout
│   └── lib/                    # data.ts · schema.ts
├── config/
│   ├── video-fetch.yaml        # 六类视频抓取配置
│   └── news-fetch.yaml         # 每周新闻 RSS / 关注源配置
├── public/                     # prebuild 同步（gitignore）
├── dist/                       # Astro 构建产物（gitignore，CI 部署）
├── scripts/
│   ├── prebuild.mjs            # sync-public + build-artifacts
│   ├── sync-public.mjs         # css/js/json → public/
│   ├── build-artifacts.mjs     # prompts/search-index/analytics-config
│   ├── fetch_daily_videos.py   # 每日六类视频抓取
│   ├── fetch_ai_news.py        # 每周新闻抓取
│   ├── fetch_oss_stars.py      # 刷新 oss-projects Star 数
│   └── validate_ci.py          # 校验 dist/
├── daily-videos.json           # 每日视频数据（Actions 写入）
├── ai-news.json                # 每周新闻数据（Actions 写入）
├── oss-projects.json           # 开源精选运行时副本（与 data/ 同步）
├── oss.js · news.js · videos.js
├── .github/workflows/
│   ├── ci.yml · pages.yml
│   ├── daily-videos.yml        # 每日 0:00 北京时间
│   └── weekly-news.yml         # 每周一 6:00 北京时间
├── astro.config.mjs · package.json
├── css/ · app.js · style.css
├── backend/                    # 本地预览 dist/ + 内容 API
└── tests/e2e/smoke.spec.js
```

---

## 构建流程（Astro SSG）

### 日常命令

```bash
# 1. 编辑 data/*.json 或 src/
vim data/tools.json

# 2. 构建 → dist/
./build.sh          # 等价于 npm run build

# 3. 本地预览
npm run dev         # Astro 开发模式
npm run preview     # 预览 dist（Playwright 使用 /ai/ 基路径）

# 4. 校验
DIST=dist python3 scripts/validate_ci.py
npm run test:e2e
```

### prebuild 阶段

`npm run prebuild` 依次执行：

1. **`sync-public.mjs`** — 将 `css/`、`vendor/`、`*.js`、`daily-videos.json`、`ai-news.json`、`oss-projects.json` 复制到 `public/`。
2. **`build-artifacts.mjs`** — 从 `data/*.json` 生成 `prompts.json`、`tutorials.json`、`search-index.json`、`analytics-config.json`，并复制 `data/oss-projects.json` → `public/oss-projects.json`。

### 构建产物（dist/）

| 输入 | 输出 |
|------|------|
| `data/site.json` + `tools.json` + `cases.json` | `index.html` |
| `data/tools.json` | `tools/{id}.html`（**getStaticPaths 自动生成**） |
| `data/compares.json` | `compare/{slug}.html` |
| 全部内容数据 | `search-index.json`（build-artifacts.mjs） |
| Astro sitemap 集成 | `sitemap-index.xml` |

### 重要约定

- **不要手改** `dist/`；改 `data/` 或 `src/` 后重新 `npm run build`。
- 旧根目录 `index.html`、`tools/` 等已 gitignore，不再提交；**本地若残留这些文件，可能掩盖问题**（校验仅看 `dist/`）。
- 调整页面结构改 `src/pages/` 或 `src/components/`；调整文案改 `data/*.json`。
- **路径统一**：布局通过 `src/lib/paths.ts` 的 `asset()` / `homeHref()` 生成 `/ai/...`；页面勿再传 `assetPrefix="../"`。
- 首页业务脚本（videos / news / oss）由 `lazy-sections.js` **仅在进入对应 Tab** 时加载；首页预览由 Astro 构建期 SSG 内联（`Home*Preview.astro` + `src/lib/runtime.ts`），首屏不再等待 JSON。

### 搜索索引

`search-index.json` 由 `build-artifacts.mjs` 自动生成，**主路径**包含：

- 每个工具的 SPA section + 独立页 URL
- 对比专题页、对比指南
- 每日视频、每周新闻、开源精选、排行榜

> Prompt / 案例 / 学习路线 / Labs / 工具中心 **已写入**主搜索索引（`build-artifacts.mjs`）。

`app.js` 启动时 `fetch('search-index.json')`，**不要手写**搜索条目。

---

## 数据格式

### `data/site.json`

站点级配置：`meta`、`nav.menu`、`hero`、`hot_tools`、`home_tool_categories`（国内/国际分类）、`rankings`、`compare_guides`、`compare_table`、`ai_picker`、`learning_paths`、`news_page`、`faq`、`footer` 等。

### `data/tools.json`

工具数组，每项字段：

| 字段 | 说明 |
|------|------|
| `id` | 如 `chatgpt`，对应 `section-chatgpt` |
| `icon` / `name` / `description` | 页头与卡片 |
| `getting_started_steps` | HTML 字符串数组 |
| `features` | `[{title, description}]` |
| `text_resources` / `video_resources` | 外链资料 |

### `data/cases.json`

| 字段 | 说明 |
|------|------|
| `cases[].tool` | 关联工具 id |
| `cases[].scenarios` | 如 `["writing", "beginner"]` |
| `cases[].steps[]` | `{title, blocks:[{type, content}]}` |
| `blocks.type` | `paragraph` / `prompt` / `tip` / `checklist` |

### `data/compares.json`

对比专题：`slug`、`title`、`meta_description`、`table`、`sections`、`cta`、`search_keywords`。

### `data/oss-projects.json`

GitHub Stars 开源精选，按 AI 应用领域分组：

```json
{
  "updated_at": "2026-07-10",
  "title": "GitHub Stars 开源精选",
  "domains": [
    {
      "id": "ai-agent",
      "label": "AI Agent",
      "description": "自主规划、工具调用与多步任务编排",
      "projects": [
        {
          "id": "langgraph",
          "repo": "langchain-ai/langgraph",
          "name": "LangGraph",
          "description": "...",
          "stars": 36963,
          "url": "https://github.com/langchain-ai/langgraph",
          "language": "Python"
        }
      ]
    }
  ]
}
```

**六大领域**（每领域至少 1 个项目）：`ai-agent`、`llm-apps`、`local-llm`、`ai-art`、`multimodal`、`ml-framework`。

维护：编辑 `data/oss-projects.json` 后运行 `python3 scripts/fetch_oss_stars.py` 刷新 Star 数；脚本会同步写入根目录 `oss-projects.json`。

### `daily-videos.json`

```json
{
  "updated_at": "2026-07-10T12:00:00+08:00",
  "seen_ids": ["youtube:..."],
  "batches": [
    {
      "date": "2026-07-10",
      "timezone": "Asia/Shanghai",
      "criteria": {
        "video_categories": {
          "youtube_top_views": { "label": "YouTube：100 天全网播放量 Top 10", "window": { "days": 100 }, "top_count": 10, "min_views": 100000 },
          "youtube_recent_30d": { "label": "YouTube：30 天内上新 Top 5", "window": { "days": 30 }, "top_count": 5, "min_views": 10000 },
          "youtube_recent_24h": { "label": "YouTube：24 小时内上新 Top 3", "window": { "hours": 24 }, "top_count": 3, "min_views": 1000 },
          "bilibili_top_views": { "label": "B站：100 天全网播放量 Top 10", "window": { "days": 100 }, "top_count": 10, "min_views": 100000 },
          "bilibili_recent_30d": { "label": "B站：30 天内上新 Top 5", "window": { "days": 30 }, "top_count": 5, "min_views": 10000 },
          "bilibili_recent_24h": { "label": "B站：24 小时内上新 Top 3", "window": { "hours": 24 }, "top_count": 3, "min_views": 1000 }
        }
      },
      "categories": {
        "youtube_top_views": {
          "label": "YouTube：100 天全网播放量 Top 10",
          "window": { "days": 100 },
          "top_count": 10,
          "videos": [{ "id": "youtube:...", "platform": "youtube", "title": "...", "views": 61235029 }]
        }
      }
    }
  ]
}
```

- **六类推荐**同平台跨分类去重：抓取按 `PICK_ORDER`（24h → 30d → 100d）占坑；页面按 `CATEGORY_ORDER`（**100d → 30d → 24h**）展示。
- 分类级播放量门槛：**24h≥1000 / 30d≥10000 / 100d≥100000**（见 `config/video-fetch.yaml`）；`window` 支持 `hours`、`days`（旧 `all_time` 仍可解析）。
- `batches` 新日期插入头部；`seen_ids` 全局去重；历史最多 **60 天**（前端视频页**只渲染最新一批**，不展示历史日期）。
- 旧版四类 key（`top_views`、`recent_24h` 等）在 `videos.js` 中仍向后兼容。
- CI 校验 Schema、最新批次六类 key 完整、**跨分类 video id 唯一**，并拒绝摘要中含 URL/广告残留。

### `ai-news.json`

```json
{
  "updated_at": "2026-07-10T21:31:02+08:00",
  "date": "2026-07-10",
  "cadence": "weekly",
  "items": [
    {
      "id": "abc123",
      "title": "...",
      "summary": "...",
      "url": "https://...",
      "source": "OpenAI",
      "category": "新模型发布",
      "published_at": "2026-07-10T12:00:00+08:00"
    }
  ],
  "watch_sources": [
    { "name": "OpenAI", "blog": "https://openai.com/news/", "x": "https://x.com/OpenAI" },
    { "name": "机器之心", "blog": "https://www.jiqizhixin.com/", "x": "https://x.com/SyncedTech" }
  ]
}
```

- `cadence: "weekly"` 表示每周更新。
- `watch_sources` 展示暂无稳定 RSS 的官方博客与 X 账号（Meta AI、Hugging Face、机器之心、新智元、智源社区等）。

---

## 前端设计

### 单页多区块（SPA 式，无路由库）

| `data-tool` / `data-goto` | Section ID | 内容 |
|---------------------------|------------|------|
| `all` | `section-home` | 总览：热门工具、分类、排行、对比、开源、新闻、视频 |
| `chatgpt` … `copilot` | `section-{tool}` | 各 AI 工具教程 |
| `oss` | `section-oss` | GitHub Stars 开源精选 |
| `news` | `section-news` | 每周 AI 新闻 |
| `videos` | `section-videos` | 每日六类视频推荐（仅最新一批） |

> 旧 hash（`cases` / `prompts` / `create`）若仍可跳转，属于**遗留兼容**；对应区块已不在 `index.astro` 主路径与导航中。

支持 **hash 深链接**：`index.html#section-cursor`。

另有 **独立 URL 页面**（SEO）：`tools/cursor.html`、`ai-tools-ranking.html`、`news/daily-ai-news.html` 等。

### 首页内容区块（`section-home`）

| 区块 ID | 说明 |
|---------|------|
| 热门 AI 工具 | 国内/国际热门卡片 |
| AI 工具分类 | 国内 / 国际 / 编程场景 |
| `home-rankings` | 2026 工具排行榜预览 |
| `home-compare` | 选型对比表预览 |
| `home-oss` | 开源精选预览 |
| `home-news` | 本周新闻预览 |
| `home-videos` | 每日视频预览（最新一批） |

### 样式模块

```css
@import url('css/base.css');       /* 变量、reset */
@import url('css/layout.css');     /* header、hero、footer */
@import url('css/components.css'); /* 卡片、案例、搜索、对比表 */
@import url('css/videos.css');     /* 视频卡片 */
@import url('css/library.css');     /* Prompt、开源精选、新闻关注面板 */
```

### 动态数据模块

| 文件 | 数据 URL | 说明 |
|------|----------|------|
| `videos.js` | `daily-videos.json` | 仅最新一批；六类按 100d→30d→24h；跨分类去重；平台/排序筛选 |
| `news.js` | `ai-news.json` | 新闻卡片 + `watch_sources` 关注面板 |
| `oss.js` | `oss-projects.json` | 按领域筛选；首页预览 + 完整列表 |

各模块使用 **单次 Promise 缓存**，首页预览与 Tab 页共用同一次 `fetch`。

---

## 本地开发

### 推荐流程

```bash
cd ai
npm ci
pip install -r requirements.txt
./build.sh
./start.sh    # FastAPI → http://127.0.0.1:8765
```

### 方式一：Astro 开发服务器

```bash
npm run dev     # 热更新，适合改 src/
```

### 方式二：FastAPI（预览 dist/）

`backend/main.py` 提供 `/api/*` 与静态站。静态资源在 **`/ai/`**（与 Astro `base` 一致），`/` 307 到 `/ai/`；仍兼容无前缀的旧路径。`data_store` 按文件 **mtime** 失效缓存；`runtime_path()` 顺序为 **`dist/` → `public/` → 仓库根目录**。

本地入口：`./start.sh`（始终用 `.venv` 安装依赖并启动，默认 http://127.0.0.1:8765/ai/）。

### 测试

```bash
# 全量校验（默认 9 步，与 CI 一致）
DIST=dist python3 scripts/validate_ci.py

# 单步校验（CI 中逐步执行，便于定位失败）
DIST=dist python3 scripts/validate_ci.py data
DIST=dist python3 scripts/validate_ci.py oss
DIST=dist python3 scripts/validate_ci.py videos    # 六类 key + 跨分类唯一 id + 摘要清洗
DIST=dist python3 scripts/validate_ci.py news
DIST=dist python3 scripts/validate_ci.py runtime
DIST=dist python3 scripts/validate_ci.py sitemap
DIST=dist python3 scripts/validate_ci.py search
DIST=dist python3 scripts/validate_ci.py analytics
DIST=dist python3 scripts/validate_ci.py links     # HTML 内部链接，禁止逃出 dist/

# API 冒烟（运行时 JSON 优先 dist/）
PYTHONPATH=. python3 scripts/smoke_api.py

# E2E（需先 build；首次安装 Chromium）
npx playwright install chromium
npm run test:e2e

./cloud-test.sh    # 线上 Pages 探测
```

**Playwright 配置**（`playwright.config.js`）：本地/CI 均以 `astro preview` 在 `http://127.0.0.1:8766/ai` 起服；CI 下 `workers: 1`、`retries: 2`、`timeout: 60s`。冒烟用例优先 `domcontentloaded` + 显式 selector，避免依赖 `networkidle`。

---

## 每日视频流水线

### 触发时机

| 触发器 | 说明 |
|--------|------|
| `cron: "0 16 * * *"` | UTC 16:00 = 北京时间次日 00:00 |
| `workflow_dispatch` | 手动运行 |

工作流：`.github/workflows/daily-videos.yml`

### 六类推荐结构

| 分类 key | 平台 | 窗口 | 数量 | 最低播放量 |
|----------|------|------|------|------------|
| `youtube_top_views` | YouTube | 100 天 | Top 10 | 100000 |
| `youtube_recent_30d` | YouTube | 30 天 | Top 5 | 10000 |
| `youtube_recent_24h` | YouTube | 24 小时 | Top 3 | 1000 |
| `bilibili_top_views` | B站 | 100 天 | Top 10 | 100000 |
| `bilibili_recent_30d` | B站 | 30 天 | Top 5 | 10000 |
| `bilibili_recent_24h` | B站 | 24 小时 | Top 3 | 1000 |

- **展示 / 写入顺序** `CATEGORY_ORDER`：各平台 **100d → 30d → 24h**
- **抓取 / 去重顺序** `PICK_ORDER`：**24h → 30d → 100d**（窄窗口优先占坑）

### 抓取流程

```
1. 读取 config/video-fetch.yaml
2. 多平台搜索（YouTube ytsearch / B站搜索 API）
3. 预筛：分类 min_views、AI 关键词、分辨率、订阅数
4. 按 PICK_ORDER 取 Top N（同平台 used_ids 去重）
   - 24h/30d：按发布时间搜索（B站 order=pubdate）；YouTube 仍为 ytsearch，再滤时间窗
   - 100d Top：按热度搜索（B站 order=click）并滤 100 天窗，可补充日期搜索候选
5. 生成摘要（过滤 URL/赞助/广告文案）
6. 写入 daily-videos.json（categories 按 CATEGORY_ORDER）→ push → 触发 CI + Pages
```

### 本地手动运行

```bash
pip install yt-dlp pyyaml
python3 scripts/fetch_daily_videos.py
python3 scripts/fetch_daily_videos.py --force   # 升级分类后强制重抓今日批次
```

**幂等性**：当日 batch 已存在则跳过。

### 可调参数

编辑 `config/video-fetch.yaml` 中 `video_categories.*.top_count` / `days` / `hours` / `min_views`，以及 `search_sources`、`search_queries`。

---

## 每周新闻与开源 Star 流水线

### 触发时机

| 触发器 | 说明 |
|--------|------|
| `cron: "0 22 * * 0"` | UTC 周日 22:00 = 北京时间周一 06:00 |
| `workflow_dispatch` | 手动运行 |

工作流：`.github/workflows/weekly-news.yml`

### 新闻信源

| 类型 | 来源 |
|------|------|
| RSS | OpenAI、Google DeepMind、Google AI、NVIDIA、Microsoft Research、arXiv（cs.AI/LG/CL/CV）、量子位 |
| HTML 抓取 | Anthropic 官网 `/news` |
| 智源社区聚合 | `hub.baai.ac.cn` NUXT 数据 |
| GitHub API | GitHub Trending AI 仓库 |
| 持续关注面板 | OpenAI、Anthropic、DeepMind、Meta AI、Microsoft、NVIDIA、Hugging Face、机器之心、量子位、新智元、智源社区（博客 + X） |

> 机器之心、新智元、智源社区、Meta AI、Hugging Face 暂无稳定 RSS，通过 `watch_sources` 在新闻 Tab 底部展示官方链接。

### 抓取流程

```
1. 读取 config/news-fetch.yaml
2. 拉取 RSS / HTML / GitHub Trending
3. 按关键词分类；去重；保留近 7 天（最多 40 条）
4. 写入 ai-news.json + content/news/daily-ai-news.md
5. 运行 fetch_oss_stars.py 刷新 data/oss-projects.json 与 oss-projects.json
6. push → 触发 CI + Pages
```

### 本地手动运行

```bash
pip install pyyaml
python3 scripts/fetch_ai_news.py
python3 scripts/fetch_oss_stars.py
```

macOS 若遇 Python SSL 证书问题，脚本会自动回退到 `curl` 抓取。

---

## CI/CD 与部署

### 工作流关系

```
push/PR → ci.yml（build + validate + API smoke；E2E continue-on-error）
         PR 额外上传 dist-preview artifact
push main → pages.yml（build + validate → artifact → deploy；无 E2E）

daily-videos.yml → metrics summary → commit → 失败开 Issue(ops,fetch)
weekly-news.yml  → metrics summary → commit → 失败开 Issue(ops,fetch)
site-health.yml  → 探测线上新鲜度 → 失败开 Issue(ops,site-health)
```

**必绿（发版相关）**：Pages 的 build + `validate_ci.py`。  
**参考信号（不挡发版）**：CI 中的 Playwright E2E。

### 运维探针

```bash
# 本地对线上跑新鲜度检查
npm run health:live
# 或
./cloud-test.sh
```

| 检查 | 阈值（可环境变量覆盖） |
|------|------------------------|
| 首页 / style.css | HTTP 200 |
| `daily-videos.json` | ≤ `VIDEO_MAX_AGE_DAYS`（默认 2 天） |
| `ai-news.json` | ≤ `NEWS_MAX_AGE_DAYS`（默认 10 天） |

### `pages.yml`（发版）

| 步骤 | 说明 |
|------|------|
| build | `npm ci && npm run build`（Node 读 `.nvmrc`，npm cache） |
| validate | 全量 `validate_ci.py` |
| upload artifact | `dist/` → Pages artifact（deploy 不再二次 build） |
| deploy | `actions/deploy-pages` |

### `ci.yml` 检查项

运行环境：**ubuntu-latest**，**Node 22**（`.nvmrc`），**Python 3.12**。

| 步骤 | 命令 / 说明 |
|------|-------------|
| 构建 | `npm ci && npm run build` → `dist/` |
| PR preview | 上传 `dist-preview` artifact（保留 7 天） |
| Validate（9 步） | `validate_ci.py` 分步 |
| FastAPI API smoke | `scripts/smoke_api.py` |
| E2E | `continue-on-error: true` — 失败仅 warning，**不失败 job** |

本地全量校验：`DIST=dist python3 scripts/validate_ci.py`。

### FastAPI 角色边界

- **生产（GitHub Pages）**：纯静态 `dist/`，无后端问答。
- **本地 / Docker**：`./start.sh` 或镜像提供 `/ai/` 静态 + `/api/*` 增强；勿假设线上存在 `/api/ask`。
- GitHub Pages **不支持**自定义响应头；安全联系见 `/.well-known/security.txt`。

### GitHub Pages

- 工作流：`.github/workflows/pages.yml`
- 部署目录：`dist/`
- Settings → Pages → Source：**GitHub Actions**
- Dependabot：`.github/dependabot.yml`（npm / pip / actions 周更）
---

## 内容维护指南

### 新增 AI 工具

1. 在 `data/tools.json` 追加工具对象。
2. 在 `data/site.json` 更新 `nav.menu`、`home_tool_categories`、`compare_table.rows`（可选）。
3. 在 `css/base.css` + `css/components.css` 添加品牌色。
4. `npm run build` + `DIST=dist python3 scripts/validate_ci.py`。

自动生成：`tools/{id}.html`、首页 section、搜索索引。

### 新增开源项目

1. 在 `data/oss-projects.json` 对应 `domains[].projects` 追加条目。
2. 运行 `python3 scripts/fetch_oss_stars.py` 刷新 Star。
3. `npm run build`（prebuild 会复制到 `public/`）。

### 新增/调整新闻信源

编辑 `config/news-fetch.yaml`：

- RSS：在 `feeds` 追加 `{ source, url, category }`
- HTML 抓取：`type: html_links` + `link_pattern` + `base_url`
- 关注面板：在 `watch_sources` 追加 `{ name, blog, x }`

然后 `python3 scripts/fetch_ai_news.py` 验证。

### 修改视频筛选逻辑

改 `config/video-fetch.yaml` 或 `scripts/fetch_daily_videos.py`；UI 改 `videos.js` / `css/videos.css`。

### 修改页面结构

改 `src/pages/` 或 `src/components/`，然后 `npm run build`。**不要**手改 `dist/`。

---

## 配置参考

### `config/video-fetch.yaml`

六类 `video_categories`、双平台 `search_sources`、搜索关键词与摘要过滤规则。详见 [每日视频流水线](#每日视频流水线)。

### `config/news-fetch.yaml`

```yaml
max_items: 40
max_per_feed: 5
max_age_days: 7          # 每周保留近 7 天

feeds: [...]             # RSS / html_links
github_trending:         # GitHub API 搜索 AI 仓库
  enabled: true
  per_page: 6
watch_sources: [...]     # 官方博客 + X 账号
```

### `data/analytics.json`

填入 GA4 与 Clarity ID 后 `npm run build`，生成 `analytics-config.json`。

### FastAPI 内容 API（`./start.sh`）

| 端点 | 说明 |
|------|------|
| `GET /api/health` | 健康检查 |
| `GET /api/tools` | 工具列表 |
| `GET /api/prompts` | Prompt 库 |
| `GET /api/tutorials` | 教程索引 |
| `GET /api/videos` | 最新视频批次 |
| `POST /api/ask` | 知识库问答（BM25） |
| `POST /api/recommend` | 基于 `ai_picker` 关键词的工具推荐 |
| `GET /api/search?q=` | 关键词检索 |

### 纳入版本控制

`data/*.json`、`daily-videos.json`、`ai-news.json`、`oss-projects.json`、`package-lock.json`。

**不提交**：`dist/`、`public/`、`node_modules/`。

---

## 故障排查

| 现象 | 可能原因 | 处理 |
|------|----------|------|
| CI 构建失败 | `data/*.json` 格式错误 | 检查 JSON；`npm run build` 看报错 |
| CI `links` 死链 / 越界 | 子目录页用了 `../../index.html` | 改为 `../index.html`；重跑 `validate_ci.py links` |
| 本地 validate 通过、CI 失败 | 根目录遗留 gitignore 的 `index.html` 等 | 删除根目录遗留 HTML/JSON，仅以 `dist/` 为准 |
| CI 摘要校验失败 | `daily-videos.json` 含 URL/广告 | 重跑抓取或清洗摘要 |
| CI 视频分类失败 | 最新批次缺少六类 key | 手动触发 `daily-videos.yml` 或 `--force` 重抓 |
| CI 跨分类重复 | 同一 video id 出现在多个分类 | 确认 `PICK_ORDER` 去重；`--force` 重抓 |
| API smoke 读不到数据 | 未 build 或读错路径 | 先 `npm run build`；确认 `dist/` 含运行时 JSON |
| Playwright 失败 | 未构建、未装浏览器或超时 | `npm run build`；`npx playwright install chromium`；CI 以 Actions 日志为准 |
| 搜索无结果 | 未生成 `search-index.json` | `npm run build` |
| 视频文案仍写「全网」 | 页面/数据未跟新 yaml | 更新 `index.astro` / FAQ；`--force` 重抓以刷新 batch label |
| 新闻关注源为空 | 未刷新 `ai-news.json` | 运行 `fetch_ai_news.py` |
| OSS Star 为 0 | 未跑 `fetch_oss_stars.py` | 本地或等 weekly workflow |
| 机器之心无 RSS 条目 | 站点无稳定 RSS | 正常；通过 `watch_sources` 面板关注 |
| B 站 30d/24h 条数不足 | 门槛过高或搜索候选不足 | 检查 `min_views`；100d Top 通常较易满足 |

### GitHub Actions 权限

- `daily-videos.yml`、`weekly-news.yml` 需 `contents: write`
- Settings → Actions → Workflow permissions → **Read and write**

---

## 版本与变更记录

| 版本 | 说明 |
|------|------|
| 1.0 | 六工具教程 + 实战案例 |
| 1.2 | 纯静态站；新增 Kimi/通义/豆包/Copilot |
| 1.3 | 每日视频自动更新 |
| 1.4 | SEO：OG、对比页、工具独立页、站内搜索 |
| 1.5 | 数据驱动 Jinja2 构建 + CI |
| 1.6 | Astro SSG 迁移；工具页自动生成 |
| 1.7 | 六类视频；GitHub 开源精选；每周新闻；扩展信源与关注面板；首页对比表 |
| 1.8 | Phase 3.5：智源社区聚合；CI 九步分步校验 + 链接越界检测；API 优先读 `dist/`；Playwright E2E 扩展至 17 项 |
| 1.9 | Pages 与 E2E 解耦；FastAPI `/ai/` 基路径；`paths.ts` 统一链接；首页脚本懒加载；JSON 默认缓存；data_store mtime；Docker 多阶段 build |
| 1.10 | 运维探针与抓取失败开 Issue；E2E 非阻塞；Dependabot；钉依赖；OG 压缩；PR dist artifact |
| 1.11 | 主路径精简为工具/开源/新闻/视频四块；导航与搜索入口对齐清单 |
| 1.12 | 视频：100 天 Top + 分类 min_views；跨分类去重；页面仅最新批次；展示序 100d→30d→24h |

---

## 贡献流程

```bash
git checkout -b feature/your-change

vim data/tools.json          # 或 src/pages/...
npm run build
DIST=dist python3 scripts/validate_ci.py
npm run test:e2e

git add data/ src/ config/
git commit -m "content: ..."
git push origin feature/your-change
# 提 PR → CI 通过 → 合并 main → 自动部署 Pages
```

---

## 相关链接

- [Astro 文档](https://docs.astro.build/)
- [GitHub Pages 文档](https://docs.github.com/en/pages)
- [yt-dlp 文档](https://github.com/yt-dlp/yt-dlp#usage-and-options)
- [Playwright 文档](https://playwright.dev/docs/intro)
- [FastAPI 文档](https://fastapi.tiangolo.com/)
