# SEO 优化（P0）

目标：提升 [bio-apple.github.io/ai/](https://bio-apple.github.io/ai/) 的搜索可发现性、品牌展示与社交分享效果。

## 已落地项

| 编号    | 项          | 实现                                                           |
| ------- | ----------- | -------------------------------------------------------------- |
| SEO-001 | Title       | `data/site.json` → `meta.title`，各页经 `SeoHead.astro` 输出   |
| SEO-002 | Description | `meta.description` + 各页独立 `description` prop               |
| SEO-003 | Open Graph  | `SeoHead.astro`：og:title/description/image/url + Twitter Card + 微信 itemprop |
| SEO-004 | Favicon     | 根目录 `favicon.svg` → `Favicon.astro`                         |
| SEO-005 | robots.txt  | 根目录 `robots.txt`，构建时同步至 `dist/`                      |
| SEO-006 | sitemap     | `@astrojs/sitemap` → `sitemap-index.xml`                       |
| SEO-007 | GitHub Repo | 见下方维护者清单（需在 GitHub 设置）                           |

## 文件位置

```
data/site.json          # 全站默认 TDK、OG 图
src/components/SeoHead.astro
src/components/Favicon.astro
favicon.svg
og-image.jpg            # 社交分享图 1200×630
robots.txt
astro.config.mjs        # sitemap 集成
```

## GitHub Repository SEO（维护者手动）

在 https://github.com/bio-apple/ai/settings 配置：

**Description（推荐）**

```
Bio AI Lab — AI 工具导航、开源精选、免费课程、热点与视频。对比 ChatGPT/Claude/Cursor，搭建你的 AI 工作流。
```

**Topics（推荐）**

```
ai, artificial-intelligence, ai-tools, ai-agent, machine-learning, llm, open-source, github-pages, astro
```

**Website**

```
https://bio-apple.github.io/ai/
```

## 验收清单

- [ ] 浏览器标签显示品牌 favicon
- [ ] 首页 Title / Description 符合 `site.json`
- [ ] 微信 / X / LinkedIn 分享显示 `og-image.jpg` 预览（可用 [opengraph.xyz](https://www.opengraph.xyz/) 或各平台调试器验收）
- [ ] `https://bio-apple.github.io/ai/robots.txt` 可访问
- [ ] `https://bio-apple.github.io/ai/sitemap-index.xml` 可访问
- [ ] Lighthouse SEO ≥ 90（本地 `npm run build` 后测 `dist/index.html`）

## 禁止事项

- 勿使用无意义 Title（如 `Home`、`AI`）
- 勿在 meta 中堆砌与页面无关的关键词
- 社交图须为真实项目品牌图，勿使用占位 `example.com` 链接

## 相关文档

- [DEVELOPER.md](../DEVELOPER.md) — 构建与部署
- [CI-CD.md](./CI-CD.md) — push `main` 自动部署
