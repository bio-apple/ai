# Bio AI Lab

**AI 工具 · 开源 · 新闻 · 视频** — 国内国际热门工具分类/排行/对比、工具关系导航、GitHub Stars 六领域、一周内 AI 热点与六类每日视频。

**Website:** https://bio-apple.github.io/ai/

[![Website](https://img.shields.io/badge/Website-bio--apple.github.io%2Fai-6366F1?style=for-the-badge)](https://bio-apple.github.io/ai/)
[![Documentation](https://img.shields.io/badge/Documentation-DEVELOPER.md-06B6D4?style=for-the-badge)](./DEVELOPER.md)
[![Vision 2.0](https://img.shields.io/badge/Vision-2.0-8B5CF6?style=for-the-badge)](./docs/VISION-2.0.md)
[![GitHub](https://img.shields.io/badge/GitHub-bio--apple%2Fai-111827?style=for-the-badge)](https://github.com/bio-apple/ai)

## Screenshot

| 首页 Hero | 工具与排行 | 视频 / 开源 / 新闻 |
|-----------|------------|-------------------|
| ![首页](og-image.jpg) | 国内国际分类 + 排行对比 | 六类视频 · Stars · 一周内热点 |

> 线上预览：[https://bio-apple.github.io/ai/](https://bio-apple.github.io/ai/)

## Features

| 功能 | 支持 |
|------|------|
| 国内/国际 AI 工具分类、排行与对比 | ✅ |
| 工具详情教程页 + **替代/互补关系** | ✅ |
| AI 推荐助手（场景 + 文本，附带相关工具） | ✅ |
| 站内搜索（Fuse.js，案例/Prompt 深链） | ✅ |
| 学习回访（最近打开 + 路线阶段勾选，localStorage） | ✅ |
| GitHub Stars 开源精选（6 大领域，每领域 ≥1） | ✅ |
| **一周内 AI 热点**（每天更新 · 近 7 天窗口） | ✅ |
| 每日六类视频（YouTube + B站 100d / 30d / 24h） | ✅ |
| Astro SSG + GitHub Pages + SEO（sitemap `.html` / BreadcrumbList） | ✅ |

> Prompt 库 / 案例库 / 学习路线等为 **独立页 / Labs 入口**，**不进首页主栏与主导航「案例」**（SEO 页仍保留）。

## 生产说明

**GitHub Pages 线上为纯静态站，没有 `/api/*`。** Docker / Render / 本地 FastAPI（`./start.sh`）仅用于本机或自建预览，勿默认当成线上能力。

## 涵盖工具

| 类型 | 工具 |
|------|------|
| 国际对话 AI | ChatGPT、Claude、Gemini |
| 国内对话 AI | Kimi、通义千问、豆包、DeepSeek |
| 编程与开发 AI | Cursor、Codex、Copilot |

工具之间通过 [`data/tool-relations.json`](./data/tool-relations.json) 维护 **同类替代** 与 **互补搭配**，展示在工具详情页与工具中心。

## 内容模块

### 1. AI 视频（每日更新）

北京时间每日 0:00 自动抓取，分 **六类推荐**（页面展示顺序：各平台 **100d → 30d → 24h**；同平台跨分类去重）：

| 平台 | 分类 | 数量 | 最低播放量 |
|------|------|------|------------|
| YouTube | 100 天内上新 Top 10 | 10 | 10 万 |
| YouTube | 30 天内上新 Top 5 | 5 | 1 万 |
| YouTube | 24 小时内上新 Top 3 | 3 | 1000 |
| B站 | 100 天内上新 Top 10 | 10 | 10 万 |
| B站 | 30 天内上新 Top 5 | 5 | 1 万 |
| B站 | 24 小时内上新 Top 3 | 3 | 1000 |

### 2. 工具、分类、排行与比较

- 首页：国际/国内/编程三大类工具卡片
- 工具关系：替代（可切换）+ 互补（常一起用）
- 2026 AI 工具排行榜（**按月**：用户量 / 模型能力 / 价格）+ 首页对比表预览
- 独立对比专题页（Cursor vs Copilot、ChatGPT vs DeepSeek 等）

### 3. GitHub Stars 开源精选（每周刷新 Star）

六大应用领域，每领域至少 1 个代表项目：

| 领域 | 代表项目 |
|------|----------|
| AI Agent | LangGraph、crewAI |
| LLM 应用开发 | Dify、LlamaIndex |
| 本地大模型 | Ollama、llama.cpp |
| AI 绘画 | ComfyUI、Stable Diffusion WebUI |
| 多模态 | LLaVA、Transformers |
| 机器学习框架 | PyTorch、JAX |

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

| 环节 | 实现 |
|------|------|
| 搜索 | Hero Fuse 搜索；案例 → `cases/index.html#case-N`；Prompt 深链 |
| 推荐 | 场景/文本匹配 + 结果附带替代/互补 |
| 学习 | `progress.js` 最近打开；路线图阶段勾选；收藏清单 |
| SEO | sitemap 对齐 `.html`；Standalone OG；BreadcrumbList |

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

## 快速开始

### 本地预览

```bash
cd ai
npm ci
pip install -r requirements.txt
./build.sh          # Astro SSG → dist/
./start.sh          # FastAPI 预览 dist/
```

访问 http://127.0.0.1:8765/ai/（`/` 会重定向到 `/ai/`）

### 本地校验与 E2E

```bash
npm run build
DIST=dist python3 scripts/validate_ci.py          # 全量校验（与 CI 一致，11 步）
DIST=dist python3 scripts/validate_ci.py links    # 单步：HTML 内部链接（含 /ai/ 绝对路径）
npm run test:unit                                 # Node + Python 轻量单测
npx playwright install chromium                   # 首次运行 E2E 需安装浏览器
npm run test:e2e                                  # Playwright 冒烟（约 12 项；失败会红 CI）
```

> **必绿（合并 / Pages）**：`validate_ci.py`。  
> **必绿（CI job）**：另含单元测 + FastAPI smoke + Playwright E2E（E2E 失败会使 CI 失败；**Pages 工作流不跑 E2E**，避免浏览器不稳挡发版）。  
> **分析**：仓库默认可空 GA ID；在 GitHub Secrets 设 `GA_MEASUREMENT_ID` / `CLARITY_PROJECT_ID` 后构建即启用（见 `docs/ANALYTICS-EVENTS.md`）。  
> 线上健康：`npm run health:live` 或定时 `site-health.yml`（内容过期会开 Issue）。

### 手动刷新动态数据

```bash
pip install yt-dlp pyyaml
python scripts/fetch_daily_videos.py   # 每日视频
python scripts/fetch_ai_news.py        # 一周内 AI 热点（日更抓取）
python scripts/fetch_oss_stars.py      # 开源 Star 数
```

**开发者文档**：[DEVELOPER.md](./DEVELOPER.md)（架构、数据格式、CI/CD、故障排查）

## 自动更新

| 内容 | 时间（北京时间） | 工作流 |
|------|------------------|--------|
| AI 视频（六类） | 每日 00:00 | `daily-videos.yml` |
| 一周内 AI 热点 | 每日 06:00 | `daily-news.yml` |
| 开源 Star | 每周一 06:00 | `weekly-oss.yml` |

推送 `main` 后，GitHub Actions 自动构建 `dist/` 并部署到 GitHub Pages。

## 质量保障与 CI

`push` / `PR` 触发 [`.github/workflows/ci.yml`](.github/workflows/ci.yml)：

| 阶段 | 说明 |
|------|------|
| Astro 构建 | `npm ci && npm run build` → `dist/`（Secrets 可注入 GA/Clarity） |
| 单元测试 | `npm run test:unit`（paths / 视频回退 / 新闻去重） |
| 数据校验（11 步） | `validate_ci.py`：data · **tool-relations** · oss · videos · news · runtime · recommend · sitemap · search · analytics · links |
| API 冒烟 | `scripts/smoke_api.py`（本地 FastAPI；生产 Pages **无** `/api/*`） |
| E2E | Playwright 冒烟 ≈12 项；**失败会使 CI 红**；Pages 部署流水线不跑 E2E |

`main` 推送触发 [`.github/workflows/pages.yml`](.github/workflows/pages.yml)：`build + validate` → 上传 `dist` artifact → 部署。**不跑 E2E**，避免浏览器不稳定挡住内容上线。

**链接约定**：站内资源与回首页统一使用 Astro `base`（`/ai/...`），由 `src/lib/paths.ts` 的 `asset()` 生成；勿再硬编码相对 `tools/...` 而不带 base。

## 技术栈

| 层级 | 技术 |
|------|------|
| 构建 | Astro 5 SSG |
| 内容 | `data/*.json`（含 `tool-relations.json` · `rankings.json`） |
| 样式/交互 | 原生 CSS + JavaScript |
| 搜索 | Fuse.js + `search-index.json` |
| 动态数据 | `daily-videos.json` · `ai-news.json` · `oss-projects.json` |
| 部署 | GitHub Pages + GitHub Actions |

## Roadmap

| 阶段 | 内容 | 状态 |
|------|------|------|
| Phase 1 | 首页重构、新导航、工具卡片、UI 升级 | ✅ 已完成 |
| Phase 2 | 排行榜、选择助手、新闻、创作区、指南页 | ✅ 已完成 |
| Phase 2.5 | Prompt 库、案例库、视频筛选、JSON 导出 | ✅ 已完成 |
| Phase 3 | Astro SSG、六类视频、开源精选、每日新闻扩展信源 | ✅ 已完成 |
| Phase 3.5 | 智源社区聚合、新闻信源多样性、CI 校验 + API smoke + Playwright E2E | ✅ 已完成 |
| Phase 3.6 | Pages/E2E 解耦、`/ai` 本地对齐、资源路径统一、懒加载与缓存 | ✅ 已完成 |
| Phase 3.7 | 运维健康探针、抓取告警、Dependabot、CI 信号治理 | ✅ 已完成 |
| Phase 3.8 | 首页瘦身 + 新闻/开源/视频预览 SSG 内联 | ✅ 已完成 |
| Phase 3.9 | 主路径：推荐 → 简报 → 工具 → 收藏（学习/案例入 Labs·独立页） | ✅ 已完成 |
| Phase 3.10 | GA Secrets 注入、a11y、asset() 统一、单元测 + E2E 边角 | ✅ 已完成 |
| Phase 4 | 本地收藏、搜索增强、对话式推荐、AI Labs、工具中心 | ✅ 已完成 |
| Phase 4.1 | 工具关系（替代/互补）+ 搜索/推荐/学习回访/SEO 链路 | ✅ 已完成 |
| Phase 4.2 | 「一周内 AI 热点」日更 · 近 7 天窗口 | ✅ 已完成 |
| Phase 5 | 云端账户 / 向量 RAG / 真 LLM Agent（需独立托管） | 🔜 规划中 |

## License

MIT — see [GitHub repository](https://github.com/bio-apple/ai).
