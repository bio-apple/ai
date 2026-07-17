# 核心数据模型与 Schema

本文定义 Bio AI Lab 各 JSON 配置文件的**字段含义、数据类型与校验规则**。修改内容前请先查阅对应章节，提交前运行校验命令。

Schema 源文件：`schemas/*.json`（JSON Schema Draft 2020-12）  
校验入口：`DIST=dist python3 scripts/validate_ci.py`

---

## 1. 文件总览

| 文件                    | 位置              | 维护方式      | Schema                        | CI 步骤          |
| ----------------------- | ----------------- | ------------- | ----------------------------- | ---------------- |
| `site.json`             | `data/`           | 手工          | 文档约定 + 可解析             | `data`           |
| `tools.json`            | `data/`           | 手工          | 文档约定 + 可解析             | `data`           |
| `compares.json`         | `data/`           | 手工          | 文档约定 + 可解析             | `data`           |
| `rankings.json`         | `data/`           | 手工/脚本     | 文档约定 + 可解析             | `data`           |
| `tool-relations.json`   | `data/`           | 手工          | `tool-relations.schema.json`  | `tool-relations` |
| `engagement.json`       | `data/`           | 手工          | `engagement.schema.json`      | `engagement`     |
| `analytics.json`        | `data/`           | 手工          | 构建时检查                    | `analytics`      |
| `oss-projects.json`     | `data/` + 根目录  | 脚本          | `oss-projects.schema.json`    | `oss`            |
| `ai-news.json`          | 根目录            | 日更脚本      | `ai-news.schema.json`         | `news`           |
| `ai-courses.json`       | 根目录            | 周更脚本      | `ai-courses.schema.json`      | `courses`        |
| `daily-videos.json`     | 根目录            | 日更脚本      | `daily-videos.schema.json`    | `videos`         |
| `search-index.json`     | `public/`→`dist/` | prebuild 生成 | `search-index.schema.json`    | `search`         |
| `recommend-rules.json`  | `public/`→`dist/` | prebuild 生成 | `recommend-rules.schema.json` | `recommend`      |
| `analytics-config.json` | `public/`→`dist/` | prebuild 生成 | 运行时检查                    | `analytics`      |

**交叉引用规则（CI 强制）：**

- `tool-relations.json` 中所有 `id` 必须存在于 `tools.json`
- `site.json` → `ai_picker.options[].tools` 中的 id 应能在 `tools.json` 或 `home_tool_categories` 中找到
- `engagement.json` → `tools[].id` 唯一且非空

---

## 2. `data/site.json`

全站配置中枢：SEO、导航、首页文案、推荐场景、对比表、学习路线、FAQ 等。  
**类型**：`object`  
**消费**：Astro 构建期 `import`（`src/lib/data.ts`）

### 2.1 根级字段

| 字段                   | 类型     | 必填 | 说明                                           |
| ---------------------- | -------- | ---- | ---------------------------------------------- |
| `meta`                 | `object` | ✅   | 全站 SEO 与品牌元数据                          |
| `nav`                  | `object` | ✅   | 顶栏 Logo 与菜单                               |
| `hero`                 | `object` | ✅   | 首页 Hero 区                                   |
| `home_tool_categories` | `array`  | ✅   | 首页工具卡片分组                               |
| `rankings`             | `array`  | —    | 首页排行徽章展示                               |
| `ai_picker`            | `object` | ✅   | AI 推荐助手场景（生成 `recommend-rules.json`） |
| `compare_table`        | `object` | ✅   | 工具中心对比表行                               |
| `learning_paths`       | `array`  | ✅   | 学习指南阶段步骤                               |
| `news_page`            | `object` | —    | 新闻归档页 TDK                                 |
| `guides`               | `object` | ✅   | 指南页 `beginner` / `advanced`                 |
| `roadmap_page`         | `object` | —    | 学习路线图页                                   |
| `faq`                  | `array`  | —    | 首页 FAQ（JSON-LD）                            |
| `footer`               | `object` | ✅   | 页脚文案                                       |
| `recommend_fallback`   | `object` | ✅   | 推荐无匹配时的兜底                             |
| `tools_hub_page`       | `object` | ✅   | 工具中心页 TDK                                 |

### 2.2 `meta`

