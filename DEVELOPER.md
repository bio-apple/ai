# 开发说明

线上：https://bio-apple.github.io/ai/ · 栈：Astro 5 SSG + GitHub Pages（本地可选 FastAPI 预览）。

## 目录要点

```
data/                 # 内容源（JSON）
src/pages|components  # Astro 页面
css/ + *.js           # 样式与运行时脚本
scripts/              # 构建 / 抓取 / 校验
.github/workflows/    # CI、Pages、日更/周更
dist/                 # 构建产物（不提交）
```

关键数据：`site.json` · `tools.json` · `tool-relations.json` · `engagement.json` · `rankings.json`  
运行时 JSON（根目录，定时任务写入）：`daily-videos.json` · `ai-news.json` · `oss-projects.json`  
搜索索引与推荐规则由 `scripts/build-artifacts.mjs` 生成；开源精选（含 Prompt 领域）由 `fetch_oss_stars.py` 按 AI 应用重刷（≥5万 Top5 + 中文Top1，每周一）。

## 本地

```bash
npm ci && pip install -r requirements.txt
npm run build                              # prebuild → Astro → dist/
./start.sh                                 # FastAPI 挂载 /ai/
DIST=dist python3 scripts/validate_ci.py
npm run quality && npm run test:unit
```

手动刷新：

```bash
python3 scripts/fetch_ai_news.py
python3 scripts/fetch_daily_videos.py
python3 scripts/fetch_oss_stars.py
python3 scripts/fetch_rankings.py   # AICPB / LMSYS Elo / AA Intelligence Index
```

## 构建与部署

1. `prebuild`：同步静态资源、打包 `style.css`、生成 search/recommend/analytics 等
2. `astro build` → `dist/`
3. push `main`：`ci.yml` + `pages.yml`

分析 Secrets（可选）：`UMAMI_*` · `CLOUDFLARE_BEACON_TOKEN` · `GA_MEASUREMENT_ID` / `CLARITY_PROJECT_ID`

## 定时任务（北京时间）

| 工作流             | 内容           |
| ------------------ | -------------- |
| `daily-videos.yml` | 每日视频 00:00 |
| `daily-news.yml`   | 一周热点 06:00 |
| `weekly-oss.yml`   | OSS 周一       |
| `site-health.yml`  | 线上探针       |

失败处置见 [docs/OPS-RUNBOOK.md](./docs/OPS-RUNBOOK.md)。

## 常见改动

- **新工具**：`data/tools.json` + `site.home_tool_categories` / `compare_table` + `tool-relations.json`
- **工具中心对比行**：`site.compare_table`
- **排行榜**：`data/rankings.json`

站内链接用 `src/lib/paths.ts` 的 `asset()`（base `/ai/`）。
