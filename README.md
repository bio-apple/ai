# Bio AI Lab

<p align="center">
  <strong>Bio-Apple · AI 工具导航 · 开源精选 · 每日热点与视频</strong><br/>
  发现、学习并搭建属于你的 AI 工作流
</p>

<p align="center">
  <a href="https://bio-apple.github.io/ai/"><img src="https://img.shields.io/badge/Website-Live-2563eb?style=for-the-badge&logo=githubpages&logoColor=white" alt="Website" /></a>
  <a href="https://github.com/bio-apple/ai/stargazers"><img src="https://img.shields.io/github/stars/bio-apple/ai?style=for-the-badge&logo=github&color=111827" alt="GitHub Stars" /></a>
  <a href="https://github.com/bio-apple/ai/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/bio-apple/ai/ci.yml?branch=main&style=for-the-badge&label=CI" alt="CI" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-0d8c6d?style=for-the-badge" alt="MIT" /></a>
  <a href="https://astro.build"><img src="https://img.shields.io/badge/Astro-5-FF5D01?style=for-the-badge&logo=astro&logoColor=white" alt="Astro" /></a>
</p>

<p align="center">
  <a href="https://bio-apple.github.io/ai/">🌐 在线站点</a> ·
  <a href="https://github.com/bio-apple/ai">⭐ Star on GitHub</a> ·
  <a href="./DEVELOPER.md">📘 开发者文档</a> ·
  <a href="./docs/VISION-2.0.md">🔭 Vision 2.0</a>
</p>

![Bio AI Lab 首页预览](og-image.jpg)

## Quick Start

```bash
git clone https://github.com/bio-apple/ai.git
cd ai
npm ci
pip install -r requirements.txt
./build.sh          # Astro SSG → dist/
./start.sh          # 本地预览 dist/（FastAPI）
```

打开 http://127.0.0.1:8765/ai/  
常用校验：`npm run quality && npm run build && DIST=dist python3 scripts/validate_ci.py`

## 架构一览

```mermaid
flowchart LR
  subgraph Content["内容源 data/*.json"]
    T[tools / relations]
    N[news / videos / oss]
  end
  subgraph Build["GitHub Actions"]
    Q[Prettier + ESLint]
    B[Astro SSG]
    V[validate_ci]
  end
  subgraph Edge["分发"]
    P[GitHub Pages]
    C[可选 Cloudflare CDN]
  end
  subgraph Product["用户路径"]
    S[搜索] --> R[推荐]
    R --> L[学习回访]
    L --> G[Star on GitHub]
  end
  Content --> Q --> B --> V --> P
  V --> C
  P --> Product
```

## Features

| 功能                                                               | 支持 |
| ------------------------------------------------------------------ | ---- |
| 国内/国际 AI 工具分类、排行与对比                                  | ✅   |
| 工具详情教程页 + **替代/互补关系**                                 | ✅   |
| AI 推荐助手（场景 + 文本，附带相关工具）                           | ✅   |
| 站内搜索（Fuse.js，案例/Prompt 深链）                              | ✅   |
| 学习回访（最近打开 + 路线阶段勾选，localStorage）                  | ✅   |
| GitHub Stars 开源精选（6 大领域，每领域 ≥1）                       | ✅   |
| **一周内 AI 热点**（每天更新 · 近 7 天窗口）                       | ✅   |
| 每日六类视频（YouTube + B站 100d / 30d / 24h）                     | ✅   |
| Astro SSG + GitHub Pages + SEO（sitemap `.html` / BreadcrumbList） | ✅   |

> Prompt 库 / 案例库 / 学习路线等为 **独立页 / Labs 入口**，**不进首页主栏与主导航「案例」**（SEO 页仍保留）。

## 生产说明

**GitHub Pages 线上为纯静态站，没有 `/api/*`。** Docker / Render / 本地 FastAPI（`./start.sh`）仅用于本机或自建预览，勿默认当成线上能力。

## 涵盖工具

| 类型          | 工具                           |
| ------------- | ------------------------------ |
| 国际对话 AI   | ChatGPT、Claude、Gemini        |
| 国内对话 AI   | Kimi、通义千问、豆包、DeepSeek |
| 编程与开发 AI | Cursor、Codex、Copilot         |

工具之间通过 [`data/tool-relations.json`](./data/tool-relations.json) 维护 **同类替代** 与 **互补搭配**，展示在工具详情页与工具中心。

## 内容模块

### 1. AI 视频（每日更新）

北京时间每日 0:00 自动抓取，分 **六类推荐**（页面展示顺序：各平台 **100d → 30d → 24h**；同平台跨分类去重）：

| 平台    | 分类                | 数量 | 最低播放量 |
| ------- | ------------------- | ---- | ---------- |
| YouTube | 100 天内上新 Top 10 | 10   | 10 万      |
| YouTube | 30 天内上新 Top 5   | 5    | 1 万       |
| YouTube | 24 小时内上新 Top 3 | 3    | 1000       |
| B站     | 100 天内上新 Top 10 | 10   | 10 万      |
| B站     | 30 天内上新 Top 5   | 5    | 1 万       |
| B站     | 24 小时内上新 Top 3 | 3    | 1000       |

