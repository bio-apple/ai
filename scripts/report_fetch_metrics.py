#!/usr/bin/env python3
"""抓取结果写入 GitHub Step Summary，并返回是否「严重不足」。"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

YT_KEYS = ("youtube_top_views", "youtube_recent_30d", "youtube_recent_24h")
BILI_KEYS = ("bilibili_top_views", "bilibili_recent_30d", "bilibili_recent_24h")


def append_summary(md: str) -> None:
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if path:
        with open(path, "a", encoding="utf-8") as fh:
            fh.write(md)
            if not md.endswith("\n"):
                fh.write("\n")


def _count(cats: dict, key: str) -> int:
    return len((cats.get(key) or {}).get("videos") or [])


def report_videos() -> int:
    """返回 0=健康 1=警告 2=严重（应开 Issue，但不应阻断 commit）。"""
    path = ROOT / "daily-videos.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    batch = (data.get("batches") or [None])[0]
    if not batch:
        append_summary("### Daily videos\n\n- **FAIL**: 无批次\n")
        return 2
    cats = batch.get("categories") or {}
    lines = ["### Daily videos\n", f"- date: `{batch.get('date')}`\n"]
    warn = 0
    total = 0
    for key, cat in cats.items():
        n = len(cat.get("videos") or [])
        need = cat.get("top_count") or 0
        total += n
        flag = "OK" if n >= need else "WARN"
        if n < need:
            warn += 1
        lines.append(f"- `{key}`: {n}/{need} ({flag})\n")
    append_summary("".join(lines))

    yt_total = sum(_count(cats, k) for k in YT_KEYS)
    bili_total = sum(_count(cats, k) for k in BILI_KEYS)

    # 严重：整批无片，或双平台全空（没有可展示内容）
    if total == 0 or (yt_total == 0 and bili_total == 0):
        return 2
    # 单平台全空：警告（例如 YouTube 挂了但 B 站有货 → 仍应提交）
    if yt_total == 0 or bili_total == 0:
        warn += 1
    return 1 if warn else 0


def report_news() -> int:
    path = ROOT / "ai-news.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    items = data.get("items") or []
    watch = data.get("watch_sources") or []
    append_summary(
        "### Daily news\n\n"
        f"- updated_at: `{data.get('updated_at')}`\n"
        f"- items: **{len(items)}**\n"
        f"- watch_sources: {len(watch)}\n"
    )
    if len(items) < 5:
        return 2
    if len(items) < 15:
        return 1
    return 0


def main() -> int:
    kind = sys.argv[1] if len(sys.argv) > 1 else ""
    if kind == "videos":
        code = report_videos()
    elif kind == "news":
        code = report_news()
    else:
        print("用法: report_fetch_metrics.py [videos|news]", file=sys.stderr)
        return 2

    # 供 workflow 读取：严重/警告仍把 exit 写到 output，但视频路径默认 exit 0，避免阻断 commit
    out = os.environ.get("GITHUB_OUTPUT")
    if out:
        with open(out, "a", encoding="utf-8") as fh:
            fh.write(f"level={code}\n")

    if code >= 2:
        append_summary(
            "\n**严重不足 · 建议处置**\n\n"
            "1. 打开本 workflow 日志确认分类为空原因（配额 / 网络 / 解析 / 缺 JS runtime）\n"
            "2. `workflow_dispatch` 重跑；视频可勾选 force\n"
            "3. 仍失败：按 `docs/OPS-RUNBOOK.md` 回滚上一好批次\n"
        )
    elif code == 1:
        append_summary(
            "\n**有警告**：非阻断；常见于 YouTube 为空但 B 站有货。"
            "页面可用「回退批次」补 YouTube 空类。\n"
        )

    print(f"metrics_level={code}")
    # 新闻：严重时仍失败（无 commit 步依赖时由 workflow 决定）
    # 视频：永远 exit 0，由 workflow 用 outputs.level 开 Issue；禁止阻断 commit
    if kind == "videos":
        return 0
    return 0 if code < 2 else 1


if __name__ == "__main__":
    raise SystemExit(main())
