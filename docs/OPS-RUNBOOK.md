# 运维 Runbook（P0）

## 环境矩阵

| 环境 | 静态站 | `/api/*` | 数据来源 |
|------|--------|----------|----------|
| GitHub Pages | `dist/` | **无** | 仓库根 JSON + 构建产物 |
| 本地 `npm run preview` | `dist/` | 无 | 同上 |
| 本地 `./start.sh` / Docker | `dist/` via FastAPI | 有 | `runtime_path`: dist → public → 根 |

线上用户路径**不要假设**存在 `/api/ask`；知识库助手在 Pages 走客户端 Fuse。

## 告警 → 动作（决策树）

```
Site Health / Issue 打开
        │
        ├─ 首页或 style/JSON 404 ──────────────► P0：查 Pages/CI 部署 → 本地 build+validate → 重部署
        ├─ daily-videos 过期 ──────────────────► P1：workflow_dispatch daily-videos（可 force）
        │                                         确认 thumbs 一并提交 → 仍挂则回滚 JSON+thumbs
        ├─ ai-news 过期 ───────────────────────► P1：workflow_dispatch daily-news → 回滚新闻产物
        └─ 抓取 metrics 严重不足 ──────────────► 看 Step Summary → 修源/配额 → 重跑 → 必要时回滚
```

快捷链接（替换为你的仓库若 fork）：

- [Daily videos](https://github.com/bio-apple/ai/actions/workflows/daily-videos.yml)
- [Daily news](https://github.com/bio-apple/ai/actions/workflows/daily-news.yml)
- [Weekly OSS](https://github.com/bio-apple/ai/actions/workflows/weekly-oss.yml)
- [Site health](https://github.com/bio-apple/ai/actions/workflows/site-health.yml)
- [CI](https://github.com/bio-apple/ai/actions/workflows/ci.yml)

探针脚本失败时会在日志与 Step Summary 打印「建议处置」；Issue 正文会带上同一段落。

## 视频每日更新失败（常见根因）

流水线：`fetch` → `metrics` → **`commit/push`** → Pages。

| 现象 | 原因 | 处置 |
|------|------|------|
| Fetch ✅ Commit ✅ 但 job 红 | **Trigger Pages deploy** 缺 `actions: write` → 403 | workflow 已加 `actions: write`；或手动 Run **Deploy GitHub Pages** |
| YouTube 长期空 | Actions 缺 JS runtime / yt-dlp 搜索失败 | workflow 已装 Node；页面「回退批次」临时顶上 |
| Site Health 报视频过期 | 多日未成功 push 新 `daily-videos.json` | `workflow_dispatch` + **force=true** |
| Fetch 红、约十几秒结束 | 代码把 `platform` 误改成 `0.platform`（commit `no`）导致 KeyError | 已回滚字段名；勿再改候选字典键 |

手动救急：

1. [Daily AI Video Update](https://github.com/bio-apple/ai/actions/workflows/daily-videos.yml) → **Run workflow** → `force=true`
2. 确认出现 `chore: daily AI videos YYYY-MM-DD` 提交
3. 等 Pages 部署后硬刷新站点

## 视频空分类展示回退

前端 `videos.js`：最新批次某分类 `videos` 为空时，自动向前一个批次寻找同分类非空结果并展示，分类标题旁标注「回退批次」，文案说明来源日期。

- 展示层补偿，**不改写** `daily-videos.json`
- 仍应 `workflow_dispatch`（可 `force`）修复 YouTube/抓取空结果；长期依赖回退会掩盖数据质量问题

## 新闻去重（程序内硬规则）

规则：**同标题或同 URL → 只保留 `published_at` 最新一条**（标题经 NFKC 规范化）。

| 层级 | 位置 | 作用 |
|------|------|------|
| 写入 | `scripts/news_dedupe.py` + `fetch_ai_news.py` | 抓取后强制去重并 `assert` |
| 门禁 | `scripts/validate_ci.py` → `news` | CI 发现重复即失败 |
| 展示 | `news.js` / `src/lib/runtime.ts` | 渲染前再滤一层；JSON 请求 `cache: 'no-store'` |

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
| P1 | 视频 >2 天未更新 / 新闻 >2 天 | Issue + 手动 `workflow_dispatch` |
| P2 | 单平台短窗口为空 | metrics 警告，不阻断 |

## 一周内 AI 热点

- **窗口**：近 7 天（`config/news-fetch.yaml` → `max_age_days: 7`）
- **频次**：每天（`daily-news.yml`）
- **健康阈值**：`NEWS_MAX_AGE_DAYS` 默认 2 天（看的是 JSON `updated_at` 是否日更，不是窗口大小）
- 手动救急：Actions → Daily AI News Update → Run workflow

## 抓取门禁

- `daily-videos.yml` 必须提交 `daily-videos.json` **与** `video-thumbs/`
- `fetch_oss_stars.py` 全失败 → 非零退出；需 `GITHUB_TOKEN`
- `daily-news.yml` / `daily-videos.yml` / `weekly-oss.yml` 推送后需能派发 Pages（`actions: write`）
- E2E 与 API smoke **阻断** CI `validate` job
- 数据门禁含 `tool-relations`（未知工具 id 即失败）

## 本地复现健康检查

```bash
SITE_BASE=https://bio-apple.github.io/ai python3 scripts/check_site_health.py
DIST=dist python3 scripts/validate_ci.py
```

