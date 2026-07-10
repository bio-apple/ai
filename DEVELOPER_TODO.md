# 开发待优化项（Developer TODO）

> 本文档记录项目优化规划与完成状态。

---

## P0（优先级最高）✅

| # | 功能 | 状态 |
|---|------|------|
| 1 | 全站搜索（Fuse.js + 本地索引，含 Prompt/案例） | ✅ 已完成 |
| 2 | 左侧导航目录 TOC（自动解析 h2/h3/h4） | ✅ 已完成 |
| 3 | 深色模式（localStorage + 系统主题） | ✅ 已完成 |
| 4 | 返回顶部按钮（滚动 >500px 显示） | ✅ 已完成 |
| 5 | 阅读进度条（顶部固定 0%~100%） | ✅ 已完成 |

---

## P1（近期优化）✅

| # | 功能 | 状态 |
|---|------|------|
| 6 | 数据驱动改造（`data/*.json` → 运行时 JSON） | ✅ 已完成 |
| 7 | Prompt 库独立模块 | ✅ 已完成 |
| 8 | AI 实战案例库增强 | ✅ 已完成 |
| 9 | 视频列表增强（排序/筛选/字段扩展） | ✅ 已完成 |
| 10 | 页面动画优化（Scroll Reveal） | ✅ 已完成 |

### P1 实现说明

| 模块 | 路径 |
|------|------|
| 数据配置 | `data/prompts.json` · `data/tutorials.json` · `data/videos.json` |
| 运行时数据 | `prompts.json` · `tutorials.json`（构建时从 `cases.json` 生成） |
| Prompt 库 | 站内 `#section-prompts` + `/prompts/library.html` |
| 案例库 | 增强 `#section-cases` + `/cases/index.html` |
| 视频增强 | `#video-toolbar` 平台筛选 + 热门/最新排序 |
| 动画 | `.reveal` + `ux.js` IntersectionObserver |

---

## P2（长期规划）

| # | 功能 | 状态 |
|---|------|------|
| 11 | Microsoft Clarity | 🔜 规划中 |
| 12 | Google Analytics 4 | 🔜 规划中 |
| 13 | FastAPI 后端 API | 🔜 规划中 |
| 14 | AI 知识库（RAG） | 🔜 规划中 |
| 15 | 自动死链检测 Action | 🔜 规划中 |

---

## 开发阶段

### 第一阶段 ✅ P0

- [x] 全站搜索 · 左侧导航 · 深色模式 · 返回顶部 · 阅读进度条

### 第二阶段 ✅ P1

- [x] Prompt 库
- [x] 案例库
- [x] 数据驱动改造
- [x] 视频增强
- [x] Scroll Reveal 动画

### 第三阶段 🔜 P2 分析/后端

- [ ] Clarity · GA4 · FastAPI

### 第四阶段 🔜 AI 知识库

- [ ] RAG 问答 · 推荐系统
