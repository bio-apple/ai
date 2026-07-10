# AI 应用指南 — 开发者文档

本文档面向维护与二次开发本项目的开发者，说明架构、目录结构、数据格式、自动化流程与常见改动方式。

- **线上地址**：https://bio-apple.github.io/ai/
- **仓库**：https://github.com/bio-apple/ai
- **类型**：纯静态前端 + 可选本地静态服务 + GitHub Actions 自动化

---

## 目录

1. [架构概览](#架构概览)
2. [技术栈](#技术栈)
3. [目录结构](#目录结构)
4. [前端设计](#前端设计)
5. [本地开发](#本地开发)
6. [每日视频流水线](#每日视频流水线)
7. [数据格式](#数据格式)
8. [CI/CD 与部署](#cicd-与部署)
9. [内容维护指南](#内容维护指南)
10. [配置参考](#配置参考)
11. [故障排查](#故障排查)

---

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                     GitHub 仓库 (main)                       │
├─────────────────────────────────────────────────────────────┤
│  index.html + style.css + app.js + videos.js                │
│  daily-videos.json（视频数据，由 Actions 每日更新）            │
└───────────────┬─────────────────────────┬───────────────────┘
                │ push                    │ cron 00:00 北京时间
                ▼                         ▼
     ┌──────────────────┐      ┌──────────────────────────┐
     │ Deploy GitHub    │      │ Daily AI Video Update    │
     │ Pages workflow   │      │ + fetch_daily_videos.py  │
     └────────┬─────────┘      └────────────┬─────────────┘
              │                              │ commit JSON
              ▼                              ▼
     https://bio-apple.github.io/ai/  ←── 再次触发 Pages 部署
```

**设计原则**

- 生产环境以 **GitHub Pages 静态托管** 为主，无后端 API、无数据库、无用户系统。
- `backend/` 仅用于 **本地预览**（FastAPI 静态文件服务），与线上行为等价。
- 动态内容（每日视频）通过 **提交 JSON 文件** 实现，由 GitHub Actions 定时写入。

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 页面 | HTML5、语义化区块 |
| 样式 | 原生 CSS（CSS 变量主题） |
| 交互 | 原生 JavaScript（无框架） |
| 视频数据 | `daily-videos.json` + `fetch` 加载 |
| 视频抓取 | Python 3.12 + [yt-dlp](https://github.com/yt-dlp/yt-dlp) |
| 本地服务 | FastAPI + Uvicorn（可选） |
| 部署 | GitHub Pages + GitHub Actions |
| 可选云端 | Render / Docker（静态服务镜像） |

---

## 目录结构

```
ai/
├── index.html              # 主页面（所有工具教程、实战、视频区块）
├── style.css               # 全局样式与组件样式
├── app.js                  # 导航切换、案例折叠/筛选、提示词复制
├── videos.js               # 每日视频列表渲染
├── daily-videos.json       # 视频数据（Actions 每日追加）
│
├── scripts/
│   └── fetch_daily_videos.py   # 视频抓取与筛选脚本
│
├── backend/                # 可选本地静态服务器
│   ├── main.py
│   └── config.py
│
├── .github/workflows/
│   ├── pages.yml           # push → GitHub Pages 部署
│   └── daily-videos.yml    # 定时抓取视频并 push
│
├── config.yaml             # 本地服务 host/port
├── requirements.txt        # FastAPI 依赖（本地服务用）
├── start.sh                # 本地启动脚本
├── cloud-test.sh           # 线上/本地冒烟测试
├── Dockerfile              # 容器化静态服务
├── render.yaml             # Render 部署配置
├── README.md               # 用户向说明
└── DEVELOPER.md            # 本文档
```

---

## 前端设计

### 单页多区块（SPA 式，无路由库）

每个导航标签对应一个 `<section class="section">`，通过 `active` 类控制显示：

| `data-tool` | Section ID | 内容 |
|-------------|------------|------|
| `all` | `section-home` | 总览、工具卡片、对比表、学习路径 |
| `chatgpt` … `copilot` | `section-{tool}` | 各 AI 工具教程 |
| `cases` | `section-cases` | 实战案例（可折叠） |
| `videos` | `section-videos` | 每日视频推荐 |

导航逻辑见 `app.js` 中 `showSection()`：

```javascript
// data-tool="chatgpt" → 显示 #section-chatgpt
showSection(`section-${tool}`);
```

### 样式约定

`style.css` 使用 CSS 变量定义工具品牌色：

```css
:root {
  --chatgpt: #0d8f6f;
  --claude: #c45c3e;
  --kimi: #5b21b6;
  /* ... */
}
```

新增工具时需同步添加：

- `.tool-card.{tool}` / `.tool-icon.{tool}` / `.{tool}-section .dot`
- `.nav-tab[data-tool="{tool}"].active` 下划线色
- `.case-badge.{tool}`（若有实战案例）

### 实战案例组件

```html
<article class="case-card" data-tool="cursor">
  <div class="case-header" role="button" tabindex="0">...</div>
  <div class="case-body">...</div>
</article>
```

- 点击 header 展开/收起（手风琴，同时只开一个）
- `.case-filter[data-filter]` 按 `data-tool` 过滤显示
- `.prompt-block` 点击复制提示词到剪贴板

### 视频模块

`videos.js` 在 `DOMContentLoaded` 时 `fetch('daily-videos.json')`，按 `batches[].date` 分组渲染卡片。

**注意**：`fetch` 使用相对路径，在 GitHub Pages 子路径 `/ai/` 下可正常工作。

---

## 本地开发

### 方式一：直接打开（仅静态）

```bash
cd ai
python3 -m http.server 8080
# 访问 http://127.0.0.1:8080
```

适合改 HTML/CSS/JS；视频模块需能访问到 `daily-videos.json`。

### 方式二：FastAPI 服务（推荐）

```bash
cd ai
./start.sh
# 访问 http://127.0.0.1:8765
```

`start.sh` 会创建 `.venv`、安装 `requirements.txt`、以热重载模式启动 Uvicorn。

`backend/main.py` 行为：

- `GET /` → `index.html`
- `GET /{filepath}` → 白名单静态文件（`.html` `.css` `.js` `.json` 等）
- 拒绝 `api/`、`backend/`、`data/`、`uploads/` 路径

### 冒烟测试

```bash
# 仅测 GitHub Pages
./cloud-test.sh

# 测本地服务
API_URL=http://127.0.0.1:8765 ./cloud-test.sh
```

---

## 每日视频流水线

### 触发时机

| 触发器 | 说明 |
|--------|------|
| `cron: "0 16 * * *"` | UTC 16:00 = **北京时间次日 00:00**（上海无夏令时） |
| `workflow_dispatch` | GitHub Actions 手动运行 |

工作流文件：`.github/workflows/daily-videos.yml`

### 抓取流程

```
1. yt-dlp 多关键词搜索（SEARCH_QUERIES）
2. 扁平结果预筛：播放量 ≥ MIN_VIEWS、AI 关键词匹配
3. 按播放量排序，逐条拉取完整元数据
4. 校验：max_height ≥ 1080、订阅数 ≥ MIN_SUBSCRIBERS
5. 综合评分：views × (1 + log10(subscribers))
6. 取 Top 10，写入当日 batch，追加 seen_ids 去重
7. git commit daily-videos.json → push → 触发 Pages 部署
```

### 本地手动运行

```bash
pip install yt-dlp
python scripts/fetch_daily_videos.py
```

**幂等性**：同一自然日（`Asia/Shanghai`）已存在 batch 时，脚本直接退出，不重复写入。

### 可调参数

编辑 `scripts/fetch_daily_videos.py` 顶部常量：

| 常量 | 默认值 | 含义 |
|------|--------|------|
| `MIN_DAILY` | `10` | 每日最少条数 |
| `MIN_VIEWS` | `8000` | 最低播放量 |
| `MIN_SUBSCRIBERS` | `1000` | 最低频道订阅数 |
| `MIN_HEIGHT` | `1080` | 最低分辨率（像素高度） |
| `SEARCH_PER_QUERY` | `18` | 每个关键词搜索条数 |
| `SEARCH_QUERIES` | 见源码 | 搜索关键词列表 |

### 依赖与限制

- 依赖 **yt-dlp** 访问 YouTube；CI 环境偶发超时需重试 workflow。
- 无需 YouTube API Key。
- 脚本运行时间约 **2–5 分钟**（取决于候选数量与网络）。

---

## 数据格式

### `daily-videos.json`

```json
{
  "updated_at": "2026-07-10T12:00:00+08:00",
  "seen_ids": ["videoId1", "videoId2"],
  "batches": [
    {
      "date": "2026-07-10",
      "timezone": "Asia/Shanghai",
      "criteria": {
        "min_height": 1080,
        "min_views": 8000,
        "min_subscribers": 1000,
        "min_daily": 10
      },
      "videos": [
        {
          "id": "WVeYLlKOWc0",
          "title": "视频标题",
          "summary": "简要中文说明",
          "url": "https://www.youtube.com/watch?v=...",
          "thumbnail": "https://i.ytimg.com/vi/.../maxresdefault.jpg",
          "channel": "频道名",
          "subscribers": 72500,
          "views": 61235029,
          "duration": "12:32",
          "max_height": 1080,
          "score": 358857967.78
        }
      ]
    }
  ]
}
```

- `batches`：**新日期插入数组头部**（最新在前）
- `seen_ids`：全局已收录视频 ID，防止重复
- 历史 batch 最多保留 **60 天**（脚本内截断）

---

## CI/CD 与部署

### GitHub Pages

工作流：`.github/workflows/pages.yml`

- **触发**：`push` 到 `main`，或手动 `workflow_dispatch`
- **产物**：仓库根目录整体上传为 Pages artifact
- **权限**：`pages: write`、`id-token: write`

仓库 Settings → Pages → Source 应为 **GitHub Actions**。

### 双工作流协作

```
daily-videos.yml  commit JSON
        ↓
   push to main
        ↓
   pages.yml 重新部署站点
```

### Docker / Render（可选）

```bash
docker build -t ai-guide .
docker run -p 8765:8765 ai-guide
```

`render.yaml` 提供 Render 免费层配置，本质仍为静态文件服务，非必须。

---

## 内容维护指南

### 新增 AI 工具教程

1. **`index.html` — 导航**

```html
<button class="nav-tab" data-tool="newtool">新工具</button>
```

2. **`index.html` — 总览卡片**（`tool-cards` 内）

```html
<div class="tool-card newtool" data-tool="newtool">
  <span class="badge">厂商</span>
  <h3>新工具</h3>
  <p>一句话描述</p>
</div>
```

3. **`index.html` — 教程区块**

```html
<section id="section-newtool" class="section newtool-section">
  <main>
    <div class="tool-header">...</div>
    <div class="grid-2">快速入门 + 核心功能</div>
    <h3 class="resources-title">📄 文字资料</h3>
    <div class="resource-grid">...</div>
  </main>
</section>
```

4. **`style.css`** — 添加 `--newtool` 变量及对应 class。

5. **（可选）** 对比表、学习路径、实战案例与 `case-filter` 按钮。

### 新增实战案例

在 `#section-cases` 内复制 `case-card` 模板，设置 `data-tool` 与 `case-badge`。

### 修改视频筛选逻辑

仅改 `scripts/fetch_daily_videos.py`，勿改 `videos.js`（除非要改 UI 字段）。

---

## 配置参考

### `config.yaml`

```yaml
server:
  host: "127.0.0.1"
  port: 8765
```

环境变量覆盖（`backend/config.py`）：

| 变量 | 作用 |
|------|------|
| `HOST` | 监听地址 |
| `PORT` | 监听端口 |

### `.gitignore`

```
data/
uploads/
.venv/
__pycache__/
.env
```

`daily-videos.json` **不被忽略**，需纳入版本控制供 Pages 读取。

---

## 故障排查

| 现象 | 可能原因 | 处理 |
|------|----------|------|
| Pages 404 | Pages 未启用 Actions 源 | 检查仓库 Settings → Pages |
| 视频页空白 | `daily-videos.json` 缺失或未部署 | 确认文件已 commit；手动跑 workflow |
| 视频未每日更新 | Actions 定时任务未跑或 yt-dlp 失败 | Actions 日志；手动 `workflow_dispatch` |
| 当日重复执行脚本 | 正常，脚本检测当日 batch 已存在会跳过 | 无需处理 |
| 筛选不足 10 条 | YouTube 候选不够或阈值过高 | 降低 `MIN_VIEWS` / `MIN_SUBSCRIBERS` |
| 本地 `start.sh` 失败 | 依赖未装或端口占用 | `pip install -r requirements.txt`；换端口 |
| 外链 AI 无法访问本站 | 对方无网页抓取能力 | 与站点无关，见 README |

### GitHub Actions 权限

`daily-videos.yml` 需要 `contents: write` 以 push commit。若 push 失败，检查：

- Settings → Actions → General → Workflow permissions 是否为 **Read and write**

---

## 版本与变更记录

| 版本 | 说明 |
|------|------|
| 1.0 | 六工具教程 + 实战案例 |
| 1.1 | 用户注册/社区（已移除） |
| 1.2 | 纯静态站；新增 Kimi/通义/豆包/Copilot |
| 1.3 | 每日 1080p 视频自动更新 |

---

## 贡献流程

```bash
git checkout -b feature/your-change
# 编辑并本地验证
./start.sh
git add ...
git commit -m "feat: ..."
git push origin feature/your-change
# 提 PR 合并至 main → 自动部署 Pages
```

---

## 相关链接

- [GitHub Pages 文档](https://docs.github.com/en/pages)
- [yt-dlp 文档](https://github.com/yt-dlp/yt-dlp#usage-and-options)
- [FastAPI 文档](https://fastapi.tiangolo.com/)
