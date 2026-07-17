# 开发说明

线上：https://bio-apple.github.io/ai/  
栈：Astro 5 SSG + GitHub Pages（本地可选 FastAPI 预览 `./start.sh`）。

## 目录要点

```
data/                 # 内容源（JSON）
src/pages|components  # Astro 页面
css/ + *.js           # 样式与运行时脚本（courses.js / news.js / videos.js …）
lib/                  # 共享前端工具（fetch-json.js）
config/               # 抓取配置（courses / news / video / oss）
scripts/              # 构建 / 抓取 / 校验
schemas/              # JSON Schema（CI 门禁）
.github/workflows/    # CI、Pages、日更/周更
dist/                 # 构建产物（不提交）
```

## 数据文件

| 文件                   | 来源                              | 刷新       |
| ---------------------- | --------------------------------- | ---------- |
| `data/site.json` 等    | 手工维护                          | 随代码发布 |
| `daily-videos.json`    | `fetch_daily_videos.py`           | 每日       |
| `ai-news.json`         | `fetch_ai_news.py`                | 每日       |
| `oss-projects.json`    | `fetch_oss_stars.py`              | 每周一     |
| `ai-courses.json`      | `fetch_ai_courses.py`             | 每周一     |
| `search-index.json`    | `build-artifacts.mjs`（prebuild） | 每次构建   |
| `recommend-rules.json` | `build-artifacts.mjs`             | 每次构建   |

`prebuild` 会把根目录运行时 JSON 与静态 JS/CSS 同步到 `public/`，再经 Astro 打进 `dist/`。

**前端共享层**（`lib/fetch-json.js`）：统一 JSON 拉取（重试 / 超时 / 内存缓存）、`escapeHtml`、外链 `rel`、错误重试 UI。懒加载频道脚本由 `lazy-sections.js` 保证先加载 `lib/`。

**性能**：视频 Tab 使用 `daily-videos.latest.json`（prebuild 从完整 JSON 截取近 2 批）；首页已移除重复的嵌入式工具教程区块。

## 课程资源

**产品定义**（`config/courses-fetch.yaml`）：

- 仅收录 **免费** 课程
- 五条路线：`入门` → `机器学习` → `深度学习` → `LLM 大模型` → `AI Agent`
- 每条路线最多 **5** 门（`dedupe.max_per_track`）；必学 / 合集优先
- 必收录核心课 + 近 180 天补充课（Hugging Face Learn / Coursera 免费课 / YouTube AI 向）

**必收录 URL**（CI 校验）：

- Microsoft Generative AI for Beginners
- Google Machine Learning Crash Course
- Coursera：Machine Learning、Deep Learning Specialization
- Stanford：CS231n、CS224n、CS336
- DeepLearning.AI 短课程合集（`hubs`，不与 `/courses/*` 单课并列）

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

## 新闻与开源

- 新闻去重：`scripts/news_dedupe.py`（标题 + URL，保留最新 `published_at`）
- 抓取时 **排除** 已在 `oss-projects.json` 中的 GitHub 仓库 URL，避免首页 Daily 与「开源精选」重复
- 首页 `pickAiDailyBrief`（`src/lib/runtime.ts`）GitHub 面板同样过滤 OSS 已收录仓库

## 本地开发

```bash
npm ci && pip install -r requirements.txt
npm run build                              # prebuild → Astro → dist/
./start.sh                                 # FastAPI 挂载 /ai/
DIST=dist python3 scripts/validate_ci.py
npm run quality && npm run test:unit
```

手动刷新运行时数据：

```bash
python3 scripts/fetch_ai_news.py
python3 scripts/fetch_daily_videos.py
python3 scripts/fetch_oss_stars.py
python3 scripts/fetch_ai_courses.py
python3 scripts/fetch_rankings.py   # AICPB / LMSYS Elo / AA Intelligence Index
cp ai-courses.json ai-news.json public/   # 本地预览需同步到 public/
npm run build
```

## 构建与部署

1. `prebuild`（`scripts/prebuild.mjs`）：清空 `public/` → 同步静态资源 → 打包 CSS → 生成 search / recommend / analytics
2. `astro build` → `dist/`
3. push `main`：`.github/workflows/ci.yml` 校验 → `pages.yml` 部署

分析 Secrets（可选）：`UMAMI_*` · `CLOUDFLARE_BEACON_TOKEN` · `GA_MEASUREMENT_ID` / `CLARITY_PROJECT_ID`

## 定时任务（北京时间）

| 工作流                  | 内容           |
| ----------------------- | -------------- |
| `daily-videos.yml`      | 每日视频 00:00 |
| `daily-news.yml`        | 一周热点 06:00 |
| `weekly-oss.yml`        | OSS 精选 周一  |
| `weekly-courses.yml`    | 课程资源 周一  |
| `site-health.yml`       | 线上探针       |
| `weekly-link-check.yml` | 外链抽检       |

失败处置见 [docs/OPS-RUNBOOK.md](./docs/OPS-RUNBOOK.md)。

## 常见改动

- **新工具**：`data/tools.json` + `site.home_tool_categories` / `compare_table` + `tool-relations.json`
- **新必学课程**：`config/courses-fetch.yaml` → `required` 或 `hubs`，并更新 `validate_ci.py` 中 `REQUIRED_COURSE_URLS`
- **调整路线**：改 `track_order` / `track_keywords`，重跑 `fetch_ai_courses.py`
- **工具中心对比行**：`site.compare_table`
- **排行榜**：`data/rankings.json`

站内链接用 `src/lib/paths.ts` 的 `asset()`（base `/ai/`）。
