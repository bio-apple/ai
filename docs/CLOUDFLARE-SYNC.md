# Cloudflare：视频预览跨设备同步

Workers + KV 保存用户粘贴的视频链接；封面由 Worker `/meta` 抓取。

## 配置（约 5 分钟）

1. Cloudflare API Token（Workers + KV Edit）+ Account ID  
2. GitHub Secrets：`CLOUDFLARE_API_TOKEN`（或 `CLOUDFLARE_API_KEY`）、`CLOUDFLARE_ACCOUNT_ID`  
3. 可选 Variables：`VIDEO_SYNC_API_URL`、`VIDEO_SYNC_SHARED_KEY`（默认 `bioai-videos`）  
4. push `main` 或手动跑 **Deploy GitHub Pages**

## 怎么用

默认共享码：任意设备打开 [videos.html](https://bio-apple.github.io/ai/videos.html) → 自动读写同一份云端列表。

1. 设备 A：粘贴 → 保存（应提示「已云端永久保存」）  
2. 设备 B / 清网站数据后：直接打开同一 URL

未配置 `shared_key` 时可用 `?sync=` 恢复链接。

## 架构

| 组件 | 路径 |
|------|------|
| 前端 | `videos.js` · `lib/video-preview*.js` |
| Worker | `workers/video-sync/`（API 见该目录 README） |
| CSP | 构建注入 Worker origin（`scripts/csp-policy.mjs`） |

Token 仅存 Secrets。共享码模式下列表对访客可读写——勿存敏感链接。
