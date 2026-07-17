# CI/CD 与一键部署

本项目为纯前端静态站点，采用 **GitHub Actions** 在代码合并至 `main` 后自动构建并部署至 [GitHub Pages](https://bio-apple.github.io/ai/)。

## 部署流程

```mermaid
flowchart LR
  A[本地开发] --> B[合并至 main]
  B --> C[deploy.yml]
  C --> D[Lint & Format]
  D --> E[Build]
  E --> F[Deploy]
  F --> G[bio-apple.github.io/ai/]
```

1. **本地开发**：`npm run build` 生成 `dist/`（不提交）。
2. **合并 `main`**：push 或合并 PR 后自动触发 [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)。
3. **Lint & Format**：Prettier + ESLint。
4. **Build**：`prebuild` → Astro SSG → `dist/`，并运行 `validate_ci.py`（Schema、链接、密钥扫描等）。
5. **Deploy**：上传构建制品，由 `actions/deploy-pages` 发布至 GitHub Pages 环境。

> **说明**：本站使用 GitHub 官方 **Actions 制品部署**（`upload-pages-artifact` + `deploy-pages`），**不维护**独立的 `gh-pages` 分支。产物仅存在于 Actions 制品与 Pages CDN，与 `main` 源码分离。

## 工作流一览

| 工作流                                          | 触发                  | 作用                                                  |
| ----------------------------------------------- | --------------------- | ----------------------------------------------------- |
| [`deploy.yml`](../.github/workflows/deploy.yml) | push `main` · 手动    | **一键部署**：Lint → Build → Deploy Pages             |
| [`ci.yml`](../.github/workflows/ci.yml)         | push/PR `main` · 手动 | **质量门禁**：Lint → 构建 → 单元测试 → 全量校验 → E2E |
| `daily-videos.yml`                              | 每日 00:00（北京）    | 刷新视频数据，必要时派发 `deploy.yml`                 |
| `daily-news.yml`                                | 每日 06:00            | 刷新新闻，必要时派发部署                              |
| `weekly-oss.yml` / `weekly-courses.yml`         | 每周一                | 刷新开源/课程，必要时派发部署                         |
| `site-health.yml`                               | 定时                  | 线上探针                                              |
| `weekly-link-check.yml`                         | 每周一                | Dead Link 检测（lychee 外链扫描）                     |
| `deploy-cloudflare.yml`                         | push `main`           | 可选 Cloudflare Pages 镜像（需 Secrets）              |

push `main` 时 **`ci.yml` 与 `deploy.yml` 并行**：

- `ci.yml`：更重的测试（单元 + Playwright E2E），PR 也会运行。
- `deploy.yml`：精简路径，校验通过后尽快上线。

## 本地一键构建（部署前自检）

```bash
npm ci && pip install -r requirements.txt
cp .env.local.example .env.local   # 可选
npm run quality                    # Prettier + ESLint
npm run build                      # prebuild → Astro → dist/
DIST=dist python3 scripts/validate_ci.py
npm run test:unit && npm run test:e2e   # 与 CI 对齐
```

通过后再 push `main`，Actions 将自动完成线上部署。

## 手动重新部署

无需改代码时，可在 GitHub **Actions → Deploy → Run workflow** 手动触发 `deploy.yml`。

定时任务在数据有变更时会通过 `workflow_dispatch` 自动派发 `deploy.yml`（见各 `daily-*.yml` / `weekly-*.yml`）。

## 构建 Secrets（可选）

部署构建阶段可注入分析统计 ID（**非 LLM API Key**），配置于 GitHub Repository Secrets：

- `GA_MEASUREMENT_ID` · `CLARITY_PROJECT_ID`
- `UMAMI_SCRIPT_URL` · `UMAMI_WEBSITE_ID`
- `CLOUDFLARE_BEACON_TOKEN`

本地开发同名变量写入 `.env.local`（见 [SECURITY.md](./SECURITY.md)）。

## 故障排查

部署失败或线上 404 → 查看 [Deploy 工作流](https://github.com/bio-apple/ai/actions/workflows/deploy.yml) 与 [CI 工作流](https://github.com/bio-apple/ai/actions/workflows/ci.yml)，本地复现 `npm run build && DIST=dist python3 scripts/validate_ci.py`。详见 [OPS-RUNBOOK.md](./OPS-RUNBOOK.md)。
