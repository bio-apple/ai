# AI 应用指南

学习如何使用与应用人工智能——覆盖 ChatGPT、Claude、Gemini、DeepSeek、Kimi、通义千问、豆包、Copilot、Cursor、Codex 等主流工具。

## 项目路径

| 环境 | 路径 |
|------|------|
| GitHub 仓库 | https://github.com/bio-apple/ai |
| 本地目录 | `/Users/yfan/Desktop/bio-apple/ai` |
| 线上地址 | https://bio-apple.github.io/ai/ |

## 功能

- 📖 十大 AI 工具教程：使用方法、核心功能、官方文档
- 🎯 应用场景：写作、学习、编程、数据分析、图像视频、工作效率
- ⚡ Step-by-Step 实战案例

## 涵盖工具

| 类型 | 工具 |
|------|------|
| 国际对话 AI | ChatGPT、Claude、Gemini |
| 国内对话 AI | Kimi、通义千问、豆包、DeepSeek |
| 编程与开发 AI | Cursor、Codex、Copilot |

## 访问方式

**GitHub Pages（推荐）**：https://bio-apple.github.io/ai/

**本地预览**（可选）：

```bash
cd ai
./start.sh
```

访问 http://127.0.0.1:8765

**开发者文档**：[DEVELOPER.md](./DEVELOPER.md)（架构、数据格式、CI/CD、内容维护）

## 每日视频自动更新

- **更新时间**：北京时间每日 `00:00`（GitHub Actions 定时任务）
- **数量**：每天至少 10 条新视频
- **标准**：AI 应用相关 · 1080p 及以上 · 按播放量与频道订阅数综合排序
- **手动触发**：GitHub → Actions → `Daily AI Video Update` → Run workflow

本地手动抓取：

```bash
pip install yt-dlp
python scripts/fetch_daily_videos.py
```

## 部署

推送到 `main` 分支后，GitHub Actions 会自动更新 GitHub Pages 静态站点。
