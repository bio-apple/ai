# 视频预览跨设备同步 Worker

为静态站提供按**同步码**读写预览列表的 KV API（无账号体系，同步码即密钥）。

## 自动部署（推荐）

在 GitHub 仓库 **Settings → Secrets and variables → Actions** 添加：

| 名称 | 类型 | 说明 |
|------|------|------|
| `CLOUDFLARE_API_TOKEN` 或 `CLOUDFLARE_API_KEY` | Secret | Cloudflare API Token（Workers + KV 编辑权限） |
| `CLOUDFLARE_ACCOUNT_ID` | Secret | Cloudflare 账户 ID（必填） |
| `CLOUDFLARE_ACCOUNT_SUBDOMAIN` | Variable | 可选，账户子域（用于日志回退 URL） |
| `CLOUDFLARE_KV_NAMESPACE_ID` | Variable | 可选，已有 KV 时填入，否则 CI 自动创建 |

推送 `main` 后，`Deploy GitHub Pages` 工作流会：

1. 部署本 Worker 到 `*.workers.dev`
2. 将 Worker URL 注入构建环境 `VIDEO_SYNC_API_URL`
3. 视频页自动启用云端同步（用户只需记同步码）

也可手动设置 Variable `VIDEO_SYNC_API_URL` 为已部署的 Worker 地址。

## 本地手动部署

```bash
cd workers/video-sync
npx wrangler kv namespace create SYNC_KV
# 将返回的 id 填入 wrangler.toml
npx wrangler deploy
```

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/{syncKey}` | 返回 JSON 数组 |
| `PUT` | `/{syncKey}` | body 为 JSON 数组，覆盖保存 |

`syncKey`：8–48 位 `[A-Za-z0-9_-]`。

## 用户侧流程

1. 云端开启后，**首次添加链接**会自动生成同步码并上传
2. 其他设备打开视频页 → 输入**相同同步码** →「保存并同步」
3. 之后增删链接会自动合并到云端

## 安全说明

- 同步码相当于密码，知道码的人可读写该列表。
- 不要与陌生人分享同步码。
