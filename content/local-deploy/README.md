# 实战案例文稿（Markdown）

把 `.md` 文件放进本目录后，执行：

```bash
npm run build
# 或仅刷新文稿产物：
node scripts/build-local-guides.mjs
```

构建会自动扫描本目录，生成 `data/local-deploy-guides.json`，并为每篇文稿生成独立详情页：`/ai/local/{id}.html`。

文稿可通过站内搜索与内链访问；首页不再展示实战案例列表专区。

## 约定

| 项            | 说明                                                   |
| ------------- | ------------------------------------------------------ |
| 文件名        | `*.md`（`README.md` 不会被收录）                       |
| `id`          | 默认取文件名（不含扩展名），可用 frontmatter `id` 覆盖 |
| 详情页        | `local/{id}.html`（`src/pages/local/[slug].astro`）    |
| `draft: true` | 跳过，不发布                                           |

## Frontmatter 示例

````markdown
---
title: 文稿标题
lead: 一句话摘要
order: 10
audience: Linux 服务器
stack: [Ollama, systemd]
created_at: 2026-07-30
draft: false
---

正文支持标题、段落、列表、引用与 ``` 代码块。
````

`order` 越小越靠前（默认 `100`）。`created_at` 可省略，构建时会从文件元数据自动补全。
