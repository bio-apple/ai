# 视频预览 Cloudflare Worker

为静态站提供 KV 同步与页面 meta 抓取。配置与用户流程见 [CLOUDFLARE-SYNC.md](../../docs/CLOUDFLARE-SYNC.md)。

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/{syncKey}` | 预览列表 JSON 数组 |
| `PUT` | `/{syncKey}` | 覆盖保存 JSON 数组 |
| `GET` | `/meta?url={encodedUrl}` | `{ title, author, thumbnail, description }` |

`syncKey`：8–48 位 `[A-Za-z0-9_-]`。默认共享码 `bioai-videos`。

## 本地部署

```bash
cd workers/video-sync
npx wrangler kv namespace create SYNC_KV
# 将 id 写入 wrangler.toml
npx wrangler deploy
```

CI：`pages.yml` 的 `video-sync-api` job 自动部署并注入 `VIDEO_SYNC_API_URL`。
