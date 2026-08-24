# 核心数据模型

Schema：`schemas/*.json`  
校验：`DIST=dist python3 scripts/validate_ci.py`

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
| `oss_frameworks` | 开源升温（脚本写入） |
| `video_preview_sync` | `{ api_url, shared_key }` → `#video-sync-config` |

细节以仓库内 JSON 为准；改导航/文案见 [DEVELOPER.md](../DEVELOPER.md)。

## 3. 运行时抓取 JSON

| 文件 | 关键字段 |
|------|----------|
| `ai-news.json` | `updated_at`, `items[]`（title/url/source/category/published_at） |
| `oss-projects.json` | `updated_at`, `items[]`（repo/stars/heat_score/category） |
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
