# 贡献指南

感谢关注 [Bio AI Lab](https://bio-apple.github.io/ai/)！本仓库是 **Astro 静态站 + GitHub Pages**，内容以 JSON / Markdown 为主，改完推 `main` 即可自动部署。

## 快速开始

```bash
git clone https://github.com/bio-apple/ai.git && cd ai
nvm use                    # Node 22，见 .nvmrc
npm ci
pip install -r requirements.txt   # 抓取 / 校验 / 本地 API（可选）
npm run build && npm run preview  # http://127.0.0.1:8766/ai/
```

提交前建议：

```bash
npm run quality
npm run build && DIST=dist python3 scripts/validate_ci.py
```

更完整的环境说明见 [docs/SETUP.md](./docs/SETUP.md)，开发速查见 [DEVELOPER.md](./DEVELOPER.md)。

---

## 内容快速路径

### 1. 新增 / 更新工具教程

1. 在 [`data/tools.json`](./data/tools.json) 追加或编辑一条（`id`、`name`、`description`、`getting_started_steps`、`features` 等）。
2. （可选）在 [`data/site.json`](./data/site.json) → `home_tool_categories` 放入首页分类卡。
3. （可选）在 [`data/tool-relations.json`](./data/tool-relations.json) 写替代 / 互补关系。
4. 本地 `npm run build`，打开 `dist/tools/{id}.html` 验收。

Schema：`schemas/tools.schema.json`（CI 会校验）。

### 2. 新增对比专题

1. 编辑 [`data/compares.json`](./data/compares.json)，新增一项：
   - `slug`（生成 `compare/{slug}.html`）
   - `title` / `meta_description` / `h1` / `lead` / `conclusion`
   - `table.headers` + `table.rows`
   - `sections`、`cta`、`search_keywords`
2. 参考现有 `cursor-vs-copilot` 条目结构即可。
3. 构建后预览：`/ai/compare/{slug}.html`。

### 3. 调整课程资源

- **名单与白名单**：[`config/courses-fetch.yaml`](./config/courses-fetch.yaml)
- **抓取**：`python3 scripts/fetch_ai_courses.py` → 写入 `ai-courses.json`
- **展示**：首页「课程资源」Tab（构建期 schema + 运行时加载）

路线顺序与「每条路线最多 5 门」等规则见 README「课程资源」与 [docs/CONTENT-OPS.md](./docs/CONTENT-OPS.md)。

### 4. 开源精选（多元仓库清单）

编辑 [`data/site.json`](./data/site.json) → `oss_frameworks`：

```json
{
  "repo": "org/name",
  "name": "显示名",
  "stars": 12345,
  "category": "agent | inference | vector | eval | local",
  "summary": "一句话简介"
}
```

| `category`  | 展示标签   |
| ----------- | ---------- |
| `agent`     | Agent 框架 |
| `inference` | 推理框架   |
| `vector`    | 向量库     |
| `eval`      | 评测工具   |
| `local`     | 本地部署   |

首页 `#section-oss` 按 `stars` 降序展示全部条目（建议每类 2–3 个，避免同质化）。

### 5. 实战案例文稿

1. 在 [`content/local-deploy/`](./content/local-deploy/) 新增 Markdown（见目录 `README.md`）。
2. 构建会生成 `data/local-deploy-guides.json` 与 `local/{id}.html`。

### 6. 文案 / 导航 / FAQ / 推荐场景

全部在 [`data/site.json`](./data/site.json)：

| 字段                    | 用途                           |
| ----------------------- | ------------------------------ |
| `nav` / `hero` / `meta` | 导航、Hero、TDK                |
| `faq`                   | 首页常见问题（同时进 JSON-LD） |
| `ai_picker`             | 推荐助手场景与示例             |
| `footer.links`          | 页脚链接                       |
| `tools_hub_page`        | 工具中心标题与 lead            |

---

## PR 建议

1. 从最新 `main` 开分支（本仓库云端约定：`cursor/<topic>-6078`）。
2. 一次 PR 聚焦一类改动（工具 / 对比 / 文案 / 脚本），便于 Review。
3. 跑通 `quality` + `build` + `validate_ci`；涉及 UI 时附截图或说明验收路径。
4. 不要提交 `dist/`、密钥或本机 `.venv`。

---

## 文档地图

| 文档                                         | 说明                         |
| -------------------------------------------- | ---------------------------- |
| [docs/CONTENT-OPS.md](./docs/CONTENT-OPS.md) | 日更抓取、运营清单、故障救急 |
| [docs/DATA-MODEL.md](./docs/DATA-MODEL.md)   | 字段与 Schema                |
| [docs/FRONTEND.md](./docs/FRONTEND.md)       | 搜索 / 推荐 / 埋点           |
| [docs/CI-CD.md](./docs/CI-CD.md)             | Actions 与部署               |
| [docs/SEO.md](./docs/SEO.md)                 | TDK / OG / JSON-LD           |

---

## 仓库 About / Topics（维护者）

GitHub App 令牌无法改仓库元数据时，请在仓库 **Settings → General** 手动设置：

- **Description**：`Bio AI Lab — AI 工具导航 · 开源精选 · 课程 · 热点 · 视频（Astro + GitHub Pages）`
- **Website**：`https://bio-apple.github.io/ai/`
- **Topics**（建议）：`ai-tools` · `astro` · `github-pages` · `ai-navigation` · `llm` · `chatgpt` · `open-source` · `static-site`

或使用有 `administration`/`metadata` 权限的 PAT：

```bash
gh api -X PATCH repos/bio-apple/ai \
  -f description='Bio AI Lab — AI 工具导航 · 开源精选 · 课程 · 热点 · 视频（Astro + GitHub Pages）' \
  -f homepage='https://bio-apple.github.io/ai/'

gh api -X PUT repos/bio-apple/ai/topics \
  -H 'Accept: application/vnd.github+json' \
  -f 'names[]=ai-tools' -f 'names[]=astro' -f 'names[]=github-pages' \
  -f 'names[]=ai-navigation' -f 'names[]=llm' -f 'names[]=chatgpt' \
  -f 'names[]=open-source' -f 'names[]=static-site'
```

---

## License

贡献内容默认按仓库 [MIT](./LICENSE) 许可。