| 字段           | 类型           | 必填 | 说明                      |
| -------------- | -------------- | ---- | ------------------------- |
| `title`        | `string`       | ✅   | 浏览器标题，建议 ≤60 字符 |
| `description`  | `string`       | ✅   | meta description          |
| `keywords`     | `string`       | —    | meta keywords             |
| `canonical`    | `string` (URL) | ✅   | 首页 canonical            |
| `og_image`     | `string` (URL) | ✅   | Open Graph 分享图         |
| `og_image_alt` | `string`       | —    | OG 图 alt                 |
| `site_name`    | `string`       | ✅   | `og:site_name`            |
| `base_url`     | `string` (URL) | ✅   | 绝对 URL 前缀，末尾 `/`   |

### 2.3 `nav`

```typescript
nav: {
  logo: {
    icon: string;
    brand: string;
    tagline: string;
  }
  menu: Array<
    | { type: 'tab'; id: string; label: string }
    | { type: 'page'; label: string; href: string }
    | { type: 'dropdown'; label: string; children: Array<{ id: string; label: string }> }
  >;
}
```

- `type: "tab"` — 首页 SPA 频道，`id` 对应 `#section-{id}`（`all` → 首页）
- `type: "page"` — 跳转独立 HTML 页

### 2.4 `hero`

| 字段                 | 类型              | 说明           |
| -------------------- | ----------------- | -------------- |
| `eyebrow`            | `string`          | 品牌眉标       |
| `title`              | `string`          | H1             |
| `subtitle`           | `string`          | 副标题         |
| `cta_primary`        | `{ label, href }` | 主 CTA         |
| `cta_secondary`      | `{ label, href }` | 次 CTA         |
| `search_placeholder` | `string`          | 站内搜索占位符 |

### 2.5 `home_tool_categories[]`

| 字段    | 类型     | 必填 | 说明         |
| ------- | -------- | ---- | ------------ |
| `label` | `string` | ✅   | 分组标题     |
| `tools` | `array`  | ✅   | 工具卡片列表 |

**`tools[]` 卡片字段：**

| 字段        | 类型          | 必填 | 说明                         |
| ----------- | ------------- | ---- | ---------------------------- |
| `id`        | `string`      | ✅   | 与 `tools.json` 的 `id` 对齐 |
| `icon`      | `string`      | ✅   | 单字符或 emoji 图标          |
| `badge`     | `string`      | —    | 厂商标签                     |
| `name`      | `string`      | ✅   | 显示名                       |
| `tagline`   | `string`      | ✅   | 一句话定位                   |
| `summary`   | `string`      | ✅   | 卡片摘要                     |
| `stars`     | `integer` 1–5 | ✅   | 推荐星级                     |
| `tags`      | `string[]`    | —    | 场景标签                     |
| `recommend` | `string[]`    | —    | 推荐徽章文案                 |

### 2.6 `ai_picker` → 推荐规则源

| 字段      | 类型     | 说明       |
| --------- | -------- | ---------- |
| `title`   | `string` | 推荐区标题 |
| `lead`    | `string` | 推荐区引导 |
| `options` | `array`  | 场景列表   |

**`options[]`：**

| 字段         | 类型       | 必填 | 说明                    |
| ------------ | ---------- | ---- | ----------------------- |
| `id`         | `string`   | ✅   | 场景 id（如 `writing`） |
| `label`      | `string`   | ✅   | 芯片显示文案            |
| `icon`       | `string`   | —    | emoji                   |
| `tools`      | `string[]` | ✅   | 推荐工具 id 列表        |
| `keywords`   | `string[]` | ✅   | 用户输入匹配关键词      |
| `guide`      | `string`   | —    | 关联指南页相对路径      |
| `path_title` | `string`   | —    | 学习路径标题            |
| `steps`      | `string[]` | —    | 推荐步骤                |

`prebuild` 将其转换为 `recommend-rules.json`（见 §8.2）。

### 2.7 `compare_table.rows[]`

| 字段       | 类型     | 说明                        |
| ---------- | -------- | --------------------------- |
| `tool`     | `string` | 工具名                      |
| `type`     | `string` | 类型（AI 助手 / AI 编程 …） |
| `strength` | `string` | 核心优势                    |
| `scenario` | `string` | 适合场景                    |
| `pricing`  | `string` | 定价说明                    |

### 2.8 其他页面块

