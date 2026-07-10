# Bio AI

**Your AI learning and tools navigation platform.**

Discover, learn, and create with AI — covering ChatGPT, Claude, Gemini, DeepSeek, Kimi, Cursor, Copilot, and more.

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
├── AI 使用场景
├── AI 选择助手
├── AI 学习路线
├── 精选教程
└── 视频资源

独立 SEO 页
├── /tools/{tool}.html
├── /ai-tools-ranking.html
├── /ai-learning-roadmap.html
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

## 每日视频自动更新

- **更新时间**：北京时间每日 `00:00`（GitHub Actions 定时任务）
- **来源**：YouTube + B站
- **分类**：全网播放量 Top 10 + 过去一周上新 Top 10
- **手动触发**：GitHub → Actions → `Daily AI Video Update` → Run workflow

```bash
pip install yt-dlp
python scripts/fetch_daily_videos.py
```

## 部署

推送到 `main` 分支后，GitHub Actions 自动更新 GitHub Pages 静态站点。

## License

MIT — see [GitHub repository](https://github.com/bio-apple/ai).
