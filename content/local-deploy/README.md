# 本地部署文稿（Markdown）

把 `.md` 文件放进本目录后，执行：

```bash
npm run build
# 或仅刷新文稿产物：
node scripts/build-local-guides.mjs
```

构建会自动扫描本目录，生成 `data/local-deploy-guides.json`。

首页「本地部署」专区只展示**文稿列表**（标题、摘要、元信息），点击进入独立详情页：`/ai/local/{id}.html`。

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
draft: false
---

正文支持标题、段落、列表、引用与 ``` 代码块。
````

`order` 越小越靠前（默认 `100`）。
