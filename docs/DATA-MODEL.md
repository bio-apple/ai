# 核心数据模型

Schema：`schemas/*.json`  
校验：`DIST=dist python3 scripts/validate_ci.py`  
展示派生：`lib/content-display.js`（相对时间、来源标记、开源人群标签、三榜推荐理由）

日更脚本必须把**展示字段和标题分开写**：标题不得粘连源站名（`量子位` / `| OpenAI`），源站放 `source`。

## 1. 文件总览

| 文件 | 位置 | 维护 | Schema / CI |
|------|------|------|-------------|
| `site.json` | `data/` | 手工 | 文档约定 · `data` |
| `tools.json` / `compares.json` / `rankings.json` | `data/` | 手工 / 日更 | `data` |
| `tool-relations.json` | `data/` | 手工 | `tool-relations.schema.json` |
| `engagement.json` | `data/` | 手工 | `engagement.schema.json` |
| `local-deploy.json` | `data/` | 手工 | `local-deploy.schema.json` |
| `oss-projects.json` | `data/` | 日更 | 同步到 `site.oss_frameworks` |
| `ai-news.json` | 根 | 日更 | `ai-news.schema.json` |
| `ai-courses.json` | 根 | 日更 | `ai-courses.schema.json` |
| `daily-videos.json` | 根 | 手动日更 | `daily-videos.schema.json` |
| `daily-videos.latest.json` | dist | prebuild 瘦身 | — |
| `search-index.json` / `recommend-rules.json` | dist | prebuild | 对应 schema |

交叉引用（CI 强制）：`tool-relations` ⊆ `tools`；`ai_picker.tools` 可解析。

## 2. `site.json` 要点

全站中枢，Astro `src/lib/data.ts` 构建期 import。

| 字段 | 说明 |
|------|------|
| `meta` | TDK / OG / `base_url` |
| `nav` / `hero` / `footer` | 导航与首页 |
| `home_tool_categories` / `ai_picker` | 工具卡与推荐场景 |
| `oss_frameworks` | 开源升温（`fetch_oss_heating.py` 写入，字段与 `oss-projects.items` 对齐） |
| `video_preview_sync` | `{ api_url, shared_key }` → `#video-sync-config` |

细节以仓库内 JSON 为准；改导航/文案见 [DEVELOPER.md](../DEVELOPER.md)。

## 3. 运行时抓取 JSON

### 3.1 `ai-news.json` · NewsItem

根：`updated_at`, `date`, `window_hours`, `items[]`, `watch_sources[]`

| 字段 | 必填 | 说明 |
|------|------|------|
| `title` | 是 | 纯标题；写入前 `clean_news_items` 去掉尾部源站 |
| `url` | 是 | 原文链接 |
| `source` | 推荐 | 独立源站名（量子位 / OpenAI / GitHub Trending） |
| `published_at` | 推荐 | ISO8601 +08:00，前端显示相对时间 |
| `category` | 否 | 新模型发布 / 开源项目 / 行业新闻… |
| `summary` | 否 | ≤160 字 |
| `id` | 否 | `sha1(url)[:12]` |

展示层再跑一遍 `displayNewsTitle`，防止旧快照粘连。来源用 `news-source-chip`（标记 + 标签），不用把源站拼进标题。

### 3.2 `oss-projects.json` · OssItem

根：`updated_at`, `window`, `items[]`  
`site.oss_frameworks` 是同一套字段的精简同步。开源页优先读 `oss-projects.json`。

| 字段 | 说明 |
|------|------|
| `repo` / `name` / `stars` / `category` | 基础 |
| `summary` | GitHub description，卡片「一句话」 |
| `heat_score` | 排序用；展示写成「日榜 #N · 热度 205」 |
| `sources` | `trending:daily` / `trending:weekly` / `search` / `priority` |
| `rank` | 方向内 1–3 |
| `trending_daily_rank` / `trending_weekly_rank` | 可空 |
| `pushed_at` / `created_at` | ISO 时间 |
| `stars_weekly` | 按仓库年龄估算的周均 Star |
| `stars_delta` | 相对上次快照的 Star 差 |
| `is_new` / `is_fastest` | 上周新增 / 方向内上升最快 |

构建期再派生 `audienceTags`（如 `Coding Agent` / `写代码` / `社区主流`），不写回 JSON。

### 3.3 `rankings.json` · 三榜

根：`month`, `month_label`, `updated_at`（`YYYY-MM-DD`）, `boards[]`, `highlights[]`

`boards[].items[]`：

| 字段 | 说明 |
|------|------|
| `rank` / `name` / `url` | 基础 |
| `visits` | 主指标（访问量 / Elo / Index） |
| `mom` | 次指标（月环比 / votes / 厂商） |
| `description` | 厂商或备注，可空 |
| `mom_bar_pct` | AICPB 柱宽 |
| `pick_reason` | 可选；未写则 `rankingPickReason(name, board.id)` 补「为什么选」 |

页头必须醒目写出 `updated_at` + 相对时间。

### 3.4 `compares.json` · 对比页

每条对比专题：`slug` / `h1` / `table` / `sections` / `cta`。

选型辅助（构建期快照，不是运行时爬官网）：

| 字段 | 说明 |
|------|------|
| `pricing.checked_at` | `YYYY-MM-DD`，页上写核验日 + 官网实时价链接 |
| `pricing.products[].plans` | 档位名、价格、一句说明；`highlight` 标常用档 |
| `feature_matrix.rows[].cells` | `{ level: yes\|partial\|no, text }` |
| `reviews.items[]` | 编辑根据公开讨论写的摘要，必须有 `disclaimer`，禁止伪造星级 |

价格以各产品 `official_url` 为准；仓库里的数字随对比页一起改。

### 3.5 其他

| 文件 | 关键字段 |
|------|----------|
| `ai-courses.json` | `updated_at`, 按 track 分组的课程 |
| `daily-videos.json` | `updated_at`, `batches[]`；CDN 只用 slim `latest` |

## 4. 校验

```bash
npm run build
DIST=dist python3 scripts/validate_ci.py
# 单项：data | news | courses | videos | secrets | opengraph | jsonld
```

## 相关

[ARCHITECTURE.md](./ARCHITECTURE.md) · [CONTENT-OPS.md](./CONTENT-OPS.md) · `schemas/`
