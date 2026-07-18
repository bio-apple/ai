# 前端能力说明

本文汇总浏览器端已落地的产品与工程能力（与 `*.js` / `src/components` / `lib/` 对应）。

线上：https://bio-apple.github.io/ai/

---

## 1. 全局搜索

| 项   | 说明                                                                     |
| ---- | ------------------------------------------------------------------------ |
| 入口 | 顶栏（全站）+ 首页 Hero（`GlobalSearch.astro`）                          |
| 索引 | 构建时 `scripts/build-artifacts.mjs` → `search-index.json`（约 180+ 条） |
| 覆盖 | 工具、对比、资讯、开源仓库、课程、视频、排行榜模型名                     |
| 联想 | 聚焦空输入显示 `site.hero.search_suggestions` chips                      |
| 历史 | `localStorage` 键 `bioai.search.history.v1`（最多 8 条）                 |
| 引擎 | Fuse.js（`vendor/fuse.min.js`）                                          |

本地验收：`npm run build && DIST=dist python3 scripts/validate_ci.py search`

---

## 2. 内容漏斗与分析

见 **[CONTENT-FUNNEL.md](./CONTENT-FUNNEL.md)**。

| 脚本            | 作用                                                        |
| --------------- | ----------------------------------------------------------- |
| `funnel.js`     | `journey_id`、`funnel_step`、`funnel_entry`、`section_view` |
| `analytics.js`  | Umami / CF / GA4 / Clarity；`trackEvent` 统一出口           |
| `engagement.js` | 首页运营热度 widget（本地累加）                             |

---

## 3. 虚拟列表（性能）

| 模块        | 文件                  | 说明                                 |
| ----------- | --------------------- | ------------------------------------ |
| 核心        | `lib/virtual-list.js` | 可视区渲染 + rAF；`mapInChunks` 分片 |
| 视频        | `videos.js`           | YouTube / B站网格虚拟滚动            |
| 工具榜      | `ranking-tabs.js`     | 榜单行虚拟列表（SSR 预览前 10 条）   |
| GitHub 热门 | 首页 Daily 面板       | 全量 GitHub 源资讯可滚动             |

样式：`css/virtual-list.css`。

---

## 4. 开源卡片

统一组件 `OssCard.astro` + `oss.js` 动态渲染：

- **Stars** / **开发语言** / **用途**
- 全宽「打开 GitHub 仓库」按钮
- 类型徽章「开源」

---

## 5. 链接安全与失效兜底

`lib/link-guard.js`（全站 Layout 默认加载）：

- 外链自动补齐 `rel="noopener noreferrer"`
- 图片 `loading=lazy`、缺省宽高、加载失败 SVG 兜底
- GitHub 仓库点击前用 `api.github.com` 探测；404 弹窗（复制 / 仍要打开 / 关闭）

CSP：`config/csp.json` → `connect-src` 含 `https://api.github.com`。

---

## 6. 响应式与首屏

| 项       | 实现                                                       |
| -------- | ---------------------------------------------------------- |
| Viewport | `width=device-width, initial-scale=1, maximum-scale=1`     |
| 横滚     | `html/body` 与列表容器 `max-width:100%; overflow-x:hidden` |
| 点击区   | 汉堡 / 主题切换 ≥44px                                      |
| 关键 CSS | Layout 内联极简样式，完整 `style.css` 带 `?v=` 哈希        |
| CLS      | `css/dynamic-panels.css` 为加载中区块预留 `min-height`     |
| 暗色模式 | `ux.js` + `ThemeBoot.astro`，`localStorage` 持久化         |

---

## 7. 首页产品入口

| 组件                     | 作用                                      |
| ------------------------ | ----------------------------------------- |
| `HomeQuickFilters.astro` | 快筛：开源项目 / AI 资讯 / 工具教程       |
| `HomeAiDaily.astro`      | 简报四宫格（模型 / GitHub / 行业 / 视频） |
| `HomeRecommend.astro`    | AI 推荐助手                               |
| `HomeOssPreview.astro`   | 开源预览（SSG）                           |
| 新闻列表                 | `今日` / `本周` 时间过滤 + 分类筛选       |

内容类型徽章：资讯（蓝）/ 开源（绿）/ 视频（红角标）。

---

## 8. 懒加载频道

`lazy-sections.js`：进入 Tab 再加载业务脚本。

| Section           | 脚本链                              |
| ----------------- | ----------------------------------- |
| `section-videos`  | `lib/virtual-list.js` → `videos.js` |
| `section-news`    | `lib/virtual-list.js` → `news.js`   |
| `section-oss`     | `oss.js`                            |
| `section-courses` | `courses.js`                        |

共享前置：`lib/fetch-json.js`（首页 scripts 已带）。

---

## 相关文档

- [CONTENT-FUNNEL.md](./CONTENT-FUNNEL.md) — 行为分析
- [SEO.md](./SEO.md) — TDK / OG / JSON-LD
- [ARCHITECTURE.md](./ARCHITECTURE.md) — 系统架构
- [SETUP.md](./SETUP.md) — 本地环境
