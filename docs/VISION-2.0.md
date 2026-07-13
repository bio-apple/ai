# Bio AI Lab 2.0 开发者文档

> AI 时代的个人智能入口  
> Discover · Learn · Build with AI

> **文档性质**：产品愿景与目标架构（Roadmap），**不是**当前线上实现说明。  
> **当前生产栈**（Astro SSG + GitHub Pages + 可选 FastAPI）：见根目录 [`DEVELOPER.md`](../DEVELOPER.md)。  
> **线上地址**：https://bio-apple.github.io/ai/

------------------------------------------------------------------------

# 1. 项目介绍

## 1.1 项目定位

Bio AI Lab 不只是一个 AI 工具导航网站，而是一个面向个人用户的 AI
智能入口平台。

帮助用户：

-   发现 AI 工具
-   学习 AI 技术
-   使用 AI 提升效率
-   构建个人 AI 工作流

## 1.2 产品目标

打造：

    AI 工具发现
    +
    AI 学习平台
    +
    AI 趋势中心
    +
    AI 工作助手

的一站式 AI 门户。

------------------------------------------------------------------------

# 2. 产品架构

## 2.1 用户路径

    用户进入网站
            ↓
    了解 AI 趋势
            ↓
    AI 推荐助手分析需求
            ↓
    推荐最佳工具
            ↓
    学习使用方法
            ↓
    创建个人 AI 工作流

------------------------------------------------------------------------

# 3. 产品模块设计

## 3.1 首页 Home

页面结构：

    Home

    ├── Hero 区
    ├── AI 推荐助手
    ├── 今日 AI 简报
    ├── 热门 AI 工具
    ├── AI 学习路线
    ├── 开源项目精选
    └── 社区动态

------------------------------------------------------------------------

# 3.2 Hero 区

目标：

第一屏建立品牌认知。

文案：

    让每个人拥有自己的 AI 工作流

    发现、学习并使用下一代 AI 工具

CTA：

    探索 AI 工具

    开始 AI 学习

------------------------------------------------------------------------

# 3.3 AI 推荐助手

功能目标：

通过用户需求推荐 AI 工具。

示例：

用户输入：

    我想开发一个网站

系统输出：

    推荐工具：

    1. Cursor
    2. Claude
    3. ChatGPT

    学习路线：

    HTML
     ↓
    React
     ↓
    AI Coding
     ↓
    部署上线

------------------------------------------------------------------------

# 3.4 AI 工具中心

分类：

    AI 工具

    ├── AI 助手
    ├── AI 编程
    ├── AI 写作
    ├── AI 图片
    ├── AI 视频
    ├── AI 音频
    ├── AI 办公
    └── AI Agent

工具数据模型：

```json
{
  "name": "ChatGPT",
  "company": "OpenAI",
  "category": ["assistant", "coding"],
  "description": "通用AI助手",
  "rating": 5,
  "tags": ["写作", "编程", "图片"],
  "url": "",
  "price": "free"
}
```

------------------------------------------------------------------------

# 3.5 AI Daily

每日 AI 简报：

    今日模型更新

    GitHub热门项目

    AI行业新闻

    推荐工具

    学习内容

数据来源：

-   官方 Blog
-   GitHub Trending
-   HuggingFace
-   arXiv

------------------------------------------------------------------------

# 3.6 AI Labs

AI 实验空间：

    Prompt Lab

    Agent Playground

    模型体验

    AI Demo

------------------------------------------------------------------------

# 4. 技术架构

## 4.1 前端架构

目标栈（2.0）：

    React
    +
    Next.js
    +
    TypeScript
    +
    Tailwind CSS

目录：

    src

    ├── app
    ├── components
    ├── features
    ├── data
    ├── hooks
    └── utils

> **现状对照**：1.x 为 Astro SSG + 原生 CSS 模块（`css/*.css`），部署于 GitHub Pages；2.0 迁移需单独评估 SSR/托管与现有 Actions 流水线。

