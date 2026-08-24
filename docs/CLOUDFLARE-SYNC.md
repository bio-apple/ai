# Cloudflare：视频预览自动跨设备同步

有 Cloudflare 账号后，用 **Workers + KV** 即可自动同步（比 Uploadcare 更适合「改列表自动上传」）。

## 一次性配置（约 5 分钟）

### 1. 创建 API Token

1. 打开 [Cloudflare Dashboard → My Profile → API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. **Create Token** → 用模板 **Edit Cloudflare Workers**（或自定义）
3. 权限至少包含：
   - Account → Workers Scripts → Edit
   - Account → Workers KV Storage → Edit
4. 复制 Token（只显示一次）

### 2. 复制 Account ID

Dashboard 右侧或 Workers 概览页的 **Account ID**（一串十六进制）。

### 3. 写入 GitHub（不要发到聊天）

仓库 `bio-apple/ai` → **Settings → Secrets and variables → Actions**

**Secrets：**

| Name                                           | Value                                          |
| ---------------------------------------------- | ---------------------------------------------- |
| `CLOUDFLARE_API_TOKEN` 或 `CLOUDFLARE_API_KEY` | API Token（Workers + KV 编辑权限；二选一即可） |
| `CLOUDFLARE_ACCOUNT_ID`                        | Account ID（**必填**，否则无法部署 Worker）    |

**Variables（可选）：**

| Name                           | Value                                                                                    |
| ------------------------------ | ---------------------------------------------------------------------------------------- |
| `CLOUDFLARE_ACCOUNT_SUBDOMAIN` | 你的 `*.workers.dev` 子域，如 `xxx`（URL 为 `https://bioai-video-sync.xxx.workers.dev`） |
| `VIDEO_SYNC_API_URL`           | 首次部署成功后可填完整 Worker URL，作为备用                                              |

### 4. 触发部署

- 推送任意 commit 到 `main`，或
- Actions → **Deploy GitHub Pages** → **Run workflow**

部署日志里应出现 `VIDEO_SYNC_API_URL=https://…workers.dev`。

### 5. 验证

1. 硬刷新 [视频页](https://bio-apple.github.io/ai/videos.html)
2. 「跨设备同步」应提示 **Worker 同步已开启**（或首次添加链接自动生成同步码）
3. 另一台设备输入**相同同步码** →「保存并同步」

## 本地手动部署（可选）

```bash
cd workers/video-sync
npx wrangler login
npx wrangler kv namespace create SYNC_KV
# 把返回的 id 写入 wrangler.toml 的 id =
npx wrangler deploy
```

把输出的 `https://bioai-video-sync.<subdomain>.workers.dev` 填到 GitHub Variable `VIDEO_SYNC_API_URL`，再跑一次 Pages 构建。

## 用户怎么用

站点已配置 **共享 sync 码**（`bioai-videos`）：所有设备打开 [视频页](https://bio-apple.github.io/ai/videos.html) 即可读写同一份云端列表，无需复制链接。

1. **设备 A**：粘贴链接 → 保存
2. **设备 B**（或清除浏览器数据后）：直接打开 `videos.html` → 自动从云端拉取

可选：在 GitHub Variables 设置 `VIDEO_SYNC_SHARED_KEY` 更换共享码（需与 `data/site.json` 一致或覆盖构建）。

若未配置共享码，仍可用 `?sync=` 恢复链接（旧模式）。

## 安全

- Token / Account ID 只放在 GitHub Secrets，不要提交仓库
- 同步码相当于密码，勿公开分享
