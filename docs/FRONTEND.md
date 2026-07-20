# 前端能力说明

本文汇总浏览器端已落地的产品与工程能力（与 `*.js` / `src/components` / `lib/` 对应）。

线上：https://bio-apple.github.io/ai/

---

## 1. 全局搜索

| 项   | 说明                                                                              |
| ---- | --------------------------------------------------------------------------------- |
| 入口 | 顶栏（全站）+ 首页 Hero（`GlobalSearch.astro`）                                   |
| 提交 | 输入框右侧放大镜按钮（`.site-search-submit`）；支持 Enter / `search` 事件跳转首条 |
| 下拉 | Hero / Nav 展开时均为 `position: fixed`，避免 sticky / overflow 裁切              |
| 排序 | `preferSearchHits`：精确标签与 `tools/*.html` 优先，压低 `hub.html#hub-compare`   |
| 索引 | 构建时 `scripts/build-artifacts.mjs` → `search-index.json`（约 150 条）           |
| 覆盖 | 工具教程、对比、资讯、开源、课程、视频、排行榜模型名、频道/导航                   |
| 工具 | 条目来自 `tools.json`，`label` 为工具原名，`url` 为 `tools/{id}.html`             |
| 联想 | 聚焦空输入显示 `site.hero.search_suggestions` chips                               |
| 历史 | `localStorage` 键 `bioai.search.history.v1`（最多 8 条）                          |
| 引擎 | Fuse.js（`vendor/fuse.min.js`）                                                   |

**注意**：工具中心对比表只写入一条「导航」索引；**不再**为每个工具名写入指向 `#hub-compare` 的重复「工具」项，避免搜「ChatGPT」误跳对比表。

本地验收：`npm run build && DIST=dist python3 scripts/validate_ci.py search`  
E2E：`npx playwright test tests/e2e/smoke.spec.js -g "搜索|顶栏全局"`

---

## 2. Hero 背景（AI 领域关联图）

| 项       | 说明                                                                 |
| -------- | -------------------------------------------------------------------- |
| 组件     | `HeroAiMap.astro`（首页 `hero-bg` 内）                               |
| 资源     | `hero-ai-map.svg` + `hero-ai-map-{640,960,1280}.webp`                |
| 策略     | `<768px` 仅 SVG（~5KB）；≥768px 用 WebP `srcset`                      |
| 构图     | 中心 mask 镂空 + `.hero-content-scrim` 衬底，保证品牌/搜索可读       |
| 动效     | 轻微 `heroMapFloat`；尊重 `prefers-reduced-motion`                   |
| 装饰语义 | `aria-hidden` + 空 `alt`，不抢 LCP（`loading=lazy` / `fetchpriority=low`） |
| 缓存     | `_headers` 对 SVG/WebP 设 7 天 `Cache-Control`                       |

关联关系：AI ⊃ ML ⊃ DL，并与 Computer Vision / Robotics / NLP / Speech Recognition 交叉；外围为 Mathematics 等基础学科。

---

## 3. 面包屑

| 项     | 说明                                                           |
| ------ | -------------------------------------------------------------- |
| 组件   | `Breadcrumb.astro`；独立页经 `StandalonePageHeader.astro` 复用 |
| 首页专区 | 开源 / 课程 / 新闻 / 视频：`首页 / {专区名}`；「首页」可切回主 Tab |
| 独立页 | 如 `首页 / 工具中心`、`首页 / 工具中心 / ChatGPT 教程`         |
| SEO    | JSON-LD `BreadcrumbList` 见 [SEO.md](./SEO.md)                 |

---

## 4. 工具中心对比表

| 项     | 说明                                                                  |
| ------ | --------------------------------------------------------------------- |
| 页面   | `tools/hub.html`（`src/pages/tools/hub.astro`）                       |
| 逻辑   | `src/lib/hub.ts` → `buildHubCompareRows()` 映射工具名 → `tutorialHref` |
| UI     | 「工具」列链到站内教程 `tools/{id}.html`（含 **即梦** `jimeng`）       |
| 样式   | `.hub-compare-link`（`css/labs.css`）                                 |

