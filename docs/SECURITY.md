# 安全规范

本项目为**纯前端静态站点**（GitHub Pages），无服务端密钥托管。以下规则适用于所有贡献者与自动化任务。

## 1. 禁止硬编码 API Key

**绝对禁止**将 OpenAI、Anthropic、DeepSeek、Google Gemini 等 LLM 服务商的 `API_KEY` 硬编码在源码、配置或 JSON 中并提交至 GitHub。

密钥一旦进入公开仓库，通常会在数秒内被全网爬虫扫描并盗刷。

CI 会在每次构建时扫描仓库，拦截常见密钥模式（见 `scripts/validate_ci.py` → `validate_no_secrets`）。

## 2. 本地开发配置

本地开发请在**仓库根目录**使用 `.env.local`：

```bash
cp .env.local.example .env.local
# 编辑 .env.local，填入本地专用变量
```

- `.env.local` 已写入 `.gitignore`，**不得提交**。
- `npm run build` 的 prebuild 阶段会自动加载 `.env.local`（见 `scripts/load-env-local.mjs`）。
- Python 抓取脚本读取 `os.environ`；可在 shell 中 `set -a && source .env.local && set +a` 后再运行。

### 允许的本地 / CI 变量（非 LLM 密钥）

| 变量                                                         | 用途                                                       |
| ------------------------------------------------------------ | ---------------------------------------------------------- |
| `GA_MEASUREMENT_ID` / `PUBLIC_GA_MEASUREMENT_ID`             | Google Analytics                                           |
| `CLARITY_PROJECT_ID` / `PUBLIC_CLARITY_PROJECT_ID`           | Microsoft Clarity                                          |
| `UMAMI_*` / `PUBLIC_UMAMI_*`                                 | Umami 统计                                                 |
| `CLOUDFLARE_BEACON_TOKEN` / `PUBLIC_CLOUDFLARE_BEACON_TOKEN` | Cloudflare Web Analytics                                   |
| `GITHUB_TOKEN` / `GH_TOKEN`                                  | 本地抓取脚本提高 GitHub API 限额                           |
| `YOUTUBE_API_KEY` / `YOUTUBE_DATA_API_V3` / `GOOGLE_API_KEY` | 每日视频抓取：YouTube Data API v3 详情（规避 yt-dlp 反爬） |
| `YTDLP_COOKIES_FILE`                                         | 本地可选：yt-dlp Netscape cookies 文件路径                 |
| `YTDLP_COOKIES_B64`（仅 CI Secret）                          | 可选：base64 编码的 cookies，供 Actions 写入临时文件       |

生产 CI 通过 [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets) 注入上述构建变量，**不要**写入仓库。

## 3. 用户 API Key（浏览器端）

若功能需要用户自行填写 API Key：

1. **仅**保存在用户浏览器 `localStorage` 或 `sessionStorage`。
2. 所有 LLM 请求必须由**客户端直连**对应服务商官方 API。
3. **禁止**经任何第三方不安全通道中转（包括自建无鉴权代理、公开 CORS 代理等）。
4. 不得在构建产物、`analytics-config.json` 或任何静态 JSON 中写入用户或开发者密钥。

当前站点用途：`localStorage` / `sessionStorage` 仅用于主题、学习进度、工具热度等**非密钥**偏好（见 `ux.js`、`progress.js`、`engagement.js`）。

## 4. 站内搜索与本地 API

- 生产环境：知识库搜索使用客户端 `search-index.json` + Fuse.js（`knowledge.js`）。
- 本地可选：`./start.sh` 启动 FastAPI，`/api/ask` 为**站内 BM25/Fuse 检索**，不调用外部 LLM，也不承载用户密钥。
- GitHub Pages **不部署** `/api/*` 路由。

## 5. incident 响应

若误提交密钥：

1. **立即**在对应服务商控制台轮换 / 吊销密钥。
2. 从 Git 历史中清除（如 `git filter-repo`），并 force-push。
3. 假定密钥已泄露，检查账单与用量异常。

## 6. Content-Security-Policy（XSS 防御）

站点通过 HTTP 响应头限制浏览器可加载的资源来源，降低 XSS 与恶意注入的影响面。

| 层级       | 文件                                | 说明                                     |
| ---------- | ----------------------------------- | ---------------------------------------- |
| **主策略** | `config/csp.json` → `_headers`      | Cloudflare 边缘注入；`prebuild` 自动同步 |
| **兜底**   | `src/components/SecurityMeta.astro` | GitHub Pages 无自定义头时的 `<meta>` CSP |

**已收紧的指令（相对初版）：**

- `script-src-attr 'none'` — 禁止内联事件处理器（`onclick` 等）
- `frame-src 'none'` / `frame-ancestors 'none'` — 禁止被嵌入 iframe
- `worker-src 'none'` — 禁止 Service Worker 滥用
- `object-src 'none'` — 禁止 Flash 等插件
- `style-src-attr 'unsafe-inline'` — 允许 Astro 模板中的 `style=` 属性（与 `style-src` 分离）

**仍保留 `unsafe-inline` 的原因：** `ThemeBoot.astro` 等首屏内联脚本尚未改为 nonce/hash；完全移除需后续重构。

修改 CSP 时只编辑 `config/csp.json`，然后 `node scripts/csp-policy.mjs` 或 `npm run build` 同步 `_headers`。

## 7. CI 密钥扫描（双重）

每次 `push` / `pull_request` 在 **Lint 之前**执行两道扫描，阻断密钥进入仓库：

| 工具            | 命令 / 配置                                      | 作用                                                                             |
| --------------- | ------------------------------------------------ | -------------------------------------------------------------------------------- |
| **validate_ci** | `python3 scripts/validate_ci.py secrets`         | 自定义正则：OpenAI `sk-`、Anthropic、Google `AIza…`、私钥块、`.env.local` 误提交 |
| **gitleaks**    | `.gitleaks.toml` + `gitleaks/gitleaks-action@v2` | 业界规则库 + git 历史深度扫描                                                    |

本地自检：

```bash
npm run scan:secrets
# 若已安装 gitleaks CLI：gitleaks detect --source . --config .gitleaks.toml
```

## 相关文件

- `.gitignore` — 忽略 `.env.local`、`.env*.local`
- `.env.local.example` — 本地变量模板（可提交）
- `config/csp.json` — CSP 单一事实来源
- `.gitleaks.toml` — gitleaks 允许列表
- `scripts/validate_ci.py` — CI 密钥扫描与产物校验
- `_headers` — Cloudflare 安全响应头（含 CSP）
- `DEVELOPER.md` — 开发流程
