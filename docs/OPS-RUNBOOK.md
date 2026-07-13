# 运维 Runbook（P0）

## 环境矩阵

| 环境 | 静态站 | `/api/*` | 数据来源 |
|------|--------|----------|----------|
| GitHub Pages | `dist/` | **无** | 仓库根 JSON + 构建产物 |
| 本地 `npm run preview` | `dist/` | 无 | 同上 |
| 本地 `./start.sh` / Docker | `dist/` via FastAPI | 有 | `runtime_path`: dist → public → 根 |

线上用户路径**不要假设**存在 `/api/ask`；知识库助手在 Pages 走客户端 Fuse。

## 坏批次回滚

### 视频 `daily-videos.json`

```bash
git log --oneline -- daily-videos.json | head
git checkout <good-sha> -- daily-videos.json video-thumbs/
git commit -m "revert: restore daily-videos from <good-sha>"
git push
```

### 新闻 `ai-news.json`

```bash
git checkout <good-sha> -- ai-news.json content/news/daily-ai-news.md
git commit -m "revert: restore ai-news from <good-sha>"
git push
```

### 开源 `oss-projects.json`

同时恢复 `data/oss-projects.json` 与根目录 `oss-projects.json`。

## 告警分级

| 级别 | 条件 | 动作 |
|------|------|------|
| P0 | 首页 / 关键 JSON 404 | 立刻查 Pages 部署与 `validate_ci` |
| P1 | 视频 >2 天未更新 / 新闻 >10 天 | `site-health` Issue；可手动 `workflow_dispatch` |
| P2 | 单平台短窗口为空 | metrics 警告，不阻断 |

## 抓取门禁

- `daily-videos.yml` 必须提交 `daily-videos.json` **与** `video-thumbs/`
- `fetch_oss_stars.py` 全失败 → 非零退出；需 `GITHUB_TOKEN`
- E2E 与 API smoke **阻断** CI `validate` job