---

## 5. AI 推荐助手

| 项       | 说明                                                                  |
| -------- | --------------------------------------------------------------------- |
| UI       | `HomeRecommend.astro` + `recommend.js`                                |
| 配置     | `site.json` → `ai_picker.options[]`（含 `examples` 现实实例）         |
| 产物     | `recommend-rules.json`（prebuild 透传 `examples` / `steps` / `tools`） |
| 展示     | 结果区「现实实例」列表 + 路径步骤 + 工具跳转                          |

---

## 6. 内容漏斗与分析

见 **[CONTENT-FUNNEL.md](./CONTENT-FUNNEL.md)**。

| 脚本            | 作用                                                        |
| --------------- | ----------------------------------------------------------- |
| `funnel.js`     | `journey_id`、`funnel_step`、`funnel_entry`、`section_view` |
| `analytics.js`  | Umami / CF / GA4 / Clarity；`trackEvent` 统一出口           |
| `engagement.js` | 首页运营热度 widget（本地累加）                             |

---

## 7. 虚拟列表（性能）

| 模块        | 文件                  | 说明                                 |
| ----------- | --------------------- | ------------------------------------ |
| 核心        | `lib/virtual-list.js` | 可视区渲染 + rAF；`mapInChunks` 分片 |
| 视频        | `videos.js`           | YouTube / B站网格虚拟滚动            |
| 工具榜      | `ranking-tabs.js`     | 榜单行虚拟列表（SSR 预览前 10 条）   |
| GitHub 热门 | 首页 Daily 面板       | 全量 GitHub 源资讯可滚动             |

样式：`css/virtual-list.css`。

---

## 8. 开源卡片

统一组件 `OssCard.astro` + `oss.js` 动态渲染：

- **Stars** / **开发语言** / **用途**
- 全宽「打开 GitHub 仓库」按钮
- 类型徽章「开源」

---

## 9. 链接安全与失效兜底

`lib/link-guard.js`（全站 Layout 默认加载）：

- 外链自动补齐 `rel="noopener noreferrer"`
- 图片 `loading=lazy`、缺省宽高、加载失败 SVG 兜底
- GitHub 仓库点击前用 `api.github.com` 探测；404 弹窗（复制 / 仍要打开 / 关闭）

CSP：`config/csp.json` → `connect-src` 含 `https://api.github.com`。

---

## 10. 响应式与首屏

| 项       | 实现                                                       |
| -------- | ---------------------------------------------------------- |
| Viewport | `width=device-width, initial-scale=1, maximum-scale=1`     |
| 横滚     | `html/body` 与列表容器 `max-width:100%; overflow-x:hidden` |
| 点击区   | 汉堡 / 主题切换 ≥44px                                      |
| 关键 CSS | Layout 内联极简样式，完整 `style.css` 带 `?v=` 哈希        |
| CLS      | `css/dynamic-panels.css` 为加载中区块预留 `min-height`     |
| 暗色模式 | `ux.js` + `ThemeBoot.astro`，`localStorage` 持久化         |

---

## 11. 首页产品入口

| 组件                     | 作用                                      |
| ------------------------ | ----------------------------------------- |
| `HeroAiMap.astro`        | Hero 背景 AI 领域关联图                   |
| `HomeQuickFilters.astro` | 快筛：开源项目 / AI 资讯 / 工具教程       |
| `HomeAiDaily.astro`      | 简报四宫格（模型 / GitHub / 行业 / 视频） |
| `HomeRecommend.astro`    | AI 推荐助手（含现实实例）                 |
| `HomeOssPreview.astro`   | 开源预览（SSG）                           |
| `Breadcrumb.astro`       | 专区页「首页 / …」面包屑                  |
| 新闻列表                 | `今日` / `本周` 时间过滤 + 分类筛选       |

内容类型徽章：资讯（蓝）/ 开源（绿）/ 视频（红角标）。

---

## 12. 懒加载频道

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
