#!/usr/bin/env python3
"""按 AI 应用分类收集 / 刷新 GitHub Stars 开源精选。

规则：
1. 按 AI 应用领域分类
2. 全球榜：Stars ≥ 50,000，每类按 Stars 降序最多 Top 3
3. 每类额外增加 1 个「中文 Top1」（该应用中文候选里 Stars 最高者；若已在 Top3 则仅标注）
4. 由 daily-oss.yml 每日自动重刷
"""

from __future__ import annotations

import json
import os
import ssl
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.request import Request, urlopen

from fetch_resilience import load_json, retry_with_backoff, write_or_preserve

ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = ROOT / "data" / "oss-projects.json"
PUBLIC_FILE = ROOT / "oss-projects.json"
TZ = timezone(timedelta(hours=8))
USER_AGENT = "BioAI-Lab-OSSBot/1.0"

MIN_STARS = 50_000
TOP_N = 3

# 按 AI 应用分类的候选仓库（全球 Top3 + 中文 Top1）
APP_CATALOG: list[dict] = [
    {
        "id": "ai-agent",
        "label": "AI Agent",
        "description": "自主规划、多代理协作与 Agent 记忆/工具编排",
        "zh_candidates": [
            {
                "id": "metagpt",
                "repo": "FoundationAgents/MetaGPT",
                "name": "MetaGPT",
                "description": "国产多智能体「软件公司」框架，从需求到代码协作生成。",
            },
            {
                "id": "hello-agents",
                "repo": "datawhalechina/hello-agents",
                "name": "Hello-Agents",
                "description": "《从零开始构建智能体》中文教程与实践。",
            },
            {
                "id": "tradingagents",
                "repo": "TauricResearch/TradingAgents",
                "name": "TradingAgents",
                "description": "多智能体 LLM 金融交易框架。",
            },
        ],
        "candidates": [
            {
                "id": "autogpt",
                "repo": "Significant-Gravitas/AutoGPT",
                "name": "AutoGPT",
                "description": "经典自主 Agent 项目，探索目标驱动的多步任务执行。",
            },
            {
                "id": "tradingagents",
                "repo": "TauricResearch/TradingAgents",
                "name": "TradingAgents",
                "description": "多智能体 LLM 金融交易框架。",
            },
            {
                "id": "metagpt",
                "repo": "FoundationAgents/MetaGPT",
                "name": "MetaGPT",
                "description": "多智能体「软件公司」框架，从需求到代码协作生成。",
            },
            {
                "id": "mem0",
                "repo": "mem0ai/mem0",
                "name": "Mem0",
                "description": "面向 AI Agent 的通用记忆层。",
            },
            {
                "id": "autogen",
                "repo": "microsoft/autogen",
                "name": "AutoGen",
                "description": "微软 Agent 编程框架，支持多代理对话与工具调用。",
            },
            {
                "id": "crewai",
                "repo": "crewAIInc/crewAI",
                "name": "crewAI",
                "description": "多 Agent 协作框架，适合角色分工与任务流水线。",
            },
        ],
    },
    {
        "id": "ai-coding",
        "label": "AI 编程",
        "description": "终端/IDE 编程助手与自主改码 Agent",
        "zh_candidates": [
            {
                "id": "qwen-code",
                "repo": "QwenLM/qwen-code",
                "name": "Qwen Code",
                "description": "通义千问开源 AI 编程 Agent，可在终端完成改码任务。",
            },
        ],
        "candidates": [
            {
                "id": "opencode",
                "repo": "anomalyco/opencode",
                "name": "OpenCode",
                "description": "开源 coding agent，面向仓库级自主开发。",
            },
            {
                "id": "claude-code",
                "repo": "anthropics/claude-code",
                "name": "Claude Code",
                "description": "Anthropic 终端编程 Agent，可读写代码与运行命令。",
            },
            {
                "id": "openhands",
                "repo": "OpenHands/OpenHands",
                "name": "OpenHands",
                "description": "开源 AI 驱动开发 Agent，可读写代码、运行命令并完成任务。",
            },
            {
                "id": "cline",
                "repo": "cline/cline",
                "name": "Cline",
                "description": "自主编程 Agent，支持 IDE 扩展、CLI 与 SDK。",
            },
        ],
    },
    {
        "id": "llm-apps",
        "label": "LLM 应用开发",
        "description": "RAG、工作流与可视化 LLM / Agent 应用搭建",
        "zh_candidates": [
            {
                "id": "dify",
                "repo": "langgenius/dify",
                "name": "Dify",
                "description": "国产开源 LLM 应用开发平台，支持 RAG、Agent 与工作流编排。",
            },
            {
                "id": "ragflow",
                "repo": "infiniflow/ragflow",
                "name": "RAGFlow",
                "description": "面向生产的开源 RAG 引擎与知识库问答平台。",
            },
            {
                "id": "lobehub",
                "repo": "lobehub/lobehub",
                "name": "LobeHub",
                "description": "Agent 运营与多助手工作区。",
            },
            {
                "id": "nextchat",
                "repo": "ChatGPTNextWeb/NextChat",
                "name": "NextChat",
                "description": "轻量跨端 AI 助手前端。",
            },
        ],
        "candidates": [
            {
                "id": "n8n",
                "repo": "n8n-io/n8n",
                "name": "n8n",
                "description": "工作流自动化平台，原生支持 AI 节点与 Agent 编排。",
            },
            {
                "id": "langflow",
                "repo": "langflow-ai/langflow",
                "name": "Langflow",
                "description": "可视化构建 LLM / Agent 应用的开源工具。",
            },
            {
                "id": "dify",
                "repo": "langgenius/dify",
                "name": "Dify",
                "description": "开源 LLM 应用开发平台，支持 RAG、Agent 与工作流编排。",
            },
            {
                "id": "langchain",
                "repo": "langchain-ai/langchain",
                "name": "LangChain",
                "description": "主流 LLM 应用编排框架，覆盖 Agent、工具调用与链式组合。",
            },
            {
                "id": "nextchat",
                "repo": "ChatGPTNextWeb/NextChat",
                "name": "NextChat",
                "description": "轻量跨端 AI 助手前端，支持 Web / iOS / macOS 等。",
            },
            {
                "id": "ragflow",
                "repo": "infiniflow/ragflow",
                "name": "RAGFlow",
                "description": "面向生产的开源 RAG 引擎与知识库问答平台。",
            },
            {
                "id": "lobehub",
                "repo": "lobehub/lobehub",
                "name": "LobeHub",
                "description": "Agent 运营与多助手工作区，组织你的 AI 工具矩阵。",
            },
            {
                "id": "anything-llm",
                "repo": "Mintplex-Labs/anything-llm",
                "name": "AnythingLLM",
                "description": "一站式私有知识库与多用户 LLM 工作区。",
            },
            {
                "id": "flowise",
                "repo": "FlowiseAI/Flowise",
                "name": "Flowise",
                "description": "可视化拖拽构建 AI Agent 与 LLM 流程。",
            },
            {
                "id": "llamaindex",
                "repo": "run-llama/llama_index",
                "name": "LlamaIndex",
                "description": "数据连接与 RAG 框架，快速构建知识库问答应用。",
            },
            {
                "id": "awesome-llm-apps",
                "repo": "Shubhamsaboo/awesome-llm-apps",
                "name": "Awesome LLM Apps",
                "description": "可运行的 AI Agent / RAG 应用合集，便于克隆实践。",
            },
        ],
    },
    {
        "id": "local-llm",
        "label": "本地大模型",
        "description": "端侧推理、模型服务与本地聊天入口",
        "zh_candidates": [
            {
                "id": "chatglm",
                "repo": "zai-org/ChatGLM-6B",
                "name": "ChatGLM-6B",
                "description": "清华开源双语对话大模型，中文本地部署经典选择。",
            },
            {
                "id": "qwen",
                "repo": "QwenLM/Qwen",
                "name": "Qwen",
                "description": "通义千问开源对话与预训练模型仓库。",
            },
            {
                "id": "xinference",
                "repo": "xorbitsai/inference",
                "name": "Xinference",
                "description": "一行切换任意开源 LLM 的推理与服务框架。",
            },
        ],
        "candidates": [
            {
                "id": "ollama",
                "repo": "ollama/ollama",
                "name": "Ollama",
                "description": "一键在本地运行 Llama、Qwen、DeepSeek 等开源模型。",
            },
            {
                "id": "open-webui",
                "repo": "open-webui/open-webui",
                "name": "Open WebUI",
                "description": "友好的本地/私有模型聊天界面，兼容 Ollama 与 OpenAI API。",
            },
            {
                "id": "llamacpp",
                "repo": "ggml-org/llama.cpp",
                "name": "llama.cpp",
                "description": "高性能 C/C++ 推理引擎，支持 CPU/GPU 量化部署。",
            },
            {
                "id": "vllm",
                "repo": "vllm-project/vllm",
                "name": "vLLM",
                "description": "高吞吐推理与服务引擎，适合本地/集群部署开源大模型。",
            },
        ],
    },
    {
        "id": "ai-art",
        "label": "AI 绘画",
        "description": "图像生成、扩散模型与创作工作流",
        "zh_candidates": [
            {
                "id": "fooocus",
                "repo": "lllyasviel/Fooocus",
                "name": "Fooocus",
                "description": "专注提示词与出图体验的本地绘画工具。",
            },
            {
                "id": "gfpgan",
                "repo": "TencentARC/GFPGAN",
                "name": "GFPGAN",
                "description": "腾讯开源人脸修复与增强算法。",
            },
            {
                "id": "controlnet",
                "repo": "lllyasviel/ControlNet",
                "name": "ControlNet",
                "description": "可控扩散模型条件生成框架。",
            },
        ],
        "candidates": [
            {
                "id": "sd-webui",
                "repo": "AUTOMATIC1111/stable-diffusion-webui",
                "name": "Stable Diffusion WebUI",
                "description": "最流行的 SD 图形界面，插件生态丰富。",
            },
            {
                "id": "comfyui",
                "repo": "Comfy-Org/ComfyUI",
                "name": "ComfyUI",
                "description": "节点式扩散模型工作流，灵活组合 ControlNet 与 LoRA。",
            },
            {
                "id": "stable-diffusion",
                "repo": "CompVis/stable-diffusion",
                "name": "Stable Diffusion",
                "description": "潜空间文生图扩散模型原版开源实现。",
            },
            {
                "id": "fooocus",
                "repo": "lllyasviel/Fooocus",
                "name": "Fooocus",
                "description": "专注提示词与出图体验的本地绘画工具。",
            },
        ],
    },
    {
        "id": "multimodal",
        "label": "多模态",
        "description": "视觉-语言、语音识别与跨模态感知",
        "zh_candidates": [
            {
                "id": "paddleocr",
                "repo": "PaddlePaddle/PaddleOCR",
                "name": "PaddleOCR",
                "description": "百度飞桨 OCR，文档/图片结构化抽取。",
            },
            {
                "id": "minicpm-v",
                "repo": "OpenBMB/MiniCPM-V",
                "name": "MiniCPM-V",
                "description": "面壁智能端侧多模态大模型。",
            },
            {
                "id": "qwen3-vl",
                "repo": "QwenLM/Qwen3-VL",
                "name": "Qwen3-VL",
                "description": "通义千问多模态视觉语言模型。",
            },
        ],
        "candidates": [
            {
                "id": "transformers",
                "repo": "huggingface/transformers",
                "name": "Transformers",
                "description": "Hugging Face 模型定义框架，覆盖 VLM、ASR 与多模态任务。",
            },
            {
                "id": "whisper",
                "repo": "openai/whisper",
                "name": "Whisper",
                "description": "OpenAI 开源语音识别模型，多语言转写强项。",
            },
            {
                "id": "paddleocr",
                "repo": "PaddlePaddle/PaddleOCR",
                "name": "PaddleOCR",
                "description": "文档/图片 OCR 与结构化抽取，服务多模态文档理解。",
            },
            {
                "id": "ultralytics",
                "repo": "ultralytics/ultralytics",
                "name": "Ultralytics YOLO",
                "description": "YOLO 系列目标检测、分割与姿态估计工具箱。",
            },
            {
                "id": "yolov5",
                "repo": "ultralytics/yolov5",
                "name": "YOLOv5",
                "description": "经典实时目标检测实现，工业视觉常用基线。",
            },
            {
                "id": "segment-anything",
                "repo": "facebookresearch/segment-anything",
                "name": "Segment Anything",
                "description": "Meta 通用图像分割模型（SAM）。",
            },
        ],
    },
    {
        "id": "ml-framework",
        "label": "机器学习框架",
        "description": "深度学习训练与机器学习基础设施",
        "zh_candidates": [
            {
                "id": "paddle",
                "repo": "PaddlePaddle/Paddle",
                "name": "PaddlePaddle",
                "description": "百度飞桨深度学习框架。",
            },
            {
                "id": "ncnn",
                "repo": "Tencent/ncnn",
                "name": "ncnn",
                "description": "腾讯高性能端侧神经网络推理框架。",
            },
            {
                "id": "mnn",
                "repo": "alibaba/MNN",
                "name": "MNN",
                "description": "阿里巴巴轻量高速推理引擎。",
            },
        ],
        "candidates": [
            {
                "id": "tensorflow",
                "repo": "tensorflow/tensorflow",
                "name": "TensorFlow",
                "description": "端到端机器学习平台，覆盖训练与部署。",
            },
            {
                "id": "pytorch",
                "repo": "pytorch/pytorch",
                "name": "PyTorch",
                "description": "主流深度学习框架，研究与生产部署首选。",
            },
            {
                "id": "scikit-learn",
                "repo": "scikit-learn/scikit-learn",
                "name": "scikit-learn",
                "description": "经典机器学习库，覆盖分类、回归与聚类等算法。",
            },
            {
                "id": "keras",
                "repo": "keras-team/keras",
                "name": "Keras",
                "description": "高阶深度学习 API，降低模型搭建门槛。",
            },
        ],
    },
    {
        "id": "prompt-libs",
        "label": "Prompt 库",
        "description": "按 Stars 精选的 Prompt / 提示工程开源资源（Top 3）",
        "zh_candidates": [
            {
                "id": "awesome-zh",
                "repo": "PlexPt/awesome-chatgpt-prompts-zh",
                "name": "ChatGPT 中文调教指南",
                "description": "中文场景 Prompt 与调教指南，覆盖写作、编程、办公等。",
            },
            {
                "id": "langgpt",
                "repo": "langgptai/LangGPT",
                "name": "LangGPT",
                "description": "结构化提示词方法论，帮助人人成为 Prompt 专家。",
            },
            {
                "id": "wonderful-prompts",
                "repo": "langgptai/wonderful-prompts",
                "name": "wonderful-prompts",
                "description": "中文 Prompt 精选，提升可玩性与可用性。",
            },
        ],
        "candidates": [
            {
                "id": "superpowers",
                "repo": "obra/superpowers",
                "name": "Superpowers",
                "description": "Agent 技能框架与软件开发方法论提示词体系。",
            },
            {
                "id": "prompts-chat",
                "repo": "f/prompts.chat",
                "name": "prompts.chat",
                "description": "原 Awesome ChatGPT Prompts，全球最大开源 Prompt 社区库。",
            },
            {
                "id": "system-prompts-ai-tools",
                "repo": "x1xhlol/system-prompts-and-models-of-ai-tools",
                "name": "System Prompts of AI Tools",
                "description": "Cursor、Claude Code、Devin 等主流 AI 工具系统提示词合集。",
            },
            {
                "id": "pe-guide",
                "repo": "dair-ai/Prompt-Engineering-Guide",
                "name": "Prompt Engineering Guide",
                "description": "提示工程指南：论文、课程、笔记与实践资源。",
            },
            {
                "id": "get-shit-done",
                "repo": "gsd-build/get-shit-done",
                "name": "Get Shit Done",
                "description": "轻量元提示与上下文工程框架，适合规格驱动开发。",
            },
            {
                "id": "awesome-zh",
                "repo": "PlexPt/awesome-chatgpt-prompts-zh",
                "name": "ChatGPT 中文调教指南",
                "description": "中文场景 Prompt 与调教指南，覆盖写作、编程、办公等。",
            },
            {
                "id": "system-prompts-leaks",
                "repo": "asgeirtj/system_prompts_leaks",
                "name": "system_prompts_leaks",
                "description": "各大模型与产品系统提示词摘录，持续更新。",
            },
        ],
    },
]


