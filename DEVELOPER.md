# 开发说明

线上：https://bio-apple.github.io/ai/ · 栈：Astro 5 SSG + GitHub Pages（本地可选 FastAPI 预览）。

## 目录要点

```
data/                 # 内容源（JSON）
prompts/              # 高质量 Prompt 最佳实践库（分类）
src/pages|components  # Astro 页面
css/ + *.js           # 样式与运行时脚本
scripts/              # 构建 / 抓取 / 校验
.github/workflows/    # CI、Pages、日更/周更
dist/                 # 构建产物（不提交）
```

关键数据：`site.json` · `tools.json` · `tool-relations.json` · `engagement.json` · `rankings.json`  
运行时 JSON（根目录，定时任务写入）：`daily-videos.json` · `ai-news.json` · `oss-projects.json`

## 本地

```bash
npm ci && pip install -r requirements.txt
npm run build                              # prebuild → Astro → dist/
./start.sh                                 # FastAPI 挂载 /ai/
DIST=dist python3 scripts/validate_ci.py   # 12 步校验
npm run quality && npm run test:unit
```

手动刷新：

```bash
python3 scripts/fetch_ai_news.py
python3 scripts/fetch_daily_videos.py
python3 scripts/fetch_oss_stars.py
npm run optimize:images   # 封面转 WebP（可选）
```

## 构建与部署

1. `prebuild`：同步静态资源、打包 CSS、生成 search/prompts/analytics/engagement 等
2. `astro build` → `dist/`
3. push `main`：`ci.yml`（quality + build + 单测 + validate + E2E）· `pages.yml`（无 E2E，部署 Pages）
4. 可选 Cloudflare Pages：Secrets `CLOUDFLARE_API_TOKEN` / `ACCOUNT_ID` / `PROJECT_NAME`

### 分析 Secrets（隐私优先）

| Secret                                     | 用途               |
| ------------------------------------------ | ------------------ |
| `UMAMI_SCRIPT_URL` + `UMAMI_WEBSITE_ID`    | Umami（无 cookie） |
| `CLOUDFLARE_BEACON_TOKEN`                  | CF Web Analytics   |
| `GA_MEASUREMENT_ID` / `CLARITY_PROJECT_ID` | 可选               |

事件统一走 `trackEvent` / `[data-track]`；未配置时仅 `window.__clickStats`。

### 安全 / 性能（摘要）

- HTTPS：Pages 默认；自定义域名用 Cloudflare Always HTTPS
- CSP：`_headers`（CF）+ `SecurityMeta.astro`（Pages 兜底）
- 字体非阻塞 + CSS 单文件打包；封面 WebP；脚本 `defer`

## 定时任务（北京时间）

| 工作流             | 内容             |
| ------------------ | ---------------- |
| `daily-videos.yml` | 每日视频 00:00   |
| `daily-news.yml`   | 一周内热点 06:00 |
| `weekly-oss.yml`   | OSS Star 周一    |
| `site-health.yml`  | 线上新鲜度探针   |

失败处置见 [docs/OPS-RUNBOOK.md](./docs/OPS-RUNBOOK.md)。

## 常见改动

- **新工具**：`data/tools.json` + `site.json` 分类/导航 + `tool-relations.json` → `npm run build`
- **热榜数字**：`data/engagement.json`
- **排行榜**：`data/rankings.json`（同步 `site.json` 的 `rankings` 预览）

站内链接一律用 `src/lib/paths.ts` 的 `asset()`（base `/ai/`）。
