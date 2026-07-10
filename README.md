# AI 应用指南

学习如何使用与应用人工智能——覆盖 ChatGPT、Claude、Gemini、DeepSeek、Kimi、通义千问、豆包、Copilot、Cursor、Codex 等主流工具。

## 功能

- 📖 十大 AI 工具教程：使用方法、核心功能、官方文档
- 🎯 应用场景：写作、学习、编程、数据分析、图像视频、工作效率
- ⚡ Step-by-Step 实战案例
- 👤 Claude 风格注册 / 登录（邮箱优先、Google 按钮、分步流程）

## 涵盖工具

| 类型 | 工具 |
|------|------|
| 国际对话 AI | ChatGPT、Claude、Gemini |
| 国内对话 AI | Kimi、通义千问、豆包、DeepSeek |
| 编程与开发 AI | Cursor、Codex、Copilot |

## 启动

```bash
cd ai
./start.sh
```

访问 http://127.0.0.1:8765

GitHub Pages（https://bio-apple.github.io/ai/）仅托管静态教程页面；注册上传与 Google 登录需运行本地/服务器后端。

## Google 登录配置

1. 打开 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建项目 → **API 和服务** → **凭据** → **创建凭据** → **OAuth 客户端 ID**
3. 应用类型选 **Web 应用**
4. **已授权重定向 URI** 添加：
   ```
   http://127.0.0.1:8765/api/auth/google/callback
   ```
5. 将 Client ID 和 Client Secret 填入 `config.yaml`：

```yaml
google_oauth:
  client_id: "你的-client-id.apps.googleusercontent.com"
  client_secret: "你的-client-secret"
```

也可通过环境变量设置：

```bash
export GOOGLE_CLIENT_ID="..."
export GOOGLE_CLIENT_SECRET="..."
./start.sh
```

6. 在 [OAuth 同意屏幕](https://console.cloud.google.com/apis/credentials/consent) 配置测试用户（开发阶段）

配置完成后，点击「使用 Google 账号继续」即可登录。