### 2. 工具、分类、排行与比较

- 首页：国际/国内/编程三大类工具卡片
- 工具关系：替代（可切换）+ 互补（常一起用）
- 2026 AI 工具排行榜（**按月**：用户量 / 模型能力 / 价格）+ 首页对比表预览
- 独立对比专题页（Cursor vs Copilot、ChatGPT vs DeepSeek 等）

### 3. GitHub Stars 开源精选（每周刷新 Star）

六大应用领域，每领域至少 1 个代表项目：

| 领域         | 代表项目                        |
| ------------ | ------------------------------- |
| AI Agent     | LangGraph、crewAI               |
| LLM 应用开发 | Dify、LlamaIndex                |
| 本地大模型   | Ollama、llama.cpp               |
| AI 绘画      | ComfyUI、Stable Diffusion WebUI |
| 多模态       | LLaVA、Transformers             |
| 机器学习框架 | PyTorch、JAX                    |

### 4. 一周内 AI 热点（每天更新）

北京时间每日 6:00 自动汇总**近 7 天**热点（`max_age_days: 7`，`cadence: daily`）：

- **公司动态**：OpenAI、Anthropic、Google DeepMind、Google AI、NVIDIA、Microsoft（RSS / 官网）
- **中文媒体**：智源社区聚合、量子位 RSS；关注面板含机器之心、新智元
- **关注面板**：Meta AI、Hugging Face 等（博客 + X）
- **技术源**：GitHub Trending、arXiv（cs.AI / cs.LG / cs.CL / cs.CV）

## 发现链路（产品主路径）

```
搜索找到内容 → 推荐选工具 → 学习体系愿意回来 → SEO 被发现
```

| 环节 | 实现                                                              |
| ---- | ----------------------------------------------------------------- |
| 搜索 | Hero Fuse 搜索；案例 → `cases/index.html#case-N`；Prompt 深链     |
| 推荐 | 场景/文本匹配 + 结果附带替代/互补                                 |
| 学习 | `progress.js` 最近打开；路线图阶段勾选；收藏清单                  |
| SEO  | 强化 TDK 长尾词；OG/Twitter Card；sitemap `.html`；BreadcrumbList |
| 分析 | 隐私优先 Umami / Cloudflare Web Analytics（可选 GA/Clarity）      |
| 闭环 | 首页 / 导航 / 页脚 **Star on GitHub**                             |

## 页面结构

```
首页主路径
├── Hero + 站内搜索
├── 推荐助手 → AI 简报 → 收藏 / 继续学习
├── 热门工具 + 更多分类
├── 开源预览
└── 继续深入（工具中心 / Labs / 排行 / 案例 + 对比卡）

Tab / 分区（同页 SPA）
├── 各工具详情教程
├── 开源精选完整列表
├── 一周内 AI 热点 + 持续关注源
└── 六类视频完整列表

独立页
├── /tools/{tool}.html · /tools/hub.html
├── /labs/ · /cases/ · /prompts/ · /ai-learning-roadmap.html
├── /ai-tools-ranking.html
├── /news/daily-ai-news.html
└── /compare/*.html
```

## 本地校验与 E2E

```bash
npm run quality                                   # Prettier + ESLint
npm run build
DIST=dist python3 scripts/validate_ci.py          # 全量校验（与 CI 一致，11 步）
npm run test:unit
npx playwright install chromium                   # 首次 E2E
npm run test:e2e
```

> **必绿（合并 / Pages）**：`npm run quality` + `validate_ci.py`。  
> **必绿（CI job）**：另含单元测 + FastAPI smoke + Playwright E2E（Pages 工作流不跑 E2E）。  
> **分析（隐私优先）**：Secrets 配 `UMAMI_*` / `CLOUDFLARE_BEACON_TOKEN`（可选再开 GA/Clarity），见 [`docs/ANALYTICS-EVENTS.md`](./docs/ANALYTICS-EVENTS.md)。  
> **CDN / HTTPS / CSP**：[`docs/DEPLOY-CDN-SECURITY.md`](./docs/DEPLOY-CDN-SECURITY.md) · **性能**：[`docs/PERFORMANCE.md`](./docs/PERFORMANCE.md)。  
> 线上健康：`npm run health:live` 或定时 `site-health.yml`。

### 手动刷新动态数据

```bash
pip install yt-dlp pyyaml
python scripts/fetch_daily_videos.py   # 每日视频
python scripts/fetch_ai_news.py        # 一周内 AI 热点（日更抓取）
python scripts/fetch_oss_stars.py      # 开源 Star 数
```

**开发者文档**：[DEVELOPER.md](./DEVELOPER.md)

## 自动更新

| 内容            | 时间（北京时间） | 工作流             |
| --------------- | ---------------- | ------------------ |
| AI 视频（六类） | 每日 00:00       | `daily-videos.yml` |
| 一周内 AI 热点  | 每日 06:00       | `daily-news.yml`   |
| 开源 Star       | 每周一 06:00     | `weekly-oss.yml`   |

