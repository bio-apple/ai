# SEO 优化（P0）

目标：提升 [bio-apple.github.io/ai/](https://bio-apple.github.io/ai/) 的搜索可发现性、品牌展示与社交分享效果。

## 已落地项

| 编号    | 项               | 实现                                                                           |
| ------- | ---------------- | ------------------------------------------------------------------------------ |
| SEO-001 | Title            | `data/site.json` → `meta.title`，各页经 `SeoHead.astro` 输出                   |
| SEO-002 | Description      | `meta.description` + 各页独立 `description` prop                               |
| SEO-003 | Open Graph       | `SeoHead.astro`：og:title/description/image/url + Twitter Card + 微信 itemprop |
| SEO-004 | Favicon          | 根目录 `favicon.svg` → `Favicon.astro`                                         |
| SEO-005 | robots.txt       | 根目录 `robots.txt`，构建时同步至 `dist/`                                      |
| SEO-006 | sitemap          | `@astrojs/sitemap` → `sitemap-index.xml`                                       |
| SEO-007 | GitHub Repo      | 见下方维护者清单（需在 GitHub 设置）                                           |
| SEO-008 | JSON-LD          | `src/lib/schema.ts` → Layout 注入 `application/ld+json`                        |
| SEO-009 | 新闻/本地部署 LD | 新闻页 `NewsArticle` ItemList；首页本地部署 `ItemList` → `SoftwareApplication` |
| SEO-010 | 可见面包屑       | UI：`Breadcrumb.astro`（专区 / 独立页）；结构化：各页 `BreadcrumbList`         |

## JSON-LD 结构化数据（SEO-008）

| 页面          | Schema 类型                                                               | 生成函数（`src/lib/schema.ts`）          | 说明                           |
| ------------- | ------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------ |
| 首页          | `WebSite` + `FAQPage` + `ItemList` + …                                    | `buildHomeSchema` 等                     | 全站 + 排行榜 FAQ              |
| 首页课程 Tab  | `CollectionPage` → `ItemList` → `Course`                                  | `buildCoursesSchema`                     | 自 `ai-courses.json`           |
| 首页本地部署  | `ItemList` → `SoftwareApplication`                                        | `buildLocalDeploySchema`                 | 自 `local-deploy.json`         |
| 新闻页 / 热点 | `ItemList` → `NewsArticle`                                                | `buildNewsSchema`                        | 自 `ai-news.json`              |
| 工具独立页    | `WebPage` + `SoftwareApplication` + `LearningResource` + `BreadcrumbList` | `buildToolSchema`                        | 官方链取 `type_class=official` |
| 对比 / 指南等 | `WebPage` / `Article`                                                     | `buildPageSchema` / `buildCompareSchema` | —                              |

多段 Schema 可用 `mergeSchemaGraphs` 合并为 `@graph` 注入。

注入位置：`HomeLayout.astro`、`StandaloneLayout.astro` 的 `<script type="application/ld+json">`。

**可见面包屑（UX）**与 JSON-LD 并列：首页专区（本地部署/课程/新闻/视频）与独立页通过 `Breadcrumb.astro` / `StandalonePageHeader` 展示「首页 / …」；详见 [FRONTEND.md](./FRONTEND.md)。

验收：

- [Google Rich Results Test](https://search.google.com/test/rich-results) 或 [Schema Markup Validator](https://validator.schema.org/)
- 本地：`npm run build && DIST=dist python3 scripts/validate_ci.py jsonld`
- Open Graph：`DIST=dist python3 scripts/validate_ci.py opengraph`

## 文件位置

```
data/site.json          # 全站默认 TDK、OG 图
src/lib/schema.ts       # JSON-LD（工具 / 课程 / 新闻 / 本地部署 / 首页）
src/components/SeoHead.astro
src/components/Favicon.astro
favicon.svg
og-image.jpg            # 社交分享图 1200×630
robots.txt
astro.config.mjs        # sitemap 集成
```

## GitHub Repository SEO（维护者手动）

在 https://github.com/bio-apple/ai/settings 配置：

**Description（推荐）**

```
Bio AI Lab — AI 工具导航、本地部署、免费课程、热点与视频。对比 ChatGPT/Claude/Cursor，搭建你的 AI 工作流。
```

**Topics（推荐）**

```
ai, artificial-intelligence, ai-tools, ai-agent, machine-learning, llm, open-source, github-pages, astro
```

**Website**

```
https://bio-apple.github.io/ai/
```

## 验收清单

- [ ] 浏览器标签显示品牌 favicon
- [ ] 首页 Title / Description 符合 `site.json`
- [ ] 微信 / X / LinkedIn 分享显示 `og-image.jpg` 预览（可用 [opengraph.xyz](https://www.opengraph.xyz/) 或各平台调试器验收）
- [ ] `https://bio-apple.github.io/ai/robots.txt` 可访问
- [ ] `https://bio-apple.github.io/ai/sitemap-index.xml` 可访问
- [ ] Lighthouse SEO ≥ 90（本地 `npm run build` 后测 `dist/index.html`）
- [ ] 首页含 `Course` / `CollectionPage` / 本地部署 `SoftwareApplication`；工具页含 `SoftwareApplication`；新闻含 `NewsArticle`（`validate_ci.py jsonld`）
- [ ] 首页与关键独立页含完整 OG / Twitter Card（`validate_ci.py opengraph`）

## 禁止事项

- 勿使用无意义 Title（如 `Home`、`AI`）
- 勿在 meta 中堆砌与页面无关的关键词
- 社交图须为真实项目品牌图，勿使用占位 `example.com` 链接

## 相关文档

- [DEVELOPER.md](../DEVELOPER.md) — 构建与部署
- [CI-CD.md](./CI-CD.md) — push `main` 自动部署