def ssl_context() -> ssl.SSLContext:
    try:
        import certifi

        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


def github_headers() -> dict[str, str]:
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": USER_AGENT,
        "X-GitHub-Api-Version": "2022-11-28",
    }
    token = (os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN") or "").strip()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def fetch_repo(repo: str) -> dict | None:
    url = f"https://api.github.com/repos/{repo}"
    headers = github_headers()

    def _urllib_get() -> dict:
        req = Request(url, headers=headers)
        with urlopen(req, timeout=20, context=ssl_context()) as resp:
            return json.loads(resp.read().decode())

    try:
        return retry_with_backoff(_urllib_get, label=f"github:{repo}")
    except Exception as err:
        try:
            curl_cmd = [
                "curl",
                "-sL",
                "--max-time",
                "20",
                "-H",
                f"User-Agent: {USER_AGENT}",
                "-H",
                "Accept: application/vnd.github+json",
            ]
            if "Authorization" in headers:
                curl_cmd.extend(["-H", f"Authorization: {headers['Authorization']}"])
            curl_cmd.append(url)
            proc = subprocess.run(curl_cmd, capture_output=True, check=True, text=True)
            data = json.loads(proc.stdout)
            if data.get("message") and not data.get("full_name"):
                print(f"skip {repo}: {data.get('message')}", file=sys.stderr)
                return None
            return data
        except Exception as curl_err:
            print(f"skip {repo}: {err}; curl: {curl_err}", file=sys.stderr)
            return None


def project_from_cand(cand: dict, data: dict) -> dict:
    full_name = data.get("full_name") or cand["repo"]
    return {
        "id": cand["id"],
        "repo": full_name,
        "name": cand.get("name") or data.get("name") or full_name.split("/")[-1],
        "description": cand.get("description")
        or (data.get("description") or "").strip()
        or full_name,
        "stars": int(data.get("stargazers_count") or 0),
        "url": data.get("html_url") or f"https://github.com/{full_name}",
        "language": data.get("language") or "",
    }


def pick_zh_top1(domain_def: dict) -> dict | None:
    """在中文候选中取 Stars 最高者作为中文 Top1。"""
    best: dict | None = None
    for cand in domain_def.get("zh_candidates") or []:
        repo = cand.get("repo")
        if not repo:
            continue
        data = fetch_repo(repo)
        if not data:
            continue
        item = project_from_cand(cand, data)
        item["locale"] = "zh"
        item["badge"] = "中文Top1"
        if best is None or item["stars"] > best["stars"]:
            best = item
    return best


def collect_domain(domain_def: dict) -> dict | None:
    projects: list[dict] = []
    for cand in domain_def.get("candidates") or []:
        repo = cand.get("repo")
        if not repo:
            continue
        data = fetch_repo(repo)
        if not data:
            continue
        stars = int(data.get("stargazers_count") or 0)
        if stars < MIN_STARS:
            print(f"  · drop {repo} ({stars} < {MIN_STARS})")
            continue
        item = project_from_cand(cand, data)
        projects.append(item)
        print(f"  · keep ★{stars} {item['repo']}")

    projects.sort(key=lambda p: -(p.get("stars") or 0))
    projects = projects[:TOP_N]
    if not projects:
        print(f"✗ {domain_def['id']}: 无 ≥{MIN_STARS} 项目，跳过该领域", file=sys.stderr)
        return None

    zh = pick_zh_top1(domain_def)
    if zh:
        # 已在全球 Top3：仅标注；否则追加中文 Top1
        existed = next(
            (
                p
                for p in projects
                if p.get("id") == zh["id"] or p.get("repo") == zh["repo"]
            ),
            None,
        )
        if existed:
            existed["locale"] = "zh"
            existed["badge"] = "中文Top1"
            print(f"  · zh-top1(mark) ★{existed['stars']} {existed['repo']}")
        else:
            projects.append(zh)
            print(f"  · zh-top1(add) ★{zh['stars']} {zh['repo']}")
    else:
        print(f"  · warn: 无可用中文 Top1 候选", file=sys.stderr)

    return {
        "id": domain_def["id"],
        "label": domain_def["label"],
        "description": domain_def["description"],
        "projects": projects,
    }


def main() -> int:
    token = (os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN") or "").strip()
    if not token:
        print("⚠ GITHUB_TOKEN/GH_TOKEN 未设置，使用匿名 GitHub API（易触发限流）", file=sys.stderr)
    else:
        print("✓ 使用 GITHUB_TOKEN 调用 GitHub API")

    print(
        f"规则：按 AI 应用分类 · Stars ≥ {MIN_STARS} · 每类 Top {TOP_N} + 中文Top1 · 每日重刷"
    )
    domains: list[dict] = []
    for domain_def in APP_CATALOG:
        print(f"→ {domain_def['label']} ({domain_def['id']})")
        domain = collect_domain(domain_def)
        if domain:
            domains.append(domain)

    if len(domains) < 6:
        print(f"警告：有效领域仅 {len(domains)} 个（目标 ≥6）", file=sys.stderr)

    payload = {
        "updated_at": datetime.now(TZ).strftime("%Y-%m-%d"),
        "title": "GitHub Stars 开源精选",
        "lead": (
            f"按 AI 应用分类精选 GitHub 高星开源项目"
            f"（≥{MIN_STARS // 10000}万 Stars Top {TOP_N}，每类另附中文 Top1），每日重新收集。"
        ),
        "schema_version": 1,
        "rules": {
            "min_stars": MIN_STARS,
            "top_n_per_app": TOP_N,
            "zh_top1_per_app": True,
            "refresh": "每日",
        },
        "domains": domains,
    }

    if write_or_preserve(
        DATA_FILE,
        payload,
        accept=lambda p: len(p.get("domains") or []) >= 6,
        label="开源精选",
        mirror_paths=[PUBLIC_FILE],
    ):
        total = sum(len(d.get("projects") or []) for d in domains)
        print(f"✓ oss-projects.json ({len(domains)} 应用 / {total} 仓库) → {DATA_FILE}")
        for d in domains:
            names = ", ".join(p["name"] for p in d["projects"])
            print(f"  - {d['label']}: {len(d['projects'])} · {names}")
        return 0

    return 0 if load_json(DATA_FILE) is not None else 1


if __name__ == "__main__":
    raise SystemExit(main())
