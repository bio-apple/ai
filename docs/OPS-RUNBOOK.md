# 运维救急

## 环境

| 环境         | `/api/*` | 说明              |
| ------------ | -------- | ----------------- |
| GitHub Pages | 无       | 纯静态 `dist/`    |
| `./start.sh` | 有       | 本地 FastAPI 预览 |

## 告警怎么处理

1. **首页 / JSON 404** → 查 Pages/CI → 本地 `npm run build && DIST=dist python3 scripts/validate_ci.py` → 重部署
2. **视频过期** → Actions 手动跑 `daily-videos.yml`（`force=true`）→ 确认提交含 `daily-videos.json` + `video-thumbs/`
3. **新闻过期** → 手动跑 `daily-news.yml`
4. **OSS 精选异常** → 手动跑 `weekly-oss.yml`（按 AI 应用重刷 · ≥5万 Top5 + 中文Top1；需 `GITHUB_TOKEN`）
5. **学习资源异常** → 手动跑 `weekly-courses.yml`（近半年 AI 在线课程）

快捷入口：

- [Daily videos](https://github.com/bio-apple/ai/actions/workflows/daily-videos.yml)
- [Daily news](https://github.com/bio-apple/ai/actions/workflows/daily-news.yml)
- [Weekly OSS](https://github.com/bio-apple/ai/actions/workflows/weekly-oss.yml)
- [Weekly courses](https://github.com/bio-apple/ai/actions/workflows/weekly-courses.yml)
- [Site health](https://github.com/bio-apple/ai/actions/workflows/site-health.yml)
- [CI / Pages](https://github.com/bio-apple/ai/actions)

## 回滚

```bash
git checkout <good-sha> -- daily-videos.json video-thumbs/ ai-news.json ai-courses.json
git commit -m "revert: 回滚坏批次" && git push
```

开发说明见根目录 [DEVELOPER.md](../DEVELOPER.md)。
