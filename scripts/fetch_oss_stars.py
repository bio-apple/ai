#!/usr/bin/env python3
"""刷新 data/oss-projects.json 中各仓库的 GitHub Stars。"""

from __future__ import annotations

import json
import os
import ssl
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = ROOT / "data" / "oss-projects.json"
PUBLIC_FILE = ROOT / "oss-projects.json"
PROMPT_LIBS_FILE = ROOT / "data" / "prompt-libraries.json"
TZ = timezone(timedelta(hours=8))
USER_AGENT = "BioAI-Lab-OSSBot/1.0"


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


def fetch_repo_stars(repo: str) -> int | None:
    url = f"https://api.github.com/repos/{repo}"
    headers = github_headers()
    try:
        req = Request(url, headers=headers)
        with urlopen(req, timeout=20, context=ssl_context()) as resp:
            data = json.loads(resp.read().decode())
        return int(data.get("stargazers_count", 0))
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
            proc = subprocess.run(
                curl_cmd,
                capture_output=True,
                check=True,
                text=True,
            )
            data = json.loads(proc.stdout)
            return int(data.get("stargazers_count", 0))
        except Exception as curl_err:
            print(f"skip {repo}: {err}; curl: {curl_err}", file=sys.stderr)
            return None


def main() -> int:
    token = (os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN") or "").strip()
    if not token:
        print("⚠ GITHUB_TOKEN/GH_TOKEN 未设置，使用匿名 GitHub API（易触发限流）", file=sys.stderr)
    else:
        print("✓ 使用 GITHUB_TOKEN 调用 GitHub API")

    payload = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    updated = 0
    skipped = 0
    for domain in payload.get("domains", []):
        for project in domain.get("projects", []):
            repo = project.get("repo")
            if not repo:
                continue
            stars = fetch_repo_stars(repo)
            if stars is None:
                skipped += 1
                continue
            project["stars"] = stars
            updated += 1

    payload["updated_at"] = datetime.now(TZ).strftime("%Y-%m-%d")
    text = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    DATA_FILE.write_text(text, encoding="utf-8")
    PUBLIC_FILE.write_text(text, encoding="utf-8")
    sync_prompt_libraries(payload)
    print(f"✓ oss-projects.json ({updated} repos, {skipped} skipped) → {DATA_FILE}")
    if updated == 0 and skipped > 0:
        print("✗ 全部仓库刷新失败，保留原文件但以非零退出", file=sys.stderr)
        return 1
    return 0


def sync_prompt_libraries(payload: dict) -> None:
    """从 OSS 的 Prompt 库领域同步 GitHub Top 10，并保留角色分类。"""
    domain = next((d for d in payload.get("domains") or [] if d.get("id") == "prompt-libs"), None)
    if not domain:
        return

    existing: dict = {}
    if PROMPT_LIBS_FILE.exists():
        try:
            existing = json.loads(PROMPT_LIBS_FILE.read_text(encoding="utf-8"))
        except Exception as err:
            print(f"warn: 无法读取既有 prompt-libraries.json: {err}", file=sys.stderr)

    role_by_id = {
        lib.get("id"): lib.get("role")
        for lib in existing.get("libraries") or []
        if lib.get("id") and lib.get("role")
    }
    role_by_repo = {
        lib.get("repo"): lib.get("role")
        for lib in existing.get("libraries") or []
        if lib.get("repo") and lib.get("role")
    }

    libs = sorted(domain.get("projects") or [], key=lambda p: -(p.get("stars") or 0))
    ranked = []
    for i, project in enumerate(libs[:10], start=1):
        item = {**project, "rank": i}
        role = (
            project.get("role")
            or role_by_id.get(project.get("id"))
            or role_by_repo.get(project.get("repo"))
        )
        if role:
            item["role"] = role
        ranked.append(item)

    out = {
        "updated_at": payload.get("updated_at"),
        "title": existing.get("title") or "GitHub Top 10 Prompt 库",
        "lead": existing.get("lead")
        or "按角色浏览 GitHub Stars 最高的开源 Prompt 资源，从 WEB 开发起步。",
        "source_note": existing.get("source_note")
        or "排名按 Star 数；角色分类便于选型，每周随 OSS 刷新更新。",
        "roles": existing.get("roles")
        or [
            {
                "id": "web-dev",
                "label": "WEB 开发",
                "blurb": "面向前端/全栈：优化提示词、编排可复用 Pattern。",
            },
            {
                "id": "ai-coding",
                "label": "AI 编程",
                "blurb": "Cursor、Claude Code、GPTs 等编程助手系统提示与用法。",
            },
            {
                "id": "pe-learning",
                "label": "提示工程",
                "blurb": "系统学习 Prompt Engineering 的指南与官方教程。",
            },
            {
                "id": "general-roles",
                "label": "通用角色",
                "blurb": "跨场景角色扮演与社区精选提示词。",
            },
            {
                "id": "zh-scenes",
                "label": "中文场景",
                "blurb": "中文写作、办公、调教与可玩性提示词。",
            },
            {
                "id": "system-prompts",
                "label": "系统提示词",
                "blurb": "主流模型与产品系统提示词摘录，适合研究与对照。",
            },
        ],
        "libraries": ranked,
    }
    PROMPT_LIBS_FILE.write_text(
        json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"✓ prompt-libraries.json ({len(ranked)} repos) → {PROMPT_LIBS_FILE}")


if __name__ == "__main__":
    raise SystemExit(main())
