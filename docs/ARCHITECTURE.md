# 系统架构

本文帮助开发者快速建立 **Bio AI Lab** 的全局认知：纯前端静态站点，以 `data/` JSON 为内容源，Astro 生成 HTML，GitHub Actions 负责 CI/CD。

线上地址：https://bio-apple.github.io/ai/

---

## 1. 总览

```mermaid
flowchart TB
  subgraph sources["内容源"]
    DATA["data/*.json<br/>手工维护"]
    FETCH["根目录运行时 JSON<br/>脚本抓取"]
    CFG["config/*.yaml<br/>抓取规则"]
  end

  subgraph build["构建（本地 / CI）"]
  PRE["prebuild.mjs"]
  ASTRO["astro build"]
  DIST["dist/ 静态产物"]
  end

  subgraph deploy["部署"]
  GHA["GitHub Actions<br/>deploy.yml"]
  PAGES["GitHub Pages CDN"]
  end

  subgraph runtime["浏览器运行时"]
  HTML["*.html 页面"]
  JS["*.js 客户端逻辑<br/>搜索 / 漏斗 / 虚拟列表 / link-guard"]
  JSON_RT["*.json 动态加载"]
  end

  DATA --> PRE
  FETCH --> PRE
  CFG --> FETCH
  PRE --> ASTRO
  ASTRO --> DIST
  DIST --> GHA
  GHA --> PAGES
  PAGES --> HTML
  HTML --> JS
  JS --> JSON_RT
```

| 层级   | 技术                   | 职责                                                    |
| ------ | ---------------------- | ------------------------------------------------------- |
| 内容层 | `data/` + 抓取脚本     | 站点文案、工具、对比、排行；新闻/视频/课程/OSS 定时刷新 |
| 构建层 | Astro 5 SSG + prebuild | 编译 ~21 个 HTML 页，打包 CSS/JS，生成搜索索引          |
| 交付层 | GitHub Pages           | 托管 `dist/`，无服务端运行时                            |
| 交互层 | 原生 JS + Fuse.js      | Tab、全站搜索、推荐、漏斗埋点、虚拟列表、链接兜底       |

---

## 2. Astro 静态页面生成

### 2.1 页面模型

```mermaid
flowchart LR
  subgraph astro["src/"]
    PAGES["pages/*.astro"]
    COMP["components/*.astro"]
    LAYOUT["layouts/"]
    LIB["lib/data.ts"]
  end

  subgraph data["data/"]
    SITE["site.json"]
    TOOLS["tools.json"]
    MORE["compares / rankings …"]
  end

  SITE --> LIB
  TOOLS --> LIB
  MORE --> LIB
  LIB --> PAGES
  PAGES --> COMP
  PAGES --> LAYOUT
  LAYOUT --> HTML_OUT["dist/*.html"]
```

**两种布局壳：**

| 布局                     | 用于                          | 特点                                  |
| ------------------------ | ----------------------------- | ------------------------------------- |
| `HomeLayout.astro`       | `index.astro`                 | SPA 式 Tab 导航、知识库 FAB、推荐助手 |
| `StandaloneLayout.astro` | 工具页 / 对比 / 指南 / 排行等 | 独立 `<main>`、面包屑、可选知识库 FAB |

**路由与输出**（`astro.config.mjs`）：

- `base: '/ai/'` — 适配 GitHub Pages 子路径
- `output: 'static'` — 纯 SSG，构建期生成全部 HTML
- `build.format: 'file'` — 产出 `index.html`、`tools/hub.html` 等文件路径

### 2.2 构建流水线

```mermaid
sequenceDiagram
  participant Dev as 开发者 / CI
  participant PB as prebuild.mjs
  participant SP as sync-public.mjs
  participant BA as build-artifacts.mjs
  participant BC as bundle-css.mjs
  participant AS as astro build
  participant D as dist/

  Dev->>PB: npm run build
  PB->>SP: 同步 JS/CSS/vendor/JSON → public/
  PB->>BC: style.css 打包
  PB->>BA: search-index / recommend-rules / analytics-config
  PB->>AS: public/ + src/ → 编译
  AS->>D: *.html + 静态资源 + sitemap
```

**prebuild 三步**（`scripts/prebuild.mjs`）：

1. **sync-public** — 根目录 `*.js`、`robots.txt`、抓取 JSON、`lib/`、`vendor/` 等复制到 `public/`
2. **bundle-css** — `style.css` 合并 `css/*.css` 为单文件
3. **build-artifacts** — 从 `data/` 生成运行时 JSON（搜索索引、推荐规则、分析配置）

