# Bio AI Lab 2.0 开发者文档

> AI 时代的个人智能入口  
> Discover · Learn · Build with AI

> **文档性质**：产品愿景 + **当前可落地能力说明**。  
> **生产栈**：Astro SSG + GitHub Pages + 可选 FastAPI（见根目录 [`DEVELOPER.md`](../DEVELOPER.md)）。  
> **线上地址**：https://bio-apple.github.io/ai/

------------------------------------------------------------------------

# 1. 项目介绍

Bio AI Lab 是面向个人用户的 AI 智能入口：发现工具、学习用法、跟踪趋势、构建个人工作流。

------------------------------------------------------------------------

# 2. 用户路径（已实现）

```
进入网站
  → 站内搜索（更快找到内容）
  → AI 推荐助手 / 场景选型（更容易选工具）
  → 工具教程 + 替代/互补关系
  → 学习路线 / 案例 / Prompt（更愿意回来）
  → Labs 工作流草稿（本地）
  → 静态 SEO 页可被 Google 发现
```

------------------------------------------------------------------------

# 3. 产品模块落地状态

| 模块 | 状态 | 实现 |
|------|------|------|
| Hero | ✅ | `index.astro` + `site.hero` |
| 站内搜索 | ✅ | Fuse + `search-index.json`（案例/Prompt 深链、类型标签） |
| AI 推荐助手 | ✅ | 场景点选 + 自由文本（`HomeRecommend` / `recommend.js`）；结果附带替代/互补 |
| 今日 AI 简报 | ✅ | `HomeAiDaily` + `pickAiDailyBrief()` |
| 热门工具 / 分类导航 | ✅ | 首页卡片 + `tools/hub.html` 八大分类 |
| 工具关系 | ✅ | `data/tool-relations.json` → 详情页「可切换替代 / 常一起用」+ Hub 预览 |
| 学习路线 | ✅ | `ai-learning-roadmap.html`（阶段勾选）+ guides |
| 学习回访 | ✅ | `progress.js`：最近打开 → 首页「继续学习」；收藏 `favorites.js` |
| 一周内 AI 热点 | ✅ | 每天更新 · 近 7 天窗口（`ai-news.json`） |
| 开源精选 | ✅ | `oss-projects.json` |
| 社区动态 | ✅ | 入口卡片（非 UGC） |
| AI Labs | ✅ | `labs/index.html`：Prompt Lab、模型体验外链、工作流草稿 |
| 知识库助手 | ✅ | 首页 FAB + Fuse；本地 FastAPI 时走 `/api/ask` |
| SEO | ✅ | sitemap `.html` 对齐、Standalone OG/Twitter、BreadcrumbList |

## 3.1 仍属远期（需新基建）

| 能力 | 原因 |
|------|------|
| 用户账户 / 云端同步收藏 | 需 Auth + DB |
| 向量 RAG（Chroma / pgvector） | 需 Embedding 与托管 |
| 真 LLM Agent / Tool Router | 需模型 API 与密钥 |
| Next.js 全站重写 | 与当前 Pages 流水线正交 |
| 真实社区 UGC | 需存储与审核 |

------------------------------------------------------------------------

# 4. 技术架构（生产）

```
data/*.json + src/ (Astro)
        ↓ npm run build
      dist/ → GitHub Pages (/ai/)
可选：FastAPI 预览 dist + /api/ask · /api/recommend · /api/search
```

目标栈（React/Next/Postgres）仍可作为未来选项，**不阻塞**当前产品迭代。

UI：延续现有蓝/青品牌与浅色主界面；不以「紫霓虹暗色」为目标默认皮肤。

------------------------------------------------------------------------

# 5. AI 能力（当前）

- **规则推荐**：关键词 → `ai_picker` 场景 → 工具 + 相关工具（`tool-relations`）+ 学习下一步  
- **BM25 / Fuse 问答**：站内索引检索（非向量库）  
- **工作流草稿 / 学习进度**：浏览器 localStorage，可导出 JSON  

------------------------------------------------------------------------

# 6. Roadmap

## 已交付（2.0 / 2.1 静态切片）

- 新首页结构  
- AI 工具中心（八类）  
- 分类系统 + 搜索增强（深链）  
- AI 推荐助手（文本 + 场景 + 关系）  
- 工具替代 / 互补关系  
- 本地收藏 + 最近学习 + 路线勾选  
- 一周内 AI 热点（日更 · 7 天窗）  
- AI Labs 薄版  
- SEO：sitemap / OG / BreadcrumbList  

## 后续（需托管）

- 云端账户  
- 向量 RAG  
- 可执行 Agent / 工作流引擎  

------------------------------------------------------------------------

# License

MIT License
