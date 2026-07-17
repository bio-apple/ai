# Bio AI Lab

**Bio-Apple · AI 工具导航 · 开源 · 课程 · 热点 · 视频**

[![Website](https://img.shields.io/badge/Website-Live-2563eb?style=flat-square)](https://bio-apple.github.io/ai/)
[![CI](https://img.shields.io/github/actions/workflow/status/bio-apple/ai/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/bio-apple/ai/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-0d8c6d?style=flat-square)](./LICENSE)

站点：https://bio-apple.github.io/ai/ · 开发说明：[DEVELOPER.md](./DEVELOPER.md) · 运维：[docs/OPS-RUNBOOK.md](./docs/OPS-RUNBOOK.md)

## 快速开始

```bash
git clone https://github.com/bio-apple/ai.git && cd ai
npm ci && pip install -r requirements.txt
./build.sh && ./start.sh
```

本地预览：http://127.0.0.1:8765/ai/  
校验：`npm run quality && npm run build && DIST=dist python3 scripts/validate_ci.py`

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

**工程实践**：共享 `lib/fetch-json.js` · 视频 slim JSON · 首页去重 HTML · CI 一次校验 · a11y/缓存/重试 UI。

## License

MIT
