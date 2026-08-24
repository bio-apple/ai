# 视频预览 Cloudflare Worker

为静态站提供：

1. **KV 同步 API** — 按 sync 码读写用户视频链接 JSON
2. **页面 meta API** — 抓取 og:image / YouTube 频道封面（供 `videos.js` 生成卡片缩略图）

## 自动部署

GitHub **Settings → Secrets and variables → Actions**：

| 名称                                           | 类型     | 说明                                |
| ---------------------------------------------- | -------- | ----------------------------------- |
| `CLOUDFLARE_API_TOKEN` 或 `CLOUDFLARE_API_KEY` | Secret   | Workers + KV 编辑权限               |
| `CLOUDFLARE_ACCOUNT_ID`                        | Secret   | 必填                                |
| `CLOUDFLARE_ACCOUNT_SUBDOMAIN`                 | Variable | 可选                                |
| `CLOUDFLARE_KV_NAMESPACE_ID`                   | Variable | 可选，否则 CI 自动创建              |
| `VIDEO_SYNC_SHARED_KEY`                        | Variable | 共享 sync 码（默认 `bioai-videos`） |

push `main` → `pages.yml` 的 `video-sync-api` job 部署 Worker，并将 `VIDEO_SYNC_API_URL` 注入 Astro 构建。

## API

| 方法  | 路径                     | 说明                                             |
| ----- | ------------------------ | ------------------------------------------------ |
| `GET` | `/{syncKey}`             | 返回 JSON 数组（预览列表）                       |
| `PUT` | `/{syncKey}`             | body 为 JSON 数组，覆盖保存                      |
| `GET` | `/meta?url={encodedUrl}` | 返回 `{ title, author, thumbnail, description }` |

`syncKey`：8–48 位 `[A-Za-z0-9_-]`。

## 用户侧（当前产品）

站点默认 **共享 sync 码** `bioai-videos`：

1. 任意设备打开 [videos.html](https://bio-apple.github.io/ai/videos.html) → 自动从云端拉取
2. 粘贴链接 → 保存 → 自动 push 到 KV
3. 封面由 `/meta` 抓取（YouTube 频道头像 / RSS 最新视频缩略图等）

未配置共享码时，可用 `?sync=` 恢复链接（见 [CLOUDFLARE-SYNC.md](../../docs/CLOUDFLARE-SYNC.md)）。

## 本地手动部署

```bash
cd workers/video-sync
npx wrangler kv namespace create SYNC_KV
# 将 id 写入 wrangler.toml 后：
npx wrangler deploy
```

## 安全

- sync 码即密钥；共享码模式下所有访问者读写同一份列表（适合个人台账，不适合私密数据）。
- Token 仅存 GitHub Secrets，勿提交仓库。