**`guides.{slug}`**：`slug`, `title`, `h1`, `lead`  
**`roadmap_page.phases[]`**：`phase`, `title`, `tools[]`, `tasks[]`  
**`faq[]`**：`question`, `answer`  
**`recommend_fallback`**：`tools[]`, `guide`, `path_title`, `steps[]`

---

## 3. `data/tools.json`

工具教程数据源，每项生成独立页面 `tools/{id}.html`。  
**类型**：`array<object>`  
**TypeScript**：`src/lib/data.ts` → `Tool`

### 3.1 工具对象字段

| 字段                    | 类型             | 必填 | 说明                                     |
| ----------------------- | ---------------- | ---- | ---------------------------------------- |
| `id`                    | `string`         | ✅   | 唯一标识，URL 片段，如 `chatgpt`         |
| `section_id`            | `string`         | ✅   | 历史 SPA 区块 id（如 `section-chatgpt`） |
| `icon`                  | `string`         | ✅   | 页头图标                                 |
| `name`                  | `string`         | ✅   | 显示名                                   |
| `description`           | `string`         | ✅   | 页头摘要 / meta description              |
| `getting_started_steps` | `string[]`       | ✅   | 快速入门步骤（可含 HTML）                |
| `features`              | `array`          | ✅   | 核心功能列表                             |
| `video_resources`       | `array`          | ✅   | 视频资源（可为空数组）                   |
| `text_resources`        | `array`          | ✅   | 文字资源链接                             |
| `shortcuts`             | `object \| null` | ✅   | 快捷键表，无则 `null`                    |

### 3.2 嵌套类型

**`features[]`**

| 字段          | 类型     |
| ------------- | -------- |
| `title`       | `string` |
| `description` | `string` |

**`text_resources[]` / `video_resources[]`**

| 字段         | 类型           | 说明                                     |
| ------------ | -------------- | ---------------------------------------- |
| `type`       | `string`       | 资源类型标签                             |
| `type_class` | `string`       | CSS 类：`official` / `article` / `video` |
| `href`       | `string` (URL) | 外链                                     |
| `title`      | `string`       | 标题                                     |
| `meta`       | `string`       | 补充说明                                 |

**`shortcuts`**（可选）

| 字段    | 类型                                                      |
| ------- | --------------------------------------------------------- |
| `title` | `string`                                                  |
| `rows`  | `{ key: string; action: string }[]` — `key` 可含 `<code>` |

---

## 4. `data/compares.json`

选型对比专题页，生成 `compare/{slug}.html`。  
**类型**：`array<object>`

| 字段               | 类型     | 必填 | 说明                    |
| ------------------ | -------- | ---- | ----------------------- |
| `slug`             | `string` | ✅   | URL slug                |
| `breadcrumb`       | `string` | ✅   | 面包屑短名              |
| `title`            | `string` | ✅   | 页面 `<title>`          |
| `meta_description` | `string` | ✅   | SEO 描述                |
| `h1`               | `string` | ✅   | 页标题                  |
| `lead`             | `string` | ✅   | 导语                    |
| `conclusion`       | `string` | ✅   | 一句话结论（可含 HTML） |
| `table`            | `object` | ✅   | 对比表                  |
| `sections`         | `array`  | ✅   | 正文小节                |
| `cta`              | `array`  | ✅   | 底部按钮                |
| `search_keywords`  | `string` | —    | 搜索索引关键词          |

**`table`**：`{ headers: string[]; rows: string[][] }`  
**`sections[]`**：`{ heading: string; items: string[]; ordered?: boolean }`  
**`cta[]`**：`{ label: string; href: string; track?: string; outline?: boolean }`

---

## 5. `data/rankings.json`

多源排行榜（AICPB / LMSYS / Artificial Analysis）。  
**类型**：`object`

| 字段             | 类型       | 说明               |
| ---------------- | ---------- | ------------------ |
| `month`          | `string`   | 数据月份 `YYYY-MM` |
| `month_label`    | `string`   | 显示用月份         |
| `updated_at`     | `string`   | 更新日期           |
| `cadence`        | `string`   | 刷新频率           |
| `title` / `lead` | `string`   | 页面文案           |
| `methodology`    | `string[]` | 方法论说明         |
| `boards`         | `array`    | 榜单列表           |

**`boards[]`**

