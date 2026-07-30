---
title: Agent
lead: 从单轮对话到可执行工作流：用 Agent 串联工具调用、检索与多步任务，落地自动化与研发提效。
order: 5
audience: 开发者 / 产品团队
stack: [Agent, 工具调用, RAG, 工作流]
---

## 1. 什么时候用 Agent

适合需要**多步推理、调用外部工具、读写文件或查知识库**的任务，例如：

- 按需求改多个代码文件并本地验证
- 检索文档后生成报告或邮件草稿
- 拉取 API / 数据库结果再做汇总分析

若只是单次问答或固定模板生成，普通聊天或单次提示词通常更简单。

## 2. 常见落地形态

- **IDE Agent**：跨文件改代码、跑命令、修 bug（如 Cursor、Copilot Agent）
- **对话 + 工具**：浏览器内查资料、调 API、写文件（ChatGPT、Claude、豆包等开启工具/插件）
- **自托管工作流**：私有化、可编排多节点（Open WebUI 工具、LangGraph、Dify 工作流）

站内工具教程可参考 [Cursor](https://bio-apple.github.io/ai/tools/cursor.html)、[ChatGPT](https://bio-apple.github.io/ai/tools/chatgpt.html) 等页面。

## 3. 最小可行流程（通用）

1. **明确目标与边界**：输入、输出、可用工具、禁止操作（如不得删库）。
2. **准备上下文**：项目说明、API 文档、示例数据或 RAG 知识库。
3. **拆成可验证步骤**：每步有成功标准（文件已改、命令 exit 0、JSON 字段齐全）。
4. **人工复核关键动作**：写库、发邮件、合并 PR 前保留确认点。
5. **记录提示词与规则**：团队共享 Rules / 系统提示，减少漂移。

## 4. Cursor Agent 快速示例

在 Cursor 中可用自然语言描述任务，由 Agent 搜索代码库并编辑相关文件：

```text
在 src/utils 下新增 formatDate(ts)，并在首页引用展示「今日」。
改完后说明改了哪些文件。
```

建议配合项目 `.cursor/rules` 或 README 说明技术栈与目录约定。

## 5. 自托管侧：Ollama + 工具

若模型跑在本机（见 [Ollama + Open WebUI 部署案例](https://bio-apple.github.io/ai/local/ollama-open-webui.html)），可：

- 为 Open WebUI 配置**工具 / 函数**或外部 API
- 用 RAG 挂载内部文档，减少幻觉
- 限制 Agent 仅能访问白名单域名与路径

## 6. 排障要点

- **循环空转**：缩小工具集、要求每步输出结构化状态。
- **胡编 API**：强制先检索文档或只读探测，再执行写操作。
- **上下文爆炸**：分阶段任务，中间结果落盘或写入会话摘要。

> 本文是 Agent 实战导读；具体工具版本与界面以各产品文档为准。欢迎按你的场景补充子案例 Markdown 到本目录。