------------------------------------------------------------------------

# 4.2 UI设计规范

Design System（目标稿）：

颜色：

```css
Primary: #6366F1
Secondary: #22D3EE
Background: #050816
```

风格：

    Dark Mode
    Glass UI
    Gradient
    AI Neon

> **落地注意**：实现 UI 时应与现有站点视觉语言协调；避免默认堆叠「紫渐变 + 全站暗色 + 霓虹光效」的同质化外观，优先保留品牌辨识度与可读性。

------------------------------------------------------------------------

# 4.3 后端架构

    Frontend
    ↓
    API Gateway
    ↓
    Backend Service
    ↓
    Database
    ↓
    AI Service

技术：

    Node.js / Python
    FastAPI
    PostgreSQL
    Redis
    Vector Database

> **现状对照**：1.x 可选本地 FastAPI 仅用于预览 `dist/`；无账户体系与持久化业务库。

------------------------------------------------------------------------

# 5. AI 能力架构

## 5.1 AI Agent

    User
     ↓
    AI Agent
     ↓
    Tool Router
     ↓
    Knowledge Base
     ↓
    LLM
     ↓
    Response

支持：

-   工具推荐
-   问答
-   学习规划
-   工作流生成

------------------------------------------------------------------------

## 5.2 RAG 知识库

数据：

    AI工具介绍
    教程
    新闻
    论文
    Github项目

流程：

    Documents
     ↓
    Embedding
     ↓
    Vector Database
     ↓
    Retriever
     ↓
    LLM

推荐：

-   Chroma
-   Milvus
-   pgvector

------------------------------------------------------------------------

# 6. 数据结构

## Tool

```typescript
interface Tool {
  id: string;
  name: string;
  logo: string;
  category: string[];
  description: string;
  rating: number;
  url: string;
  tags: string[];
}
```

------------------------------------------------------------------------

# 7. GitHub 项目结构

目标单体/多包结构：

    bio-ai-lab
    ├── README.md
    ├── docs
    │   ├── architecture.md
    │   ├── api.md
    │   └── design.md
    ├── frontend
    ├── backend
    ├── database
    ├── ai
    │   ├── agents
    │   ├── rag
    │   └── prompts
    └── deploy
        ├── docker
        └── nginx

> **现状对照**：当前仓库为单仓静态站（`src/` + `data/` + `scripts/`），2.0 拆分可渐进进行。

------------------------------------------------------------------------

# 8. 开发规范

## Git 分支

    main
    develop
    feature/*
    bugfix/*

## Commit规范

格式：

    type(scope): message

示例：

    feat(tool): add AI ranking
    fix(ui): improve mobile layout
    docs(readme): update docs

------------------------------------------------------------------------

# 9. Roadmap

## Version 2.0

-   新首页
-   AI工具中心
-   分类系统
-   搜索

## Version 2.1

-   AI推荐助手
-   收藏系统
-   用户账户

## Version 3.0

目标：

    个人AI工作台
    +
    AI Agent
    +
    AI Workflow

------------------------------------------------------------------------

# 10. 未来愿景

Bio AI Lab:

不是：

    AI工具列表

而是：

    每个人进入AI时代的入口

    发现AI
    学习AI
    使用AI
    创造AI

------------------------------------------------------------------------

# 与 1.x 能力映射（便于渐进迁移）

| 2.0 模块 | 1.x 现状（可复用） |
|----------|-------------------|
| Hero / 搜索 / 热门工具 | 首页 Hero、站内搜索、工具卡片与推荐标签 |
| AI Daily | `ai-news.json` + 每周抓取；`daily-videos.json` 每日视频 |
| 开源精选 | `oss-projects.json` + Star 刷新 |
| 工具中心 | `data/tools.json`、分类卡片、独立工具页 |
| AI 推荐助手 | 尚未上线（2.1） |
| RAG / Agent | 本地可选 BM25 `/api/ask`（非向量库） |

------------------------------------------------------------------------

# License

MIT License