| 字段                 | 类型      | 说明                                      |
| -------------------- | --------- | ----------------------------------------- |
| `id`                 | `string`  | `aicpb` / `lmsys` / `artificial-analysis` |
| `label`              | `string`  | Tab 标签                                  |
| `title` / `subtitle` | `string`  | 榜头                                      |
| `metric`             | `string`  | 指标名                                    |
| `source_url`         | `string`  | 原文链接                                  |
| `columns`            | `object`  | 列名映射                                  |
| `show_bar`           | `boolean` | 是否显示环比条                            |
| `items`              | `array`   | 排行条目                                  |

**`items[]`（因榜而异）**：`rank`, `name`, `visits`, `mom`, `elo`, `score`, `url`, `source` 等

---

## 6. `data/tool-relations.json`

工具关联图：替代品与互补品。  
**Schema**：`schemas/tool-relations.schema.json`

```typescript
{
  [toolId: string]: {
    alternatives: { id: string; note: string }[];
    complements: { id: string; note: string }[];
  };
}
```

- 顶层 key = 源工具 `id`
- `id` 必须引用 `tools.json` 中存在的工具
- 禁止 `id` 指向自身

---

## 7. `data/engagement.json`

首页「运营数据」展示基准（真实点击由 `engagement.js` 在浏览器累加）。  
**Schema**：`schemas/engagement.schema.json`

| 字段             | 类型         | 必填 |
| ---------------- | ------------ | ---- |
| `schema_version` | `integer` ≥1 | ✅   |
| `updated_at`     | `string`     | ✅   |
| `page_views`     | `integer` ≥0 | ✅   |
| `tools`          | `array`      | ✅   |

**`tools[]`**：`id`, `name`, `today_clicks`（必填）；`icon`, `updated_at`, `note`（可选）  
`tools[].id` 全局唯一。

---

## 8. 构建时生成的 JSON

### 8.1 `search-index.json`

**Schema**：`schemas/search-index.schema.json`  
**类型**：`array`（≥10 条）  
**生成**：`scripts/build-artifacts.mjs` ← `tools.json` + `site.json` + 频道元数据

| 字段       | 类型     | 必填 | 说明                           |
| ---------- | -------- | ---- | ------------------------------ |
| `label`    | `string` | ✅   | 显示标题                       |
| `keywords` | `string` | ✅   | Fuse 检索文本                  |
| `type`     | `string` | —    | 分类：工具 / 频道 / 导航 …     |
| `section`  | `string` | *    | 首页 Tab id（与 `url` 二选一） |
| `url`      | `string` | *    | 独立页相对路径                 |
| `anchor`   | `string` | —    | 页内锚点                       |

### 8.2 `recommend-rules.json`

**Schema**：`schemas/recommend-rules.schema.json`  
**生成**：`ai_picker` + `recommend_fallback` + `tool-relations`

| 字段             | 类型      | 必填                             |
| ---------------- | --------- | -------------------------------- |
| `schema_version` | `integer` | ✅                               |
| `options`        | `array`   | ✅ — 同 `ai_picker.options` 结构 |
| `fallback`       | `object`  | ✅                               |
| `relations`      | `object`  | — 嵌入 tool-relations            |

### 8.3 `analytics-config.json`

**生成**：`data/analytics.json` + 环境变量（CI Secrets / `.env.local`）

| 字段                                    | 类型      | 说明                |
| --------------------------------------- | --------- | ------------------- |
| `ga_measurement_id`                     | `string`  | GA4                 |
| `clarity_project_id`                    | `string`  | Clarity             |
| `umami_script_url` / `umami_website_id` | `string`  | Umami               |
| `cloudflare_beacon_token`               | `string`  | CF Web Analytics    |
| `track_engagement`                      | `boolean` | 是否上报点击        |
| `analytics_enabled`                     | `boolean` | 任一项配置则为 true |

**内容漏斗**：`funnel.js` 为 `trackEvent()` 附加 `journey_id`、`funnel_step`（1–5）、`funnel_stage`、`page_type`。事件清单与分析维度见 [CONTENT-FUNNEL.md](./CONTENT-FUNNEL.md)。

---

## 9. 脚本抓取的 JSON

### 9.1 `ai-news.json`

**Schema**：`schemas/ai-news.schema.json`  
**脚本**：`scripts/fetch_ai_news.py` · **配置**：`config/news-fetch.yaml`

