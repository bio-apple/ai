# 部署 · CDN 加速 · 安全头

面向维护者：说明 **GitHub Actions 发版链路**、**Cloudflare CDN 加速**、**HTTPS / CSP**。

## 1. GitHub Actions（push `main`）

| 工作流                                                                | 作用                                                               |
| --------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [`ci.yml`](../.github/workflows/ci.yml)                               | Prettier + ESLint → Build → 单测 → `validate_ci` → API smoke → E2E |
| [`pages.yml`](../.github/workflows/pages.yml)                         | 同上质量门禁（无 E2E）→ 上传 artifact → **Deploy GitHub Pages**    |
| [`deploy-cloudflare.yml`](../.github/workflows/deploy-cloudflare.yml) | **可选**：同一 `dist/` 发布到 Cloudflare Pages（需 Secrets）       |

本地等价：

```bash
npm ci
npm run quality          # format:check + lint
npm run build
DIST=dist python3 scripts/validate_ci.py
```

## 2. GitHub Pages（默认生产）

- 源：Actions 构建的 `dist/`
- `*.github.io` **默认强制 HTTPS**
- 仓库 Settings → Pages → Enforce HTTPS（自定义域名时务必勾选）

限制：GitHub Pages **不能**自定义任意 HTTP 响应头；因此 CSP/HSTS 完整能力建议走 Cloudflare。

## 3. Cloudflare CDN（推荐，国内更稳）

### 3.1 仅代理加速（保留 GitHub Pages 源站）

1. 域名 DNS 托管到 Cloudflare
2. 添加 CNAME：`www` / apex → `bio-apple.github.io`（橙云代理）
3. SSL/TLS：**Full (strict)**
4. 开启：**Always Use HTTPS**、**Automatic HTTPS Rewrites**
5. Speed → Optimization：可选 Auto Minify（JS/CSS/HTML）
6. Security → 免费计划已含基础 DDoS；可开 Bot Fight Mode

GitHub 自定义域名需在仓库 Pages 设置填域名，并保留 Cloudflare 的 DNS 记录。

### 3.2 Cloudflare Pages 双发（可选）

仓库 Secrets：

| Secret                    | 说明            |
| ------------------------- | --------------- |
| `CLOUDFLARE_API_TOKEN`    | Pages Edit 权限 |
| `CLOUDFLARE_ACCOUNT_ID`   | 账户 ID         |
| `CLOUDFLARE_PROJECT_NAME` | Pages 项目名    |

推送 `main` 或手动 Run `Deploy Cloudflare Pages`；未配置则自动跳过。

构建产物已含：

- [`_headers`](../_headers) — CSP / HSTS / nosniff / frame deny 等
- [`_redirects`](../_redirects) — HTTP→HTTPS 提示规则

## 4. 安全头策略

| 层                    | 机制                 | 说明                                                |
| --------------------- | -------------------- | --------------------------------------------------- |
| Cloudflare / CF Pages | `_headers`           | **主路径**：完整 CSP + HSTS + 点击劫持防护          |
| GitHub Pages          | `SecurityMeta.astro` | **兜底**：`Content-Security-Policy` meta + referrer |
| 传输                  | HTTPS                | github.io 强制；自定义域名靠 CF Always HTTPS        |

CSP 允许：

- 本站脚本/样式（含内联 ThemeBoot，故 `script-src`/`style-src` 含 `'unsafe-inline'`）
- Google Fonts
- GA4（`googletagmanager` / `google-analytics`）与 Clarity

收紧内联脚本需改为 nonce/hash，属于后续改造。

## 5. 验收清单

- [ ] `main` push 后 CI quality 绿、Pages 部署成功
- [ ] 站点仅 HTTPS 可访问（HTTP 301）
- [ ] 浏览器 DevTools → Network → 响应头可见 `content-security-policy`（经 Cloudflare 时）
- [ ] 首页 / 工具页 / 搜索 / 推荐仍正常（CSP 未误杀 GA/字体）

## 6. 与 Vercel

若改用 Vercel：导入仓库、Output `dist`、Build `npm run build`，并在 `vercel.json` 配同等安全头。当前默认仍为 **GitHub Pages + 可选 Cloudflare**，不强绑定 Vercel。