Astro 随后将 `public/` 与 `src/pages` 编译进 `dist/`。

---

## 3. 数据如何驱动内容

### 3.1 数据分类

```mermaid
flowchart TB
  subgraph manual["手工维护 data/"]
    site["site.json — 导航/文案/推荐场景"]
    tools["tools.json — 工具教程"]
    compares["compares.json — 对比专题"]
    rankings["rankings.json — 排行榜"]
    rel["tool-relations.json"]
    eng["engagement.json"]
    ana["analytics.json"]
    oss_d["oss-projects.json 模板"]
  end

  subgraph fetched["脚本抓取 → 根目录 JSON"]
    news["ai-news.json"]
    courses["ai-courses.json"]
    videos["daily-videos.json"]
    oss["oss-projects.json"]
  end

  subgraph generated["prebuild 生成 → public/"]
    search["search-index.json"]
    recommend["recommend-rules.json"]
    analytics["analytics-config.json"]
    slim["daily-videos.latest.json"]
  end

  manual --> ASTRO_BUILD["Astro 构建期<br/>import 进 HTML"]
  fetched --> SYNC["sync-public"]
  manual --> ARTIFACTS["build-artifacts.mjs"]
  SYNC --> CLIENT["浏览器 fetch"]
  ARTIFACTS --> search
  ARTIFACTS --> recommend
  ARTIFACTS --> analytics
  videos --> slim
```

### 3.2 构建期 vs 运行时

| 时机       | 数据源                                 | 消费方                               | 说明                                             |
| ---------- | -------------------------------------- | ------------------------------------ | ------------------------------------------------ |
| **构建期** | `data/site.json` 等                    | Astro 页面、`src/lib/*.ts`           | `import` 进 HTML，SEO/结构化数据在 SSG 时固化    |
| **运行时** | `ai-news.json`、`daily-videos.json` 等 | `news.js`、`videos.js`、`courses.js` | 页面加载后 `fetch`，支持日更而不重编全部页面逻辑 |
| **运行时** | `search-index.json`                    | `app.js`、`knowledge.js`、顶栏搜索   | Fuse.js 全文检索（工具/资讯/开源/课程/视频/模型） |
| **运行时** | `recommend-rules.json`                 | `recommend.js`                       | 场景关键词 → 工具推荐                            |

首页是 **混合模式**：Hero/导航/推荐场景在构建期渲染；新闻/视频/课程/OSS Tab 由 JS 懒加载对应 JSON。

### 3.4 客户端模块（浏览器）

| 模块 | 文件 | 职责 |
| ---- | ---- | ---- |
| 搜索 | `app.js` + `GlobalSearch.astro` | 多实例 Fuse 搜索、联想、历史 |
| 漏斗 | `funnel.js` → `analytics.js` | `journey_id` / `funnel_step` enrich |
| 虚拟列表 | `lib/virtual-list.js` | 视频 / 榜单 / GitHub 热门 |
| 链接兜底 | `lib/link-guard.js` | noreferrer、图片兜底、GitHub 404 |
| 开源卡 | `OssCard.astro` + `oss.js` | Stars / 语言 / 用途 / 仓库按钮 |
| 懒加载 | `lazy-sections.js` | Tab 进入后再拉业务脚本 |

详见 [FRONTEND.md](./FRONTEND.md)、[CONTENT-FUNNEL.md](./CONTENT-FUNNEL.md)。

### 3.3 定时数据刷新

```mermaid
flowchart LR
  CRON["GitHub Actions 定时任务"]
  PY["Python 抓取脚本"]
  JSON["根目录 JSON"]
  MAIN["commit → main"]
  DEPLOY["deploy.yml"]

  CRON --> PY
  PY --> JSON
  JSON --> MAIN
  MAIN --> DEPLOY
```

| 工作流                  | 脚本                    | 产出 / 作用                         |
| ----------------------- | ----------------------- | ----------------------------------- |
| `daily-news.yml`        | `fetch_ai_news.py`      | `ai-news.json`                      |
| `daily-videos.yml`      | `fetch_daily_videos.py` | `daily-videos.json`                 |
| `weekly-oss.yml`        | `fetch_oss_stars.py`    | `oss-projects.json`                 |
| `weekly-courses.yml`    | `fetch_ai_courses.py`   | `ai-courses.json`                   |
| `weekly-link-check.yml` | lychee                  | 外链死链扫描（不改数据，开 Issue）  |
| `site-health.yml`       | `check_site_health.py`  | 线上 JSON 新鲜度探针                |

数据有变更时，抓取工作流会 `workflow_dispatch` 触发 `deploy.yml` 重新部署。

---

