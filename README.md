# Bio AI Lab

**Bio-Apple · AI 工具导航 · 开源 · 课程 · 热点 · 视频**

[![Website](https://img.shields.io/badge/Website-Live-2563eb?style=flat-square)](https://bio-apple.github.io/ai/)
[![CI](https://img.shields.io/github/actions/workflow/status/bio-apple/ai/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/bio-apple/ai/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-0d8c6d?style=flat-square)](./LICENSE)

站点：https://bio-apple.github.io/ai/

| 文档 | 说明 |
| ---- | ---- |
| [docs/SETUP.md](./docs/SETUP.md) | 环境搭建与本地预览 |
| [docs/CONTENT-OPS.md](./docs/CONTENT-OPS.md) | 内容运营与抓取 |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | 系统架构 |
| [docs/DATA-MODEL.md](./docs/DATA-MODEL.md) | 数据模型 |
| [docs/FRONTEND.md](./docs/FRONTEND.md) | 前端能力（搜索 / 虚拟列表 / 漏斗等） |
| [docs/CONTENT-FUNNEL.md](./docs/CONTENT-FUNNEL.md) | 内容漏斗与分析事件 |
| [DEVELOPER.md](./DEVELOPER.md) | 开发说明 |
| [docs/SEO.md](./docs/SEO.md) | TDK / OG / JSON-LD |
| [docs/SECURITY.md](./docs/SECURITY.md) | 安全与 CSP |
| [docs/CI-CD.md](./docs/CI-CD.md) | CI/CD 与部署 |
| [docs/OPS-RUNBOOK.md](./docs/OPS-RUNBOOK.md) | 运维救急 |

## 快速开始

```bash
git clone https://github.com/bio-apple/ai.git && cd ai
nvm use                    # Node 22，见 .nvmrc
npm ci && pip install -r requirements.txt
./build.sh && ./start.sh
```

本地预览：**http://127.0.0.1:8765/ai/**  
校验：`npm run quality && npm run build && DIST=dist python3 scripts/validate_ci.py`

```bash
# 仅构建静态站（不启本地 API）
npm run build && npx astro preview --host 127.0.0.1 --port 8766

# 刷新数据（按需）
python3 scripts/fetch_ai_news.py
python3 scripts/fetch_ai_courses.py
python3 scripts/fetch_oss_stars.py
python3 scripts/fetch_daily_videos.py
```

> **环境要求**：Node.js **22.x**（`.nvmrc`）· Python **3.12**（抓取/校验/本地 API）  
> **部署**：GitHub Pages 强制 HTTPS，静态资源由 CDN 提供 Gzip/Brotli；JS/CSS 带内容哈希 `?v=` 防缓存脏读。  
> 详尽搭建、三种预览模式与故障排除 → **[docs/SETUP.md](./docs/SETUP.md)**

## 做什么

首页频道（`data/site.json` → `nav.tabs`）：

| 频道     | 说明                                                     |
| -------- | -------------------------------------------------------- |
| 推荐助手 | 按场景推荐工具与入门路径                                 |
| 工具中心 | 对比表、AICPB 排行、各工具教程页                         |
| 开源精选 | GitHub AI 项目（≥5 万 Star Top5 + 中文 Top1 · 周一刷新） |
| 课程资源 | 免费 AI 课程，按五条学习路线编排，每段最多 5 门          |
| 新闻热点 | 近 7 天 AI 热点（与开源精选去重）                        |
| AI 视频  | 每日 YouTube 精选                                        |

独立页：学习路线图 · 零基础/进阶指南 · 工具排行榜 · 每日新闻页

### 前端能力（摘要）

| 能力 | 说明 |
| ---- | ---- |
| 全站搜索 | 顶栏 + Hero；索引覆盖工具/资讯/开源/课程/视频/模型；联想与历史 |
| 内容漏斗 | `funnel.js` 统一 `journey_id` / `funnel_step`，对接 Umami/GA4 等 |
| 虚拟列表 | 视频、工具榜、GitHub 热门长列表可视区渲染 |
| 开源卡片 | Stars / 语言 / 用途 / 仓库直达（`OssCard`） |
| 链接兜底 | `link-guard`：外链 noreferrer、图片失败兜底、GitHub 404 提示 |
| SEO | Open Graph + JSON-LD（工具 / 课程 / 新闻 / 开源） |

详见 [docs/FRONTEND.md](./docs/FRONTEND.md)。

## 课程资源（概要）

学习路线（顺序固定）：

**入门 → 机器学习 → 深度学习 → LLM 大模型 → AI Agent**

- **仅免费**；每条路线最多 **5** 门推荐（必学/合集优先）
- **必收录**：微软 Generative AI for Beginners、Google ML Crash Course、吴恩达 ML / Deep Learning Specialization、斯坦福 CS224n / CS231n / CS336、DeepLearning.AI 短课程合集
- **去重**：URL/标题唯一；合集不与下属单课并列；新闻 GitHub 条目不重复出现在开源精选

配置：`config/courses-fetch.yaml` · 抓取：`scripts/fetch_ai_courses.py` · 数据：`ai-courses.json` · 周更：`.github/workflows/weekly-courses.yml`

## 改内容

| 想改什么    | 改哪里                                                   |
| ----------- | -------------------------------------------------------- |
| 文案 / 导航 | `data/site.json`                                         |
| 工具 / 关系 | `data/tools.json` · `data/tool-relations.json`           |
| 对比表行    | `data/site.json` → `compare_table`                       |
| 排行榜      | `data/rankings.json`（或 `fetch_rankings.py`）           |
| 热度基准    | `data/engagement.json`                                   |
| 开源精选    | `oss-projects.json` / `data/oss-projects.json`           |
| 课程资源    | `config/courses-fetch.yaml` → 运行 `fetch_ai_courses.py` |
| 新闻源      | `config/news-fetch.yaml`                                 |
| 视频源      | `config/video-fetch.yaml`                                |

推送 `main` → Actions：质量检查 → 构建校验 → 部署 GitHub Pages。

**工程实践**：`lib/fetch-json.js` / `virtual-list.js` / `link-guard.js` · 视频 slim JSON · CSS `?v=` 哈希 · CI（Schema / OG / JSON-LD / 搜索 / gitleaks）· 周检 lychee 死链。

## License

MIT
