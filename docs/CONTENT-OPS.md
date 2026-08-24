# 数据更新与内容运营

手工文案见 [DATA-MODEL.md](./DATA-MODEL.md)；本地环境见 [SETUP.md](./SETUP.md)。

## 1. 内容分类

| 类型 | 文件 | 上线 |
|------|------|------|
| 站点 / 工具 / 对比 | `data/*.json` | push `main` → `pages.yml` |
| 新闻 | `ai-news.json` | `daily-news.yml` |
| 开源升温 | `data/oss-projects.json` + `site.oss_frameworks` | `daily-oss.yml` |
| 课程 | `ai-courses.json` | `daily-courses.yml` |
| 排行榜 | `data/rankings.json` | `daily-rankings.yml` |
| 日更视频榜 | `daily-videos.json` | `daily-videos.yml`（仅手动） |
| 用户视频链接 | Cloudflare KV | 见 [CLOUDFLARE-SYNC.md](./CLOUDFLARE-SYNC.md) |

## 2. 定时任务（北京时间）

| 工作流 | Cron | 说明 |
|--------|------|------|
| [daily-news.yml](https://github.com/bio-apple/ai/actions/workflows/daily-news.yml) | **01:00 / 12:00** | 新闻（量子位 / 机器之心 / HF 等） |
| [daily-courses.yml](https://github.com/bio-apple/ai/actions/workflows/daily-courses.yml) | **02:00** | 课程 |
| [daily-oss.yml](https://github.com/bio-apple/ai/actions/workflows/daily-oss.yml) | **02:00** | 开源加热（含 OpenHands / AutoGPT 优先仓） |
| [daily-rankings.yml](https://github.com/bio-apple/ai/actions/workflows/daily-rankings.yml) | **03:00** | 排行榜 |
| [daily-videos.yml](https://github.com/bio-apple/ai/actions/workflows/daily-videos.yml) | **仅手动** | 首页视频 Tab（非 `videos.html`） |
| [site-health.yml](https://github.com/bio-apple/ai/actions/workflows/site-health.yml) | 定时 | 新鲜度探针 |
| [weekly-link-check.yml](https://github.com/bio-apple/ai/actions/workflows/weekly-link-check.yml) | 定时 | lychee（软告警） |

链路：抓取 → Prettier → commit → **显式派发** `pages.yml`（token push 不会自动触发 Deploy）。

## 3. 抓取脚本

| 脚本 | 配置 | 产出 |
|------|------|------|
| `fetch_ai_news.py` | `config/news-fetch.yaml` | `ai-news.json` |
| `fetch_oss_heating.py` | `config/oss-fetch.yaml` | `oss-projects.json` + `site.json` |
| `fetch_ai_courses.py` | `config/courses-fetch.yaml` | `ai-courses.json` |
| `fetch_rankings.py` | — | `data/rankings.json` |
| `fetch_daily_videos.py` | `config/video-fetch.yaml` | `daily-videos.json`（`min_views: 10000`） |

本地：`python3 scripts/fetch_ai_news.py`（或对应脚本）→ `npm run build`。

## 4. 救急

1. Actions → 对应 `daily-*` → **Run workflow**
2. 确认 commit 已 push，且 **Deploy GitHub Pages** 被派发成功
3. 抓取失败会开 `[ops]` Issue；lychee 失败不阻断数据上线
4. 首页「资讯更新于 / 今日升温」日期来自 JSON 的 `updated_at`（非构建日）

## 相关

- [CI-CD.md](./CI-CD.md) · [SETUP.md](./SETUP.md) · [CLOUDFLARE-SYNC.md](./CLOUDFLARE-SYNC.md)