| 字段                            | 类型      | 必填     |
| ------------------------------- | --------- | -------- |
| `items`                         | `array`   | ✅       |
| `window_days`                   | `integer` | — 默认 7 |
| `updated_at` / `date` / `title` | `string`  | —        |

**`items[]`**：`title`, `url`（必填）；`id`, `summary`, `source`, `category`, `published_at`

**额外 CI 规则**：标题 + URL 去重；排除已在 OSS 精选中的 GitHub URL。

### 9.2 `ai-courses.json`

**Schema**：`schemas/ai-courses.schema.json`  
**脚本**：`scripts/fetch_ai_courses.py` · **配置**：`config/courses-fetch.yaml`

| 字段          | 类型       | 必填 | 约束          |
| ------------- | ---------- | ---- | ------------- |
| `free_only`   | `boolean`  | ✅   | 必须为 `true` |
| `track_order` | `string[]` | ✅   | 路线顺序      |
| `items`       | `array`    | ✅   | 课程列表      |

**`items[]`**：`title`, `url`, `platform`, `track`, `published_at`, `is_free: true`（必填）  
可选：`required`, `hub`, `is_new`, `summary`, `format`, `language`

**额外 CI 规则**：每路线 ≤5 门；必收录 URL 存在；合集不与单课重复。

### 9.3 `daily-videos.json`

**Schema**：`schemas/daily-videos.schema.json`  
**脚本**：`scripts/fetch_daily_videos.py` · **配置**：`config/video-fetch.yaml`

| 字段         | 类型       | 说明       |
| ------------ | ---------- | ---------- |
| `batches`    | `array`    | 按日期批次 |
| `updated_at` | `string`   | 更新时间   |
| `seen_ids`   | `string[]` | 去重 id    |

**批次** `batches[]`：`date`（`YYYY-MM-DD`）；`categories` 或旧版 `videos`  
**视频项**：`id`, `title`, `url`, `summary`, `channel`, `published_at`, `thumbnail` 等

**额外 CI 规则**：摘要禁止裸 URL；最新批次须覆盖配置中全部分类。

### 9.4 `oss-projects.json`

**Schema**：`schemas/oss-projects.schema.json`  
**脚本**：`scripts/fetch_oss_stars.py`

| 字段      | 类型     | 说明                            |
| --------- | -------- | ------------------------------- |
| `domains` | `array`  | ≥6 个领域                       |
| `rules`   | `object` | `min_stars`, `top_n_per_app` 等 |

**`domains[]`**：`id`, `label`, `projects[]`  
**`projects[]`**：`id`, `repo`（`owner/name`）, `name`, `url`, `stars`（必填）

---

## 10. 校验命令速查

```bash
# 全量（与 CI 一致，需先 build）
npm run build
DIST=dist python3 scripts/validate_ci.py

# 单项
DIST=dist python3 scripts/validate_ci.py courses
DIST=dist python3 scripts/validate_ci.py tool-relations
DIST=dist python3 scripts/validate_ci.py secrets
```

**手工改 `data/` 后建议：**

```bash
npm run build && DIST=dist python3 scripts/validate_ci.py data tool-relations links
```

---

## 11. 常见改动映射

| 想改什么        | 改哪个文件                             | 注意                         |
| --------------- | -------------------------------------- | ---------------------------- |
| 导航 / 首页文案 | `site.json`                            | 改 `nav` / `hero`            |
| 新工具教程页    | `tools.json` + `tool-relations.json`   | `id` 全局唯一                |
| 工具中心对比行  | `site.json` → `compare_table`          | 与 hub 表格同步              |
| 推荐场景芯片    | `site.json` → `ai_picker`              | 重建后更新 `recommend-rules` |
| 新对比专题      | `compares.json`                        | 新增 `slug` 自动生成页面     |
| 排行榜数据      | `rankings.json` 或 `fetch_rankings.py` |                              |
| 新闻源          | `config/news-fetch.yaml`               | 非 `ai-news.json` 直接改     |

---

## 相关文档

- [ARCHITECTURE.md](./ARCHITECTURE.md) — 系统架构与数据流
- [DEVELOPER.md](../DEVELOPER.md) — 开发流程
- `schemas/` — 机器可读 Schema 源文件
