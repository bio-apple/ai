# 前端能力

搜索、推荐、漏斗、视频页等运行时行为。架构见 [ARCHITECTURE.md](./ARCHITECTURE.md)。

## 1. 全站搜索

- 顶栏唯一入口（`⌘K` / `Ctrl+K`）；`search-index.json` + Fuse.js（`lib/search.js`）
- 工具名可直达 `tools/*.html`；历史存 `localStorage`
- 下拉可「用知识库回答」，打开同一套对话面板（无右侧悬浮按钮）

## 2. 推荐助手

- `site.ai_picker` → 构建期 `recommend-rules.json`
- 场景芯片 + 现实实例 + 路径步骤（`HomeRecommend.astro`）

## 3. 首页结构

| 区块     | id / 组件                        | 说明                                             |
| -------- | -------------------------------- | ------------------------------------------------ |
| 匹配助手 | Hero 内 `HomeRecommend`          | 先说要做什么                                     |
| AI 简报  | `#home-daily`                    | 模型 / GitHub / 资讯 + 近一个月视频精选 3 条     |
| 知识版图 | `#home-ai-map` `HomeAiMap.astro` | 绿色圈层可点；黄色基础学科只作图示，不在下方按钮 |
| 下一步   | `#home-community`                | 工具中心三榜、开源精选                           |

独立页（开源 / 课程 / 新闻 / 视频）用 `StandaloneLayout`，左侧「本页目录」扫可见的 `h2–h4`（跳过 `.visually-hidden`，避免 aria 标题进目录）。日更视频卡片标题不用 `h4`，以免目录被每条标题撑满。

无障碍：跳过链接 `#main-content`；知识版图绿色圈层是真正的 `<a>`，黄色基础学科为普通图形文字；动效尊重 `prefers-reduced-motion`。

## 4. 新闻热点页

- 主列表 `#daily-news-list`：`news.js` 按分类（新模型发布 / 新工具上线 / 开源项目 / 行业新闻 / 中文资讯）分组
- 量子位官网「热门文章」（近 30 天）并入上述分类，不单独成块；条目带 `window_hours: 720`，默认「近 7×24h」仍可见
- SSR 先输出最多 48 条，`news.js` hydrate 后按分类重绘
- 组件：`SsrNewsList.astro`；来源芯片 `NewsSourceChip.astro`

## 5. 内容漏斗

- `funnel.js`：统一 `journey_id` / `funnel_step`，对接 Umami / GA4

## 6. 虚拟列表

- `lib/virtual-list.js`：工具榜、GitHub 热门等长列表可视区渲染

## 7. 开源精选

- 数据：`site.oss_frameworks`（`fetch_oss_heating.py` 日更）；开源页优先读 `oss-projects.json`
- 页：`oss.html`；Hero「今日升温」取 `heat_score` 最高项
- 卡片右上角一枚热度条（`ossHeatLabel`，如 `日榜 #6 · 热度 205`）
- `audienceTags` 不含与顶栏 chip 重复的方向名（Agent / Coding Agent 等）
- 「本周上升最快」是方向内升幅，与 Trending 名次不是同一信号

## 8. 链接兜底

- `lib/link-guard.js`：外链 `noreferrer`、图片失败占位、GitHub 404 探测
- CSP 须含 `https://api.github.com`

## 9. SEO

- TDK / OG / Twitter：`SeoHead.astro` + `data/site.json` → `meta`
- JSON-LD：`src/lib/schema.ts`（WebSite / Organization / 工具 / 课程 / 新闻 / 开源 / 视频 ItemList + BreadcrumbList）
- 校验：`DIST=dist python3 scripts/validate_ci.py opengraph jsonld`

## 10. PWA 离线

- `manifest.webmanifest` + `sw.js`（同域，scope `/ai/`）
- 预缓存首页 / 开源 / 课程 / 工具中心 / 新闻 / 视频 / `search-index.json` / 知识库脚本
- JSON 走 stale-while-revalidate；无网导航回退已缓存首页
- CSP：`worker-src 'self'`；`sw.js` 不长缓存（`max-age=0`）
- 线上核对用强制刷新（Mac `Cmd+Shift+R`）或 `?v=` 缓存破坏

## 11. AI 视频

| 类型         | 入口                 | 数据                                                             |
| ------------ | -------------------- | ---------------------------------------------------------------- |
| 首页日更精选 | `#home-video-picks`  | `prepareVideos`：近 30 天、每平台播放量 Top 3，首页再合并取 3 条 |
| 专区完整列表 | `videos.html` 日更区 | YouTube 3 + B站 3；卡片封面、名次、时长                          |
| 用户粘贴     | `videos.html` 收藏   | `localStorage` + Cloudflare KV                                   |

展示：`src/components/SsrVideosList.astro` + `css/videos.css`。JSON 可含 `summary`，日更卡片不渲染摘要。  
用户页：`videos.js` · `lib/video-preview*.js` · Worker `/meta` 封面。跨设备见 [CLOUDFLARE-SYNC.md](./CLOUDFLARE-SYNC.md)。  
共享 sync 码默认 `bioai-videos`。

## 12. 页面脚本

独立页按需加载：`oss.js` / `courses.js` / `news.js` / `videos.js`。  
首页知识库 `knowledge.js` 在 idle 后加载。

## 相关

[SETUP.md](./SETUP.md) · [CONTENT-OPS.md](./CONTENT-OPS.md) · [SECURITY.md](./SECURITY.md)