## 4. GitHub Actions 与 CI/CD

```mermaid
flowchart TB
  PUSH["push / merge main"]
  PR["pull_request"]

  PUSH --> CI["ci.yml"]
  PUSH --> DEPLOY["deploy.yml"]

  PR --> CI

  subgraph ci_jobs["ci.yml — 质量门禁"]
    Q1["Lint & Format"]
    V1["Build + 单元测试"]
    V2["validate_ci.py 全量校验"]
    V3["Playwright E2E"]
  end

  subgraph deploy_jobs["deploy.yml — 一键上线"]
    Q2["Lint & Format"]
    B["Build + validate_ci"]
    U["upload-pages-artifact"]
    D["deploy-pages → GitHub Pages"]
  end

  CI --> Q1 --> V1 --> V2 --> V3
  DEPLOY --> Q2 --> B --> U --> D
  D --> LIVE["bio-apple.github.io/ai/"]
```

| 工作流               | 触发              | 目的                                        |
| -------------------- | ----------------- | ------------------------------------------- |
| **ci.yml**           | push/PR `main`    | 完整质量门禁（含 E2E），PR 上传 `dist` 预览 |
| **deploy.yml**       | push `main`、手动 | 精简路径：校验通过后尽快发布 Pages          |
| **daily-_/weekly-_** | cron              | 刷新 JSON 数据，必要时触发 deploy           |

push `main` 时 **ci.yml 与 deploy.yml 并行**；deploy 不推 `gh-pages` 分支，而是使用官方 `actions/deploy-pages` 制品部署。

详见 [CI-CD.md](./CI-CD.md)。

---

## 5. 校验与质量门禁

`scripts/validate_ci.py` 在 CI 与 deploy 的 Build 阶段执行：

```mermaid
flowchart LR
  V["validate_ci.py"]
  S["secrets"]
  D["data / schema"]
  RT["runtime / recommend"]
  SEO["sitemap / opengraph / jsonld"]
  SR["search / analytics"]
  LINK["HTML links"]
  V --> S --> D --> RT --> SEO --> SR --> LINK
```

主要步骤（可单独跑 `DIST=dist python3 scripts/validate_ci.py <step>`）：

`secrets` → `data` → `tool-relations` → `oss` → `videos` → `news` → `courses` → `runtime` → `recommend` → `sitemap` → `opengraph` → `jsonld` → `search` → `analytics` → `engagement` → `links`

另：CI Lint 前跑 **gitleaks**；每周 **lychee** 扫外链（见 [CI-CD.md](./CI-CD.md)）。

Schema 文件位于 `schemas/`；手工维护的 `site.json` / `tools.json` 校验 **JSON 可解析 + 交叉引用**（如 `tool-relations` 的 id 必须存在于 `tools.json`）。

---

## 6. 本地开发架构

```mermaid
flowchart LR
  DEV["npm run build"]
  START["./start.sh"]
  FASTAPI["FastAPI /api/*"]
  STATIC["挂载 dist/ → /ai/"]

  DEV --> STATIC
  START --> FASTAPI
  START --> STATIC
```

- **生产（GitHub Pages）**：仅静态文件，无 `/api/*`
- **本地 `./start.sh`**：可选 FastAPI，`/api/ask` 为站内 BM25 检索（非 LLM）；知识库助手会探测 `/api/health` 后决定是否调用

---

## 7. 目录速查

```
data/                 # 手工内容源（见 DATA-MODEL.md）
config/               # 抓取规则 YAML + csp.json
schemas/              # JSON Schema（CI 门禁）
src/pages/            # Astro 路由 → HTML
src/components/       # 可复用 UI 块（OssCard / GlobalSearch / SeoHead …）
src/layouts/          # 页面壳
src/lib/              # data 加载、路径、Schema.org（schema.ts）
lib/                  # 浏览器共享：fetch-json / virtual-list / link-guard
scripts/              # prebuild / 抓取 / 校验
css/ + *.js           # 样式与运行时脚本
dist/                 # 构建产物（不提交）
public/               # prebuild 中间产物（不提交）
```

---

## 相关文档

- [DATA-MODEL.md](./DATA-MODEL.md) — 核心 JSON 字段与 Schema
- [FRONTEND.md](./FRONTEND.md) — 浏览器端能力
- [CONTENT-FUNNEL.md](./CONTENT-FUNNEL.md) — 内容漏斗埋点
- [DEVELOPER.md](../DEVELOPER.md) — 本地开发与常见改动
- [CI-CD.md](./CI-CD.md) — 部署流程
- [SECURITY.md](./SECURITY.md) — API Key 与静态站安全
