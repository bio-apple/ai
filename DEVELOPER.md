# Bio AI — 开发者文档

本文档面向维护与二次开发本项目的开发者，说明架构、目录结构、数据格式、构建流程、自动化与常见改动方式。

- **线上地址**：https://bio-apple.github.io/ai/
- **仓库**：https://github.com/bio-apple/ai
- **本地目录**：`/Users/yfan/Desktop/bio-apple/ai`
- **类型**：数据驱动静态站 + 可选本地静态服务 + GitHub Actions 自动化

---

## 目录

1. [架构概览](#架构概览)
2. [技术栈](#技术栈)
3. [目录结构](#目录结构)
4. [构建流程（核心）](#构建流程核心)
5. [数据格式](#数据格式)
6. [前端设计](#前端设计)
7. [本地开发](#本地开发)
8. [每日视频流水线](#每日视频流水线)
9. [CI/CD 与部署](#cicd-与部署)
10. [内容维护指南](#内容维护指南)
11. [配置参考](#配置参考)
12. [故障排查](#故障排查)

---

## 架构概览

```
┌──────────────────────────────────────────────────────────────────────┐
│                        GitHub 仓库 (main)                             │
├──────────────────────────────────────────────────────────────────────┤
│  【源数据】data/*.json + templates/*.j2                               │
│  【构建产物】index.html · tools/*.html · compare/*.html               │
│              ai-tools-ranking.html · ai-learning-roadmap.html         │
│              search-index.json · sitemap.xml                          │
│  【运行时】app.js · videos.js · analytics.js · daily-videos.json      │
└───────────────┬────────────────────────────┬────────────────────────┘
                │ push                         │ cron 00:00 北京时间
                ▼                              ▼
     ┌────────────────────┐         ┌──────────────────────────┐
     │ CI + Deploy Pages  │         │ Daily AI Video Update    │
     │ validate → build   │         │ + fetch_daily_videos.py  │
     │ → playwright → deploy│        └────────────┬─────────────┘
     └─────────┬──────────┘                      │ commit JSON
               ▼                                 ▼
     https://bio-apple.github.io/ai/  ←── 再次触发 CI + Pages
```

**设计原则**

- **内容源**在 `data/*.json`，不直接维护巨型 `index.html`。
- `index.html`、`tools/`、`compare/`、`search-index.json`、`sitemap.xml` 由 **`scripts/build_site.py`** 从数据 + Jinja2 模板生成。
- 生产环境以 **GitHub Pages 静态托管** 为主，无后端 API、无数据库。
- `backend/` 仅用于 **本地预览**（FastAPI 静态文件服务）。
- 动态内容（每日视频）通过提交 `daily-videos.json` 实现，由 GitHub Actions 定时写入。
- 部署前必须通过 **CI 校验**（JSON Schema、链接检查、Playwright 冒烟测试）。

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 内容源 | JSON（`data/`） |
| 构建 | Python 3.12 + [Jinja2](https://jinja.palletsprojects.com/) |
| 页面 | HTML5、语义化区块 |
| 样式 | 原生 CSS 模块化（`css/*.css` + `style.css` 入口） |
| 交互 | 原生 JavaScript（无框架） |
| 搜索 | `search-index.json`（构建时自动生成） |
| 视频数据 | `daily-videos.json` + `fetch` 加载（Promise 缓存） |
| 视频抓取 | Python 3.12 + [yt-dlp](https://github.com/yt-dlp/yt-dlp) |
| 校验 | jsonschema + BeautifulSoup + [Playwright](https://playwright.dev/) |
| 本地服务 | FastAPI + Uvicorn（可选） |
| 部署 | GitHub Pages + GitHub Actions |

---

## 目录结构

```
ai/
├── data/                       # ★ 内容源（版本控制，勿忽略）
│   ├── site.json               # 站点 meta、导航、FAQ、首页区块
│   ├── tools.json              # 10 个工具教程
│   ├── cases.json              # 实战案例
│   └── compares.json           # 对比专题页
│
├── templates/                  # Jinja2 模板
│   ├── index.html.j2
│   ├── tool_page.html.j2
│   ├── compare_page.html.j2
│   └── partials/
│       ├── tool_section.j2
│       └── cases_section.j2
│
├── scripts/
│   ├── build_site.py           # ★ 主构建脚本
│   ├── extract_from_html.py    # 一次性从旧 HTML 提取到 data/
│   ├── validate_ci.py          # CI 校验
│   └── fetch_daily_videos.py   # 视频抓取
│
├── config/
│   └── video-fetch.yaml        # 视频抓取参数与摘要过滤规则
│
├── schemas/
│   └── daily-videos.schema.json
│
├── css/                        # 样式模块
│   ├── base.css
│   ├── layout.css
│   ├── components.css
│   └── videos.css
│
├── tests/e2e/
│   └── smoke.spec.js           # Playwright 冒烟测试
│
├── index.html                  # 【构建产物】主 SPA 页面
├── tools/*.html                # 【构建产物】10 个 SEO 独立工具页
├── compare/*.html              # 【构建产物】对比专题页
├── search-index.json           # 【构建产物】站内搜索索引
├── sitemap.xml                 # 【构建产物】
├── style.css                   # @import 入口
├── app.js                      # 导航、搜索、案例筛选、hash 路由
├── videos.js                   # 视频列表（共享 fetch 缓存）
├── analytics.js                # 点击追踪（可配置 GA4）
├── daily-videos.json           # 视频数据（Actions 每日追加）
│
├── backend/                    # 可选本地静态服务器
├── .github/workflows/
│   ├── ci.yml                  # push/PR 校验
│   ├── pages.yml               # 校验通过后部署 Pages
│   └── daily-videos.yml        # 定时抓取视频
│
├── build.sh                    # 快捷构建入口
├── package.json                # Playwright 测试依赖
├── playwright.config.js
├── requirements.txt
└── DEVELOPER.md                # 本文档
```

---

## 构建流程（核心）

### 日常命令

```bash
# 1. 编辑 data/*.json（或 templates/）
# 2. 构建
./build.sh
# 等价于
python3 scripts/build_site.py

# 3. 本地校验
python3 scripts/validate_ci.py
npm run test:e2e
```

### 构建产物

| 输入 | 输出 |
|------|------|
| `data/site.json` + `tools.json` + `cases.json` | `index.html` |
| `data/tools.json` | `tools/{id}.html`（每个工具独立 SEO 页） |
| `data/compares.json` | `compare/{slug}.html` |
| 全部内容数据 | `search-index.json`（36+ 条，自动推导） |
| 全部页面 URL | `sitemap.xml` |

### 重要约定

- **不要手改** `index.html`、`tools/`、`compare/`、`search-index.json`、`sitemap.xml`，改 `data/` 后重新构建。
- 首次从旧 HTML 迁移内容：`python3 scripts/extract_from_html.py`（一次性）。
- 模板在 `templates/`；调整 HTML 结构改模板，调整文案改 JSON。

### 搜索索引

`search-index.json` 由 `build_site.py` 自动生成，包含：

- 每个工具的 SPA section + 独立页 URL
- 每个实战案例标题与关键词
- 每个对比专题页

`app.js` 启动时 `fetch('search-index.json')`，**不再手写**搜索条目。

---

## 数据格式

### `data/site.json`

站点级配置：meta、nav.menu（分类下拉导航）、hero、hot_tools、home_tool_categories、rankings、ai_picker、scenarios、compare_guides、learning_paths、roadmap_page、ranking_page、faq、footer。

### `data/tools.json`

工具数组，每项字段：

| 字段 | 说明 |
|------|------|
| `id` | 如 `chatgpt`，对应 `section-chatgpt` |
| `icon` / `name` / `description` | 页头与卡片 |
| `getting_started_steps` | HTML 字符串数组（可含 `<a>` `<code>`） |
| `features` | `[{title, description}]` |
| `text_resources` / `video_resources` | 外链资料 |
| `shortcuts` | 可选快捷键表（Cursor/Copilot） |

### `data/cases.json`

| 字段 | 说明 |
|------|------|
| `cases[].tool` | 关联工具 id |
| `cases[].scenarios` | 如 `["writing", "beginner"]` |
| `cases[].steps[]` | `{title, blocks:[{type, content}]}` |
| `blocks.type` | `paragraph` / `prompt` / `tip` / `checklist` |

### `data/compares.json`

对比专题：slug、title、meta_description、table、sections、cta、search_keywords。

### `daily-videos.json`

```json
{
  "updated_at": "2026-07-10T12:00:00+08:00",
  "seen_ids": ["videoId1"],
  "batches": [
    {
      "date": "2026-07-10",
      "timezone": "Asia/Shanghai",
      "criteria": {
        "min_height": 1080,
        "min_views": 8000,
        "min_subscribers": 1000,
        "video_categories": {
          "top_views": { "label": "全网播放量 Top 10", "window": { "all_time": true }, "top_count": 10 },
          "recent_7d": { "label": "过去一周上新 Top 10", "window": { "days": 7 }, "top_count": 10 }
        }
      },
      "categories": {
        "top_views": {
          "label": "全网播放量 Top 10",
          "window": { "all_time": true },
          "top_count": 10,
          "videos": [{ "id": "...", "title": "...", "views": 61235029, "published_at": "2025-10-11T12:00:00+08:00" }]
        },
        "recent_7d": {
          "label": "过去一周上新 Top 10",
          "window": { "days": 7 },
          "top_count": 10,
          "videos": [{ "id": "bilibili:BV1xx", "platform": "bilibili", "title": "...", "views": 12000 }]
        }
      }
    }
  ]
}
```

- `categories`：两类推荐可重叠；按播放量降序取 Top N；旧版分类 key 仍兼容。
- `batches`：新日期插入头部；`seen_ids` 全局去重；历史最多 **60 天**。
- CI 会校验 Schema，并拒绝摘要中含 URL/广告残留。

---

## 前端设计

### 单页多区块（SPA 式，无路由库）

| `data-tool` | Section ID | 内容 |
|-------------|------------|------|
| `all` | `section-home` | 总览、快速入口、今日视频、工具卡片 |
| `chatgpt` … `copilot` | `section-{tool}` | 各 AI 工具教程 |
| `cases` | `section-cases` | 实战案例 |
| `videos` | `section-videos` | 每日视频推荐 |

支持 **hash 深链接**：`index.html#section-cursor`。

另有 **独立 URL 页面**（SEO）：`tools/cursor.html`、`compare/cursor-vs-copilot.html` 等。

### 样式模块

`style.css` 仅为入口：

```css
@import url('css/base.css');      /* 变量、reset */
@import url('css/layout.css');    /* header、hero、footer */
@import url('css/components.css'); /* 卡片、案例、搜索 */
@import url('css/videos.css');    /* 视频卡片 */
```

新增工具品牌色：在 `css/base.css` 的 `:root` 添加 `--newtool`，并在 `css/components.css` 补充 `.tool-card.newtool` 等。

### 实战案例

- 手风琴展开（同时只开一个）
- 工具筛选 `.case-filter` + 场景筛选 `.case-scenario`
- `.prompt-block` 点击复制提示词

### 视频模块

`videos.js` 使用 **单次 Promise 缓存** `fetchVideoData()`，首页预览与完整列表共用同一次请求。

---

## 本地开发

### 推荐流程

```bash
cd ai
pip install -r requirements.txt   # 构建 + 校验依赖
./build.sh                        # 生成 HTML
./start.sh                        # FastAPI 本地预览 → http://127.0.0.1:8765
```

### 方式一：静态 HTTP 服务

```bash
python3 -m http.server 8080
# 访问 http://127.0.0.1:8080
```

### 方式二：FastAPI（推荐）

`backend/main.py`：

- `GET /` → `index.html`
- `GET /{filepath}` → 白名单静态文件
- 路径安全：`path.relative_to(root)` 防止目录穿越
- 拒绝 `api/`、`backend/`、`uploads/`（`data/` 不对外暴露）

### 测试

```bash
# JSON / 链接 / sitemap 校验
python3 scripts/validate_ci.py

# Playwright 冒烟（自动起 python3 -m http.server 8766）
npm install
npx playwright install chromium
npm run test:e2e

# 线上 Pages 探测
./cloud-test.sh
```

---

## 每日视频流水线

### 触发时机

| 触发器 | 说明 |
|--------|------|
| `cron: "0 16 * * *"` | UTC 16:00 = 北京时间次日 00:00 |
| `workflow_dispatch` | 手动运行 |

工作流：`.github/workflows/daily-videos.yml`

### 抓取流程

```
1. 读取 config/video-fetch.yaml
2. 多平台搜索（YouTube `ytsearch` / B站 `bilisearch`）
3. 预筛：播放量、AI 关键词；被拒记录 reject [reason] 日志
4. 拉取完整元数据：分辨率、订阅数、发布时间（B站阈值单独配置）
5. 分两类取播放量 Top N（可重叠，跨平台合并排序）：
   - top_views：时间不限，全网候选按播放量取 Top 10
   - recent_7d：仅过去 7 天内上传，按播放量取 Top 10
6. 生成摘要（过滤 URL/赞助/广告文案）
7. 写入 daily-videos.json → push → 触发 CI + Pages
```

### 本地手动运行

```bash
pip install yt-dlp pyyaml
python3 scripts/fetch_daily_videos.py
```

**幂等性**：当日 batch 已存在则跳过。

### 可调参数

编辑 `config/video-fetch.yaml`：

| 键 | 默认值 | 含义 |
|----|--------|------|
| `video_categories.top_views` | `all_time, top_count: 10` | 全网播放量 Top 10 |
| `video_categories.recent_7d` | `days: 7, top_count: 10` | 过去一周上新播放量 Top 10 |
| `search_sources.youtube` | `min_height: 1080` | YouTube 搜索与筛选 |
| `search_sources.bilibili` | `min_height: 720` | B站搜索与筛选 |
| `bilibili_search_queries` | 见文件 | B站中文搜索关键词 |
| `search_per_query` | `20` | 每关键词搜索条数 |
| `search_queries` | 见文件 | YouTube 搜索关键词 |
| `summary.strip_patterns` | 见文件 | 摘要广告/URL 过滤正则 |

---

## CI/CD 与部署

### 工作流关系

```
push/PR → ci.yml（build + validate + playwright）
push main → pages.yml（同上校验 → 构建 → 部署 Pages）

daily-videos.yml commit JSON
        ↓
   push to main
        ↓
   ci.yml + pages.yml
```

### `ci.yml` 检查项

| 步骤 | 说明 |
|------|------|
| `python scripts/build_site.py` | 确保 data 可构建 |
| `python scripts/validate_ci.py` | data JSON、daily-videos Schema、死链、sitemap |
| `npm run test:e2e` | 首页、hash、搜索、视频、复制、工具页 |

### GitHub Pages

- 工作流：`.github/workflows/pages.yml`
- **必须先通过 validate job**，再 upload artifact
- Settings → Pages → Source：**GitHub Actions**

### Docker / Render（可选）

```bash
docker build -t ai-guide .
docker run -p 8765:8765 ai-guide
```

---

## 内容维护指南

### 新增 AI 工具

1. 在 `data/tools.json` 追加工具对象。
2. 在 `data/site.json` 中更新：
   - `nav.menu`（含 dropdown children）
   - `home_tool_categories`（总览卡片，含 tagline/stars/tags）
   - `compare_table.rows`（可选）
3. 在 `css/base.css` + `css/components.css` 添加品牌色与 class。
4. 运行 `./build.sh`。
5. 运行 `python3 scripts/validate_ci.py`。

构建会自动生成：`index.html` 对应 section、`tools/{id}.html`、搜索索引、sitemap 条目。

### 新增实战案例

在 `data/cases.json` 的 `cases` 数组追加对象，设置 `tool`、`scenarios`、`steps`。然后 `./build.sh`。

### 新增对比专题

在 `data/compares.json` 追加对象；在 `data/site.json` 的 `compare_guides` 添加入口卡片。然后 `./build.sh`。

### 修改视频筛选逻辑

改 `config/video-fetch.yaml` 或 `scripts/fetch_daily_videos.py`（摘要生成）。UI 改动改 `videos.js` / `css/videos.css`。

### 修改页面结构

改 `templates/` 中对应 `.j2` 文件，然后 `./build.sh`。不要直接改构建产物 HTML。

---

## 配置参考

### `config.yaml`（本地服务）

```yaml
server:
  host: "127.0.0.1"
  port: 8765
```

环境变量：`HOST`、`PORT`（见 `backend/config.py`）。

### `analytics.js`

```javascript
const GA_MEASUREMENT_ID = '';  // 填入 GA4 ID 启用统计
```

### `.gitignore`

```
uploads/
.venv/
node_modules/
playwright-report/
test-results/
```

**纳入版本控制**：`data/*.json`、`daily-videos.json`、`package-lock.json`。

---

## 故障排查

| 现象 | 可能原因 | 处理 |
|------|----------|------|
| CI 构建失败 | `data/*.json` 格式错误 | 检查 JSON；运行 `build_site.py` 看报错 |
| CI 摘要校验失败 | `daily-videos.json` 含 URL/广告 | 重跑抓取或手动清洗摘要 |
| CI 死链 | 构建产物 href 指向不存在文件 | `./build.sh` 后重验；检查 `data/compares.json` 的 cta href |
| Playwright 失败 | 本地未构建或端口占用 | 先 `./build.sh`；检查 8766 端口 |
| 搜索无结果 | 未构建 `search-index.json` | 运行 `./build.sh` |
| Pages 404 | Pages 未启用 Actions 源 | Settings → Pages |
| 视频页空白 | `daily-videos.json` 未部署 | 确认已 commit；手动跑 workflow |
| 筛选不足 10 条 | 阈值过高或候选不够 | 调低 `config/video-fetch.yaml` 中 `min_views` |
| 修改 data 后页面未变 | 忘记构建 | 运行 `./build.sh` 并 commit 产物 |

### GitHub Actions 权限

- `daily-videos.yml` 需 `contents: write` 以 push commit
- Settings → Actions → Workflow permissions → **Read and write**

---

## 版本与变更记录

| 版本 | 说明 |
|------|------|
| 1.0 | 六工具教程 + 实战案例 |
| 1.1 | 用户注册/社区（已移除） |
| 1.2 | 纯静态站；新增 Kimi/通义/豆包/Copilot |
| 1.3 | 每日 1080p 视频自动更新 |
| 1.4 | SEO 增强：OG、对比页、工具独立页、站内搜索 |
| 1.5 | 数据驱动构建：`data/*.json` + Jinja2；CI + Playwright；CSS 模块化；视频配置外置 |

---

## 贡献流程

```bash
git checkout -b feature/your-change

# 改内容
vim data/tools.json        # 示例
./build.sh
python3 scripts/validate_ci.py
npm run test:e2e

git add data/ templates/ index.html tools/ compare/ search-index.json sitemap.xml
git commit -m "content: ..."
git push origin feature/your-change
# 提 PR → CI 通过 → 合并 main → 自动部署 Pages
```

---

## 相关链接

- [GitHub Pages 文档](https://docs.github.com/en/pages)
- [Jinja2 文档](https://jinja.palletsprojects.com/)
- [yt-dlp 文档](https://github.com/yt-dlp/yt-dlp#usage-and-options)
- [Playwright 文档](https://playwright.dev/docs/intro)
- [FastAPI 文档](https://fastapi.tiangolo.com/)
