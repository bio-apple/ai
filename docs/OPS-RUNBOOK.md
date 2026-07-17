# 运维救急

内容运营与抓取流程详见 [CONTENT-OPS.md](./CONTENT-OPS.md)。

## 环境

| 环境         | `/api/*` | 说明              |
| ------------ | -------- | ----------------- |
| GitHub Pages | 无       | 纯静态 `dist/`    |
| `./start.sh` | 有       | 本地 FastAPI 预览 |

## 告警怎么处理

1. **首页 / JSON 404** → 查 [CI](https://github.com/bio-apple/ai/actions/workflows/ci.yml) / [Deploy](https://github.com/bio-apple/ai/actions/workflows/deploy.yml) → 本地 `npm run build && DIST=dist python3 scripts/validate_ci.py` → 重部署
2. **视频过期** → Actions 手动跑 [daily-videos.yml](https://github.com/bio-apple/ai/actions/workflows/daily-videos.yml)（可选 `force=true`）→ 确认提交含 `daily-videos.json` + `video-thumbs/`
   - YouTube 全空：在仓库 Settings → Secrets 配置 **`YOUTUBE_API_KEY`**（YouTube Data API v3），再重跑 workflow
   - 日志含 `Sign in to confirm you're not a bot`：即反爬；无 API Key 时可临时用 `YTDLP_COOKIES_FILE` 或依赖脚本/页面的批次回退
3. **新闻过期** → 手动跑 [daily-news.yml](https://github.com/bio-apple/ai/actions/workflows/daily-news.yml)
4. **OSS 精选异常** → 手动跑 [weekly-oss.yml](https://github.com/bio-apple/ai/actions/workflows/weekly-oss.yml)（≥5 万 Star Top5 + 中文 Top1；需 `GITHUB_TOKEN`）
5. **课程资源异常** → 手动跑 [weekly-courses.yml](https://github.com/bio-apple/ai/actions/workflows/weekly-courses.yml)

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

- [Daily videos](https://github.com/bio-apple/ai/actions/workflows/daily-videos.yml)
- [Daily news](https://github.com/bio-apple/ai/actions/workflows/daily-news.yml)
- [Weekly OSS](https://github.com/bio-apple/ai/actions/workflows/weekly-oss.yml)
- [Weekly courses](https://github.com/bio-apple/ai/actions/workflows/weekly-courses.yml)
- [Site health](https://github.com/bio-apple/ai/actions/workflows/site-health.yml)
- [CI / Pages](https://github.com/bio-apple/ai/actions)

## 回滚

```bash
git checkout <good-sha> -- daily-videos.json video-thumbs/ ai-news.json ai-courses.json oss-projects.json
git commit -m "revert: 回滚坏批次" && git push
```

回滚后若课程有变更，建议再跑一遍 `npm run build` 与 `validate_ci.py`，确认 Pages 部署成功。

开发说明见根目录 [DEVELOPER.md](../DEVELOPER.md)。
