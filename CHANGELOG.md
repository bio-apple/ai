# Changelog

## [2.0.0] — 2026-08-25

相对 [v1.0](https://github.com/bio-apple/ai/releases/tag/v1.0) 的主要升级：

### 视频与云端同步
- 视频页改为粘贴 YouTube / Bilibili 链接生成封面预览（支持频道）
- Cloudflare Worker + KV：跨设备云端永久保存；站点共享 sync 码，打开即同步
- 首页「AI 简报」展示本机 / 云端已保存的视频预览
- CI 自动部署 Worker，并注入 CSP 允许的 Worker origin

### 内容与日更
- 开源精选：GitHub 加热日更（每方向 Top 3，入选门槛 ≥1 万 Star）
- 新闻：滚动 7×24h；一日两更；扩源（HF / 机器之心等）+ 优先仓
- Hero 时间戳对齐新闻 / 开源真实 `updated_at`
- AI 工具中心：Vibe Coding 对比 + AICPB / LMSYS / AA 三榜

### 产品与工程
- 全站「实验台账」视觉；首页以匹配工具链为首屏
- 文档大幅精简（删除过时 SEO 等冗长说明）
- 质量门禁与密钥扫描常态化

## [1.0.0] — 2026-07-31

初版发布：Astro SSG + GitHub Pages，工具导航 / 开源 / 课程 / 热点基础能力。
