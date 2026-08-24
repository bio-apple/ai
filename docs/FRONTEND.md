# 前端能力

搜索、推荐、漏斗、视频页等运行时行为说明。架构见 [ARCHITECTURE.md](./ARCHITECTURE.md)。

## 1. 全站搜索

- 顶栏 + Hero；`search-index.json` + Fuse.js（`app.js`）
- 工具名可直达 `tools/*.html`；历史存 `localStorage`

## 2. 推荐助手

- `site.ai_picker` → 构建期 `recommend-rules.json`
- 场景芯片 + 现实实例 + 路径步骤（`HomeRecommend.astro`）

## 3. 内容漏斗

- `funnel.js`：统一 `journey_id` / `funnel_step`，对接 Umami / GA4

## 4. 虚拟列表

- `lib/virtual-list.js`：工具榜、GitHub 热门等长列表可视区渲染

## 5. 开源精选

- 数据：`site.oss_frameworks`（`fetch_oss_heating.py` 日更）
- 页：`oss.html`；Hero「今日升温」取 `heat_score` 最高项

## 6. 链接兜底

- `lib/link-guard.js`：外链 `noreferrer`、图片失败占位、GitHub 404 探测
- CSP 须含 `https://api.github.com`

## 7. SEO（摘要）

- TDK / OG：`data/site.json` → `meta`
- JSON-LD：`src/lib/schema.ts`（工具 / 课程 / 新闻 / 开源 ItemList + BreadcrumbList）
- 校验：`DIST=dist python3 scripts/validate_ci.py opengraph jsonld`

## 8. AI 视频（两套）

| 类型 | 入口 | 数据 |
|------|------|------|
| 首页日更 Tab | `#section-videos` | `daily-videos.latest.json`（抓取规则见 [CONTENT-OPS.md](./CONTENT-OPS.md)） |
| 用户粘贴页 | `videos.html` | `localStorage` + Cloudflare KV |

用户页：`videos.js` · `lib/video-preview*.js` · Worker `/meta` 封面。跨设备见 [CLOUDFLARE-SYNC.md](./CLOUDFLARE-SYNC.md)。

## 9. 懒加载

进入 Tab 再加载：`news.js` / `courses.js` / 首页视频脚本。`knowledge.js` idle 后加载。

## 相关

[SETUP.md](./SETUP.md) · [CONTENT-OPS.md](./CONTENT-OPS.md) · [SECURITY.md](./SECURITY.md)
