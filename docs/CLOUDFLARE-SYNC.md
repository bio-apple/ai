# Cloudflare：视频预览跨设备同步

用 **Workers + KV** 保存用户粘贴的视频链接列表；封面由 Worker **`/meta`** 抓取（非 thum.io）。

## 一次性配置（约 5 分钟）

### 1. 创建 API Token

1. [Cloudflare → API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. **Create Token** → 模板 **Edit Cloudflare Workers**
3. 权限：Workers Scripts Edit + Workers KV Storage Edit

### 2. 写入 GitHub Secrets

| Name                                           | Value              |
| ---------------------------------------------- | ------------------ |
| `CLOUDFLARE_API_TOKEN` 或 `CLOUDFLARE_API_KEY` | API Token          |
| `CLOUDFLARE_ACCOUNT_ID`                        | Account ID（必填） |

**Variables（可选）：**

| Name                           | Value                               |
| ------------------------------ | ----------------------------------- |
| `CLOUDFLARE_ACCOUNT_SUBDOMAIN` | `*.workers.dev` 账户子域            |
| `VIDEO_SYNC_API_URL`           | 完整 Worker URL（备用）             |
| `VIDEO_SYNC_SHARED_KEY`        | 共享 sync 码（默认 `bioai-videos`） |

### 3. 触发部署

push `main` 或 Actions → **Deploy GitHub Pages** → Run workflow。

日志应出现 `VIDEO_SYNC_API_URL=https://bioai-video-sync.<subdomain>.workers.dev`。

### 4. 验证

1. 硬刷新 [视频页](https://bio-apple.github.io/ai/videos.html)
2. 粘贴 YouTube/B站链接 → **保存** → 状态应显示 **「已云端永久保存」**
3. 另一台设备（或清除网站数据后）直接打开 `videos.html` → 应自动出现同一份列表

## 用户怎么用

**共享码模式（默认）**：所有设备打开同一 URL 即可读写同一份云端列表。

1. 设备 A：粘贴 → 保存
2. 设备 B：打开 `videos.html` → 自动拉取

**降级模式**（未配置 `shared_key`）：保存后收藏带 `?sync=` 的恢复链接。

## 架构要点

| 组件   | 文件                                                                 |
| ------ | -------------------------------------------------------------------- |
| 前端   | `videos.js` · `lib/video-preview.js` · `lib/video-preview-sync.js`   |
| 页面   | `src/pages/videos.astro`                                             |
| Worker | `workers/video-sync/src/index.js`                                    |
| 配置   | `data/site.json` → `video_preview_sync` · 构建 env `VIDEO_SYNC_*`    |
| CSP    | 构建时注入 Worker origin（`*.workers.dev` 单层通配符不匹配账户子域） |

## 本地调试

```bash
cp .env.local.example .env.local
# VIDEO_SYNC_API_URL=https://bioai-video-sync.<you>.workers.dev
npm run build && npm run preview
```

## 安全

- Cloudflare Token 仅存 GitHub Secrets
- 共享码模式下列表对全部访客可读写——勿存敏感链接