推送 `main` 后，GitHub Actions 依次跑 **Prettier/ESLint → Build → Validate → Deploy GitHub Pages**；可选再发一版到 Cloudflare Pages（需 Secrets）。详见 [`docs/DEPLOY-CDN-SECURITY.md`](./docs/DEPLOY-CDN-SECURITY.md)。

## 质量保障与 CI

`push` / `PR` 触发 [`.github/workflows/ci.yml`](.github/workflows/ci.yml)：

| 阶段              | 说明                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Lint & Format     | `npm run quality`（Prettier check + ESLint）                                                                                   |
| Astro 构建        | `npm ci && npm run build` → `dist/`（Secrets 可注入 Umami / CF / GA / Clarity）                                                |
| 单元测试          | `npm run test:unit`（paths / 视频回退 / 新闻去重）                                                                             |
| 数据校验（11 步） | `validate_ci.py`：data · **tool-relations** · oss · videos · news · runtime · recommend · sitemap · search · analytics · links |
| API 冒烟          | `scripts/smoke_api.py`（本地 FastAPI；生产 Pages **无** `/api/*`）                                                             |
| E2E               | Playwright 冒烟 ≈12 项；**失败会使 CI 红**；Pages 部署流水线不跑 E2E                                                           |

`main` 推送触发：

| 工作流                  | 说明                                                                 |
| ----------------------- | -------------------------------------------------------------------- |
| `pages.yml`             | quality → build + validate → 上传 artifact → **Deploy GitHub Pages** |
| `deploy-cloudflare.yml` | **可选**：同一 `dist/` 发到 Cloudflare Pages（Secrets 未配则跳过）   |

Pages **不跑 E2E**，避免浏览器不稳定挡住内容上线。

**链接约定**：站内资源与回首页统一使用 Astro `base`（`/ai/...`），由 `src/lib/paths.ts` 的 `asset()` 生成；勿再硬编码相对 `tools/...` 而不带 base。

## 技术栈

| 层级      | 技术                                                        |
| --------- | ----------------------------------------------------------- |
| 构建      | Astro 5 SSG                                                 |
| 内容      | `data/*.json`（含 `tool-relations.json` · `rankings.json`） |
| 样式/交互 | 原生 CSS + JavaScript                                       |
| 搜索      | Fuse.js + `search-index.json`                               |
| 动态数据  | `daily-videos.json` · `ai-news.json` · `oss-projects.json`  |
| 部署      | GitHub Pages + GitHub Actions（可选 Cloudflare Pages CDN）  |
| 安全      | HTTPS 强制 + CSP（`_headers` / meta 兜底）                  |
| 分析      | Umami / Cloudflare Web Analytics（可选 GA4 + Clarity）      |
| SEO       | TDK 长尾词 + Open Graph / Twitter Card                      |

## Roadmap

| 阶段       | 内容                                                               | 状态      |
| ---------- | ------------------------------------------------------------------ | --------- |
| Phase 1    | 首页重构、新导航、工具卡片、UI 升级                                | ✅ 已完成 |
| Phase 2    | 排行榜、选择助手、新闻、创作区、指南页                             | ✅ 已完成 |
| Phase 2.5  | Prompt 库、案例库、视频筛选、JSON 导出                             | ✅ 已完成 |
| Phase 3    | Astro SSG、六类视频、开源精选、每日新闻扩展信源                    | ✅ 已完成 |
| Phase 3.5  | 智源社区聚合、新闻信源多样性、CI 校验 + API smoke + Playwright E2E | ✅ 已完成 |
| Phase 3.6  | Pages/E2E 解耦、`/ai` 本地对齐、资源路径统一、懒加载与缓存         | ✅ 已完成 |
| Phase 3.7  | 运维健康探针、抓取告警、Dependabot、CI 信号治理                    | ✅ 已完成 |
| Phase 3.8  | 首页瘦身 + 新闻/开源/视频预览 SSG 内联                             | ✅ 已完成 |
| Phase 3.9  | 主路径：推荐 → 简报 → 工具 → 收藏（学习/案例入 Labs·独立页）       | ✅ 已完成 |
| Phase 3.10 | GA Secrets 注入、a11y、asset() 统一、单元测 + E2E 边角             | ✅ 已完成 |
| Phase 4    | 本地收藏、搜索增强、对话式推荐、AI Labs、工具中心                  | ✅ 已完成 |
| Phase 4.1  | 工具关系（替代/互补）+ 搜索/推荐/学习回访/SEO 链路                 | ✅ 已完成 |
| Phase 4.2  | 「一周内 AI 热点」日更 · 近 7 天窗口                               | ✅ 已完成 |
| Phase 4.3  | SEO TDK/OG、隐私分析、README 门面、Star 闭环                       | ✅ 已完成 |
| Phase 5    | 云端账户 / 向量 RAG / 真 LLM Agent（需独立托管）                   | 🔜 规划中 |

## License

MIT — 欢迎 [⭐ Star](https://github.com/bio-apple/ai) 与 PR：[bio-apple/ai](https://github.com/bio-apple/ai)。
