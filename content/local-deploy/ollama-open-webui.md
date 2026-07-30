---
title: Linux 服务器部署 Ollama + Open WebUI
lead: 用 systemd 在 Linux 上常驻 Ollama 推理服务，并用 Open WebUI 提供浏览器聊天界面。以下路径请按实际安装位置替换。
order: 10
audience: Linux 服务器 / 私有化环境
stack: [Ollama, Open WebUI, systemd]
---

## 1. 安装 Ollama

官方文档：https://docs.ollama.com/linux

若命令行下载不稳定，可在本地浏览器下载安装包后上传到服务器再解压。

```bash
curl -fsSL https://ollama.com/download/ollama-linux-amd64.tar.zst | sudo tar x -C /usr
```

## 2. 建立模型存储目录

单独目录存放大模型文件，便于扩容与备份。示例使用 `/path/to/ollama/models/`：

```bash
mkdir -p /path/to/ollama/models/
```

## 3. 配置 ollama.service

将下方内容保存为 `/etc/systemd/system/ollama.service`。

`ExecStart`、`PATH`、`OLLAMA_MODELS` 中的路径需与实际安装目录一致；`OLLAMA_HOST=0.0.0.0:11434` 表示监听所有网卡（仅内网时可改为 `127.0.0.1:11434`）。

```ini
[Unit]
Description=Ollama Service
After=network-online.target

[Service]
Type=simple

ExecStart=/path/to/ollama/bin/ollama serve

User=root
Group=root

Restart=always
RestartSec=5

Environment="OLLAMA_HOST=0.0.0.0:11434"
Environment="PATH=/path/to/ollama/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin"
Environment="OLLAMA_MODELS=/path/to/ollama/models/"

[Install]
WantedBy=multi-user.target
```

## 4. 安装 Open WebUI

推荐在独立虚拟环境中安装，避免污染系统 Python：

```bash
python3 -m venv /path/to/open-webui
/path/to/open-webui/bin/pip install -U pip
/path/to/open-webui/bin/pip install open-webui
```

安装完成后，确认 `open-webui` 可执行文件路径（下文记为 `/path/to/open-webui/bin/open-webui`）。

## 5. 配置 open-webui.service

将下方内容保存为 `/etc/systemd/system/open-webui.service`。

`After=ollama.service` 保证先起推理服务；`OLLAMA_BASE_URL` 指向本机 Ollama API。

```ini
[Unit]
Description=Open WebUI Service
After=network-online.target ollama.service

[Service]
Type=simple

User=root
Group=root

WorkingDirectory=/path/to/open-webui

ExecStart=/path/to/open-webui/bin/open-webui serve --port 3000

Restart=always
RestartSec=5

Environment="PATH=/path/to/open-webui/bin:/usr/local/bin:/usr/bin"
Environment="OLLAMA_BASE_URL=http://127.0.0.1:11434"

[Install]
WantedBy=multi-user.target
```

## 6. 拷贝 unit、开机自启并启动

两个 `.service` 文件需位于 `/etc/systemd/system/`，然后执行：

```bash
sudo systemctl daemon-reload
sudo systemctl enable ollama
sudo systemctl enable open-webui
sudo systemctl start ollama.service
sudo systemctl start open-webui.service
```

## 7. 验证与常用操作

浏览器访问：`http://服务器IP:3000`（Open WebUI）。

拉取模型示例：`ollama pull qwen2.5:7b`（在已配置好的 Ollama 环境中执行）。

排障：`systemctl status ollama`、`systemctl status open-webui`、`journalctl -u ollama -f`。

```bash
systemctl status ollama
systemctl status open-webui
curl -s http://127.0.0.1:11434/api/tags
```

## 注意事项

- 生产环境建议使用非 root 专用用户运行服务，并配合防火墙仅放行必要端口。
- 若官方 tar 安装到 `/usr`，可执行文件可能为 `/usr/bin/ollama`，请相应修改 `ExecStart` 与 `PATH`。
- Open WebUI 也可用 Docker 部署；本文以 pip + systemd 与 Ollama 同机搭配为例。
