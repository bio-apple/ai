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
进入网站 → AI Daily / 趋势
        → AI 推荐助手（文本或场景）
        → 工具中心 / 教程
        → 学习路线 / 案例 / Prompt
        → Labs 工作流草稿（本地）
```

------------------------------------------------------------------------

# 3. 产品模块落地状态

| 模块 | 状态 | 实现 |
|------|------|------|
| Hero | ✅ | `index.astro` + `site.hero` |
| AI 推荐助手 | ✅ | 场景点选 + 自由文本规则匹配（`HomeRecommend` / `recommend.js`）；本地 API `POST /api/recommend` |
| 今日 AI 简报 | ✅ | `HomeAiDaily` + `pickAiDailyBrief()` |
| 热门工具 / 分类导航 | ✅ | 首页卡片 + `tools/hub.html` 八大分类 |
| 学习路线 | ✅ | 首页 + guides + roadmap |
| 开源精选 | ✅ | `oss-projects.json` |
| 社区动态 | ✅ | 入口卡片（非 UGC） |
| AI Labs | ✅ | `labs/index.html`：Prompt Lab 入口、模型体验外链、工作流草稿（localStorage） |
| 本地收藏 | ✅ | `favorites.js`（无账户） |
| 知识库助手 | ✅ | 首页 FAB + Fuse；本地 FastAPI 时走 `/api/ask` |
| 搜索 | ✅ | Fuse + 含案例/Prompt/Labs/工具中心的 `search-index.json` |

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

- **规则推荐**：关键词 → `ai_picker` 场景 → 工具 + 学习步骤  
- **BM25 / Fuse 问答**：站内索引检索（非向量库）  
- **工作流草稿**：浏览器 localStorage，可导出 JSON  

------------------------------------------------------------------------

# 6. Roadmap

## 已交付（2.0 / 2.1 静态切片）

- 新首页结构  
- AI 工具中心（八类）  
- 分类系统 + 搜索增强  
- AI 推荐助手（文本 + 场景）  
- 本地收藏  
- AI Labs 薄版  

## 后续（需托管）

- 云端账户  
- 向量 RAG  
- 可执行 Agent / 工作流引擎  

------------------------------------------------------------------------

# License

MIT License
