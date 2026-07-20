# 运维救急

内容运营与抓取流程详见 [CONTENT-OPS.md](./CONTENT-OPS.md)。

## 环境

| 环境         | `/api/*` | 说明              |
| ------------ | -------- | ----------------- |
| GitHub Pages | 无       | 纯静态 `dist/`    |
| `./start.sh` | 有       | 本地 FastAPI 预览 |

## 告警怎么处理

1. **首页 / JSON 404** → 查 [CI](https://github.com/bio-apple/ai/actions/workflows/ci.yml) / [Deploy](https://github.com/bio-apple/ai/actions/workflows/deploy.yml) → 本地 `npm run build && DIST=dist python3 scripts/validate_ci.py` → 重部署
2. **多频道过期 / 串行日更失败** → 查 [daily-refresh.yml](https://github.com/bio-apple/ai/actions/workflows/daily-refresh.yml)（北京 00:00 串行）→ 可手动 **Run workflow** 重跑全链路。仅 lychee 软告警时：数据应已上线，修外链即可
3. **仓库已更新但线上仍昨日** → 确认 `deploy.yml` 是否被派发成功（`GITHUB_TOKEN` push **不会**自动触发 Deploy）→ 手动 Run [deploy.yml](https://github.com/bio-apple/ai/actions/workflows/deploy.yml)
4. **视频仍显示昨日** → 确认 `main` 上 `daily-videos.json` 的 `batches[0].date`；仅视频坏 → [daily-videos.yml](https://github.com/bio-apple/ai/actions/workflows/daily-videos.yml)（`force=true`）
   - YouTube 全空：配置 **`YOUTUBE_API_KEY`** 后重跑
5. **新闻过期** → [daily-news.yml](https://github.com/bio-apple/ai/actions/workflows/daily-news.yml)（定时北京 **07:30 / 10:00 / 12:00 / 20:00**；可手动 Run）
6. **OSS 精选异常** → [daily-oss.yml](https://github.com/bio-apple/ai/actions/workflows/daily-oss.yml)
7. **课程资源异常** → [daily-courses.yml](https://github.com/bio-apple/ai/actions/workflows/daily-courses.yml)
8. **排行榜异常** → [daily-rankings.yml](https://github.com/bio-apple/ai/actions/workflows/daily-rankings.yml)
9. **Dead Link 告警** → [daily-refresh.yml](https://github.com/bio-apple/ai/actions/workflows/daily-refresh.yml) artifact（或手动 [daily-link-check.yml](https://github.com/bio-apple/ai/actions/workflows/daily-link-check.yml)）；不阻断日更上线
10. **Deploy Prettier 失败** → 日更已在提交前格式化；若仍失败，本地 `npx prettier --write <json>` 后 push

### 死链：用户侧 vs 日检

| 层级         | 机制                           | 说明                                                       |
| ------------ | ------------------------------ | ---------------------------------------------------------- |
| **用户侧**   | `lib/link-guard.js`            | 点击 GitHub 仓库前探测 API；404 弹窗，避免盲跳             |
| **运维日检** | lychee（`daily-refresh` 末步） | 扫描 `dist` HTML 与 JSON 外链；失败为**软告警** + artifact |

用户弹窗**不能替代**日检：仅覆盖 GitHub 仓库类链接；新闻/课程/官方站死链仍依赖 lychee。

### 课程资源专项

症状：Tab「课程资源」空白、条数骤减、CI 报 `ai-courses.json` 校验失败。

```bash
python3 scripts/fetch_ai_courses.py
DIST=dist python3 scripts/validate_ci.py courses
```

常见失败原因：

| 报错               | 处置                                                                              |
| ------------------ | --------------------------------------------------------------------------------- |
| 必收录课程缺失     | 检查 `config/courses-fetch.yaml` → `required` / `hubs` 与网络可达性               |
| 合集与下属单课重复 | 确认 `dedupe.prefer_hub_over_children: true`，且 `deeplearning_ai.enabled: false` |
| 单条路线超过 5 门  | 调低补充源或检查 `dedupe.max_per_track`                                           |
| 免费课程条数不足   | 放宽 `min_items` 或检查 Hugging Face / YouTube 源                                 |

当前路线：**入门 → 机器学习 → 深度学习 → LLM 大模型 → AI Agent**（无「AI 工程实践」段）。

### 新闻 / 开源重复

若首页 Daily「GitHub 热门」与「开源精选」出现同一仓库：

- 新闻抓取已排除 OSS 已收录 URL；旧数据可本地重刷：`python3 scripts/fetch_ai_news.py`
- 前端 Daily 面板也会过滤 OSS URL（`src/lib/runtime.ts`）

## 工作流快捷入口

- [Daily Content Refresh（00:00 串行）](https://github.com/bio-apple/ai/actions/workflows/daily-refresh.yml)
- [Daily videos](https://github.com/bio-apple/ai/actions/workflows/daily-videos.yml)（手动）
- [Daily news](https://github.com/bio-apple/ai/actions/workflows/daily-news.yml)（**07:30 / 10:00 / 12:00 / 20:00** / 手动）
- [Daily OSS](https://github.com/bio-apple/ai/actions/workflows/daily-oss.yml)（手动）
- [Daily courses](https://github.com/bio-apple/ai/actions/workflows/daily-courses.yml)（手动）
- [Daily rankings](https://github.com/bio-apple/ai/actions/workflows/daily-rankings.yml)（手动）
- [Daily link check](https://github.com/bio-apple/ai/actions/workflows/daily-link-check.yml)（手动）
- [Site health](https://github.com/bio-apple/ai/actions/workflows/site-health.yml)
- [CI / Pages](https://github.com/bio-apple/ai/actions)

## 回滚

```bash
git checkout <good-sha> -- daily-videos.json video-thumbs/ ai-news.json ai-courses.json oss-projects.json
git commit -m "revert: 回滚坏批次" && git push
```

回滚后若课程有变更，建议再跑一遍 `npm run build` 与 `validate_ci.py`，确认 Pages 部署成功。

开发说明见根目录 [DEVELOPER.md](../DEVELOPER.md)。前端能力见 [FRONTEND.md](./FRONTEND.md)。
