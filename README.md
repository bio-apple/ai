# Bio AI Lab

**AI learning and tools navigation platform.**

Discover, learn, and create with AI — covering ChatGPT, Claude, Gemini, DeepSeek, Kimi, Cursor, Copilot, and more.

**Website:** https://bio-apple.github.io/ai/

[![Website](https://img.shields.io/badge/Website-bio--apple.github.io%2Fai-6366F1?style=for-the-badge)](https://bio-apple.github.io/ai/)
[![Documentation](https://img.shields.io/badge/Documentation-DEVELOPER.md-06B6D4?style=for-the-badge)](./DEVELOPER.md)
[![GitHub](https://img.shields.io/badge/GitHub-bio--apple%2Fai-111827?style=for-the-badge)](https://github.com/bio-apple/ai)

## Screenshot

| 首页 Hero | 工具卡片 | 学习流程 |
|-----------|----------|----------|
| ![首页](og-image.png) | 热门工具横向卡片 + 推荐指数 | [AI 学习路线](https://bio-apple.github.io/ai/ai-learning-roadmap.html) |

> 线上预览：[https://bio-apple.github.io/ai/](https://bio-apple.github.io/ai/)

## Features

| 功能 | 支持 |
|------|------|
| AI 工具导航 | ✅ |
| 使用教程 | ✅ |
| 模型比较 | ✅ |
| 学习路线 | ✅ |
| AI 工具排行榜 | ✅ |
| AI 选择助手 | ✅ |
| AI 新闻资讯 | ✅ |
| Prompt 提示词库 | ✅ |
| AI 实战案例库 | ✅ |
| AI 创作工具 | ✅ |
| 实战案例 | ✅ |
| 每日视频推荐 | ✅ |

## 涵盖工具

| 类型 | 工具 |
|------|------|
| 国际对话 AI | ChatGPT、Claude、Gemini |
| 国内对话 AI | Kimi、通义千问、豆包、DeepSeek |
| 编程与开发 AI | Cursor、Codex、Copilot |

## 页面结构

```
首页
├── Hero 首屏
├── 热门 AI 工具
├── AI 能力分类
├── AI 工具排行榜
├── AI 学习路线
├── 今日 AI 热点
├── AI 选择助手
├── AI 创作
├── AI 教程
├── AI 新闻
└── 视频资源

独立 SEO 页
├── /tools/{tool}.html
├── /ai-tools-ranking.html
├── /ai-learning-roadmap.html
├── /guides/beginner.html
├── /guides/advanced.html
├── /news/daily-ai-news.html
└── /compare/*.html
```

## 访问方式

**GitHub Pages（推荐）**：https://bio-apple.github.io/ai/

**本地预览**：

```bash
cd ai
./start.sh
```

访问 http://127.0.0.1:8765

**开发者文档**：[DEVELOPER.md](./DEVELOPER.md)

## 每日自动更新

| 内容 | 时间（北京时间） | 工作流 |
|------|------------------|--------|
| AI 视频 | 每日 00:00 | `Daily AI Video Update` |
| AI 新闻 | 每日 06:00 | `Daily AI News Update` |

```bash
pip install yt-dlp pyyaml
python scripts/fetch_daily_videos.py
python scripts/fetch_ai_news.py
```

## Roadmap

| 阶段 | 内容 | 状态 |
|------|------|------|
| Phase 1 | 首页重构、新导航、工具卡片、UI 升级 | ✅ 已完成 |
| Phase 2 | AI 排行榜、选择助手、AI 新闻、创作区、指南页 | ✅ 已完成 |
| Phase 2.5 | Prompt 库、案例库、视频筛选、数据 JSON 导出 | ✅ 已完成 |
| Phase 3 | 用户收藏、站内搜索增强、GitHub Trending / arXiv 采集 | 🔜 规划中 |

## 部署

推送到 `main` 分支后，GitHub Actions 自动构建并更新 GitHub Pages 静态站点。

## License

MIT — see [GitHub repository](https://github.com/bio-apple/ai).
