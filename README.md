# AI 编程工具指南

学习 Claude、Codex、Cursor 的教程网站，支持用户注册与社区资料上传。

## 功能

- 📖 AI 工具教程、视频链接、实战案例
- 👤 用户注册 / 登录
- 📤 上传资料：Markdown（`.md`）、Word（`.docx`）、视频（`.mp4` 等）
- 👀 在线预览与下载社区资料

## 启动（含注册与上传功能）

GitHub Pages 仅托管静态页面，**用户系统需本地或服务器运行后端**：

```bash
cd ai
./start.sh
```

浏览器访问 http://127.0.0.1:8765 ，点击顶部「社区」注册并上传。

## 配置

编辑 `config.yaml` 可修改端口、JWT 密钥、上传大小限制等。

生产环境请务必修改 `auth.jwt_secret`。

## 技术栈

- 前端：HTML / CSS / JavaScript
- 后端：FastAPI + SQLite
- 认证：JWT + bcrypt
