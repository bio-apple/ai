# 数据更新与内容运营

手工文案见 [DATA-MODEL.md](./DATA-MODEL.md)；本地环境见 [SETUP.md](./SETUP.md)。

## 1. 内容分类

| 类型               | 文件                                             | 上线                                          |
| ------------------ | ------------------------------------------------ | --------------------------------------------- |
| 站点 / 工具 / 排行 | `data/*.json`                                    | push `main` → `pages.yml`                     |
| 新闻               | `ai-news.json`                                   | `daily-news.yml`                              |
| 开源升温           | `data/oss-projects.json` + `site.oss_frameworks` | `daily-oss.yml`                               |
| 课程               | `ai-courses.json`                                | `daily-courses.yml`                           |
| 排行榜             | `data/rankings.json`                             | `daily-rankings.yml`                          |
| 日更视频榜         | `daily-videos.json`                              | `daily-videos.yml`（每天 04:00 北京）         |
| 用户视频链接       | Cloudflare KV                                    | 见 [CLOUDFLARE-SYNC.md](./CLOUDFLARE-SYNC.md) |

## 2. 定时任务（北京时间）

| 工作流                                                                                           | Cron              | 说明                                      |
| ------------------------------------------------------------------------------------------------ | ----------------- | ----------------------------------------- |
| [daily-news.yml](https://github.com/bio-apple/ai/actions/workflows/daily-news.yml)               | **01:00 / 12:00** | 新闻（RSS + 量子位官网首页热门 30 天）    |
| [daily-courses.yml](https://github.com/bio-apple/ai/actions/workflows/daily-courses.yml)         | **02:00**         | 课程                                      |
| [daily-oss.yml](https://github.com/bio-apple/ai/actions/workflows/daily-oss.yml)                 | **02:00**         | 开源加热（含 OpenHands / AutoGPT 优先仓） |
| [daily-rankings.yml](https://github.com/bio-apple/ai/actions/workflows/daily-rankings.yml)       | **03:00**         | 排行榜                                    |
| [daily-videos.yml](https://github.com/bio-apple/ai/actions/workflows/daily-videos.yml)           | **04:00**         | YouTube / B站近 1 个月播放量 Top 3        |
| [site-health.yml](https://github.com/bio-apple/ai/actions/workflows/site-health.yml)             | **08:00 / 20:00** | 新鲜度探针 + 顶栏独立页内容探针           |
| [weekly-link-check.yml](https://github.com/bio-apple/ai/actions/workflows/weekly-link-check.yml) | 定时              | lychee（软告警）                          |

链路：抓取 → Prettier → commit → **显式派发** `pages.yml`（token push 不会自动触发 Deploy）。

## 3. 抓取脚本

| 脚本                    | 配置                        | 产出                                                               |
| ----------------------- | --------------------------- | ------------------------------------------------------------------ |
| `fetch_ai_news.py`      | `config/news-fetch.yaml`    | `ai-news.json`（主列表 7×24h + `qbitai_hot` 官网热门 30 天）       |
| `fetch_oss_heating.py`  | `config/oss-fetch.yaml`     | `oss-projects.json` + `site.json`                                  |
| `fetch_ai_courses.py`   | `config/courses-fetch.yaml` | `ai-courses.json`                                                  |
| `fetch_rankings.py`     | —                           | `data/rankings.json`                                               |
| `fetch_daily_videos.py` | `config/video-fetch.yaml`   | `daily-videos.json`（近 1 个月、每平台 Top 3、`min_views: 10000`） |

本地：`python3 scripts/fetch_ai_news.py`（或对应脚本）→ `npm run build`。

量子位热门：抓官网首页 `<!--热门文章 start-->` … `end` 区块，只保留近 30 天，用与 RSS 相同的 `category_keywords` 分进既有分类后写入 `items`（并保留 `qbitai_hot` 副本）。新闻热点页按分类展示，无单独热门专区。

## 4. 救急

1. Actions → 对应 `daily-*` → **Run workflow**
2. 确认 commit 已 push，且 **Deploy GitHub Pages** 被派发成功
3. 抓取失败会开 `[ops]` Issue；lychee 失败不阻断数据上线
4. 首页「资讯更新于 / 今日升温」日期来自 JSON 的 `updated_at`（非构建日）
5. 视频 YouTube 半壁依赖仓库 Secret `YOUTUBE_API_KEY`；为空先查 Secrets 再手动 Run
6. 线上视频/首页改版若仍是旧 UI：强制刷新（PWA 缓存 HTML）
7. `site-health.yml` 失败：对照 run 日志「建议处置」，再按本表重跑对应日更。探针覆盖首页、工具中心、开源、课程、新闻、视频，以及新闻/视频/课程 JSON 新鲜度。

### 告警分级

| 级  | 现象                         | 处置                                                           |
| --- | ---------------------------- | -------------------------------------------------------------- |
| P0  | 页面/资源不可达，或正文异常  | 查 Pages 最近一次部署；本地 `npm run build` + `validate_ci.py` |
| P1  | 新闻 / 视频 / 课程 JSON 过期 | 重跑对应 `daily-*`；仍失败则回滚该 JSON 到上一好批次           |

回滚：在仓库历史中检出上一份可用的 `ai-news.json` / `daily-videos.json` / `ai-courses.json`，提交后显式派发 `pages.yml`。

## 相关

- [CI-CD.md](./CI-CD.md) · [SETUP.md](./SETUP.md) · [CLOUDFLARE-SYNC.md](./CLOUDFLARE-SYNC.md)
