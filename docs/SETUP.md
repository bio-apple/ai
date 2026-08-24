# 环境搭建与本地预览

线上：https://bio-apple.github.io/ai/（纯静态，无 `/api/*`）  
开发速查：[DEVELOPER.md](../DEVELOPER.md)

## 1. 环境

| 组件 | 版本 | 用途 |
|------|------|------|
| Node.js | **22.x**（`.nvmrc`） | 构建 / ESLint / Playwright |
| Python | **3.12** | 抓取 / 校验 / 本地 API |
| Git | 2.x | — |

```bash
nvm install && nvm use
node -v   # v22.x
python3 --version   # 3.12.x
```

## 2. 首次搭建

```bash
git clone https://github.com/bio-apple/ai.git && cd ai
nvm use
npm ci
cp .env.local.example .env.local   # 可选
./build.sh && ./start.sh
```

打开 **http://127.0.0.1:8765/ai/**

校验：`npm run quality && npm run build && DIST=dist python3 scripts/validate_ci.py`

## 3. 三种预览

| 方式 | 命令 | 地址 |
|------|------|------|
| 推荐（静态 + 本地 API） | `./build.sh && ./start.sh` | `:8765/ai/` |
| 仅静态 | `npm run build && npm run preview` | `:8766/ai/` |
| Astro 开发 | `npm run dev` | 热更新（无完整 dist 校验） |

## 4. 本地环境变量

见 `.env.local.example`：`VIDEO_SYNC_*`、`YOUTUBE_API_KEY`、`GITHUB_TOKEN`、分析 ID 等。  
**勿提交** `.env.local`。规范见 [SECURITY.md](./SECURITY.md)。

## 5. 刷新抓取数据

```bash
python3 scripts/fetch_ai_news.py
python3 scripts/fetch_oss_heating.py
npm run build
```

日更频率与救急 → [CONTENT-OPS.md](./CONTENT-OPS.md)

## 6. 排障

| 现象 | 处理 |
|------|------|
| Node 版本不对 | `nvm use` |
| 页面 404 / 旧数据 | 重新 `npm run build`；确认 base `/ai/` |
| 视频云端失败 | 查 Worker URL、CSP（[CLOUDFLARE-SYNC.md](./CLOUDFLARE-SYNC.md)） |
| 端口占用 | 改 `start.sh` / preview 端口 |

## 相关

[DEVELOPER.md](../DEVELOPER.md) · [CI-CD.md](./CI-CD.md) · [ARCHITECTURE.md](./ARCHITECTURE.md)
