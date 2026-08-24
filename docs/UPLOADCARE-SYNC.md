# Uploadcare：视频预览跨设备备份

站点是静态 GitHub Pages，**不能**把 Uploadcare Secret Key 放进前端。正确用法是：

1. 仅用 **Public Key** 上传 JSON 备份
2. 得到 `https://ucarecdn.com/{uuid}/` 链接
3. 另一台设备粘贴该链接拉取并合并

这不是按同步码自动双向同步（那需要 Cloudflare Worker）；Uploadcare 适合「上传一次 → 分享链接 → 另一台恢复」。

## 一次性配置

1. 打开 [Uploadcare → API Keys](https://app.uploadcare.com/)
2. 复制 **Public Key**（不要复制 Secret Key）
3. 任选一种方式写入站点：

### 方式 A：GitHub Variable（推荐）

仓库 → **Settings → Secrets and variables → Actions → Variables**

- Name: `UPLOADCARE_PUBLIC_KEY`
- Value: 你的 Public Key

推送 `main` 或手动跑 **Deploy GitHub Pages** 后生效。

### 方式 B：写入 `data/site.json`

```json
"video_preview_sync": {
  "api_url": "",
  "uploadcare_public_key": "YOUR_PUBLIC_KEY"
}
```

本地开发可在 `.env.local`：

```bash
UPLOADCARE_PUBLIC_KEY=YOUR_PUBLIC_KEY
```

## 用户怎么用

1. 视频页 → 展开「跨设备同步」
2. 设备 A：点 **上传到 Uploadcare** → 复制 CDN 链接
3. 设备 B：粘贴链接 → **从链接拉取并合并**

每次「上传」都会生成**新**文件 UUID；分享最新链接即可。

## 安全

- Public Key 可公开（前端可见）
- **切勿**把 Secret Key 写进仓库、前端或发给聊天
- 备份链接知道的人都能下载你的预览列表，勿公开分享
