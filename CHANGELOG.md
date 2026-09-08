# Changelog

## 2026-09 — 相对 2.0.0 的站点现状

未改 `package.json` 版本号；以下已在 `main`。

- 站名 **AI 导航**；去掉实验台账文案与首页实战案例专区
- 视频推荐：近 1 个月、YouTube / B 站各播放量 Top 3，每天北京 04:00 抓取（需 `YOUTUBE_API_KEY`）
- 视频页日更卡：封面名次 + 时长，不展示摘要；收藏区逻辑不变
- 开源卡片去掉重复的日/周榜和方向标签，热度条保留
- 知识版图加回基础学科黄圈；图下方按钮不含「基础学科」一组

## [2.0.0] — 2026-08-25

相对 [v1.0](https://github.com/bio-apple/ai/releases/tag/v1.0) 的主要升级：

### 视频与云端同步

- 视频页改为粘贴 YouTube / Bilibili 链接生成封面预览（支持频道）
- Cloudflare Worker + KV：跨设备云端永久保存；站点共享 sync 码，打开即同步
- 首页「AI 简报」含近一个月高播放视频精选（完整列表在视频专区）
- CI 自动部署 Worker，并注入 CSP 允许的 Worker origin

### 内容与日更

- 开源精选：GitHub 加热日更（每方向 Top 3，入选门槛 ≥1 万 Star）
- 新闻：滚动 7×24h；一日两更；扩源（HF / 机器之心等）+ 优先仓
- Hero 时间戳对齐新闻 / 开源真实 `updated_at`
- AI 工具中心：Vibe Coding 对比 + AICPB / LMSYS / AA 三榜

### 产品与工程

- 首页以匹配工具链为首屏
- 文档大幅精简（删除过时 SEO 等冗长说明）
- 质量门禁与密钥扫描常态化

## [1.0.0] — 2026-07-31

初版发布：Astro SSG + GitHub Pages，工具导航 / 开源 / 课程 / 热点基础能力。
