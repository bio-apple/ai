# Bio AI Lab

**Bio-Apple · AI 工具导航 · 开源 · 热点 · 视频**

[![Website](https://img.shields.io/badge/Website-Live-2563eb?style=flat-square)](https://bio-apple.github.io/ai/)
[![CI](https://img.shields.io/github/actions/workflow/status/bio-apple/ai/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/bio-apple/ai/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-0d8c6d?style=flat-square)](./LICENSE)

站点：https://bio-apple.github.io/ai/ · 开发说明：[DEVELOPER.md](./DEVELOPER.md)

## 快速开始

```bash
git clone https://github.com/bio-apple/ai.git && cd ai
npm ci && pip install -r requirements.txt
./build.sh && ./start.sh
```

本地预览：http://127.0.0.1:8765/ai/  
校验：`npm run quality && npm run build && DIST=dist python3 scripts/validate_ci.py`

## 做什么

- 工具分类 / 教程 / 替代互补关系 / 排行对比
- 推荐助手 · 站内搜索 · 学习回访
- 数据运营热榜（浏览 / 点击）
- 一周内 AI 热点（日更）· YouTube/B站每日视频 · GitHub Stars 开源精选

## 改内容

| 想改什么         | 改哪里                                                   |
| ---------------- | -------------------------------------------------------- |
| 文案 / 导航      | `data/site.json`                                         |
| 工具 / 关系      | `data/tools.json` · `data/tool-relations.json`           |
| 最佳实践Prompt库 | `prompts/`（分类模板） · `prompts/index.json`            |
| 热度基准         | `data/engagement.json`                                   |
| 排行榜           | `data/rankings.json`                                     |
| 分析 Secrets     | `UMAMI_*` / `CLOUDFLARE_BEACON_TOKEN`（可选 GA/Clarity） |

推送 `main` → Actions：质量检查 → 构建校验 → 部署 GitHub Pages。  
运维救急见 [docs/OPS-RUNBOOK.md](./docs/OPS-RUNBOOK.md)。

## License

MIT
