# 视频预览跨设备同步 Worker

为静态站提供按**同步码**读写预览列表的 KV API（无账号体系，同步码即密钥）。

## 部署

```bash
cd workers/video-sync
npx wrangler kv namespace create SYNC_KV
# 将返回的 id 填入 wrangler.toml
npx wrangler deploy
```

部署后得到 URL，例如 `https://bioai-video-sync.xxx.workers.dev`。

在仓库根目录 `data/site.json` 设置：

```json
"video_preview_sync": {
  "api_url": "https://bioai-video-sync.xxx.workers.dev"
}
```

提交并推送后，视频页「跨设备同步」将自动上传/拉取。

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/{syncKey}` | 返回 JSON 数组 |
| `PUT` | `/{syncKey}` |  body 为 JSON 数组，覆盖保存 |

`syncKey`：8–48 位 `[A-Za-z0-9_-]`。

## 安全说明

- 同步码相当于密码，知道码的人可读写该列表。
- 不要与陌生人分享同步码。
- 未部署 Worker 时，用户仍可用导出/导入或「同步文本」手动迁移。
