# 首屏性能 · 图片 · 字体 · 动效

## 目标

改善 **FCP / LCP**，并保证交互动画走 GPU 合成层、不挡首屏文字。

## 图片

| 资源                      | 策略                                                                   |
| ------------------------- | ---------------------------------------------------------------------- |
| 首页 / 导航               | 无位图；品牌为文字 + CSS 氛围                                          |
| `og-image.jpg`            | 社交卡片；`npm run optimize:images` 压缩                               |
| `og-image.png`            | **已移除**（未使用且约 1.6MB）                                         |
| `video-thumbs/bilibili/*` | **WebP**（宽 ≤640，quality≈78）；`loading="lazy"` + `decoding="async"` |
| 抓取脚本                  | `fetch_daily_videos.py` 镜像封面后自动转 WebP                          |

```bash
npm run optimize:images   # 批量转 WebP + 压 OG + 回写 daily-videos.json
```

站内无 SVG 图标资源（导航/工具为字符或 emoji）；若后续加入 SVG，请用 SVGO 压缩并优先内联关键图标。

## 字体

- `font-display=swap`（Google Fonts URL）
- 字重收敛：Outfit `500;700`，Noto Sans SC `400;600`
- **非阻塞**加载（`media="print" onload`），正文先用系统中文栈出字（`--font-sans`）
- Google CSS 自带 `unicode-range` 分片，接近子集效果；完整离线中文子集需按文案跑 glyphhanger（可选后续）

实现：`src/components/FontLoader.astro`

## CSS / JS

- `prebuild` 将 `style.css` 的 `@import` **打成单文件**，减少瀑布请求
- 布局脚本统一 `defer`，不阻塞 HTML 解析
- Hero **不再**使用 `.fade-in`（避免 LCP 文本 `opacity: 0` 等 JS）

## 动效

- `css/motion.css`：`translate3d` 硬件加速、CTA 错落入场、卡片 hover/active
- 尊重 `prefers-reduced-motion`
- 未引入 Framer Motion 等运行时库（静态站以 CSS 为主，体积更小）

## 验收

1. `npm run build` 后 `dist/style.css` 无 `@import` 链
2. `dist/video-thumbs/**` 以 `.webp` 为主
3. 首页首屏品牌/标题在禁用 JS 时仍可见
4. DevTools → Network：字体样式表不挡首次内容绘制；封面为 WebP
