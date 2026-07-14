#!/usr/bin/env python3
"""抓取结果写入 GitHub Step Summary，并返回是否「严重不足」。"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def append_summary(md: str) -> None:
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if path:
        with open(path, "a", encoding="utf-8") as fh:
            fh.write(md)
            if not md.endswith("\n"):
                fh.write("\n")


def report_videos() -> int:
    path = ROOT / "daily-videos.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    batch = (data.get("batches") or [None])[0]
    if not batch:
        append_summary("### Daily videos\n\n- **FAIL**: 无批次\n")
        return 2
    cats = batch.get("categories") or {}
    lines = ["### Daily videos\n", f"- date: `{batch.get('date')}`\n"]
    warn = 0
    for key, cat in cats.items():
        n = len(cat.get("videos") or [])
        need = cat.get("top_count") or 0
        flag = "OK" if n >= need else "WARN"
        if n < need:
            warn += 1
        lines.append(f"- `{key}`: {n}/{need} ({flag})\n")
    append_summary("".join(lines))
    # B 站短窗口常不足：仅当全部为空或核心 Top 为空时视为严重
    yt_top = len((cats.get("youtube_top_views") or {}).get("videos") or [])
    bili_top = len((cats.get("bilibili_top_views") or {}).get("videos") or [])
    if yt_top == 0 and bili_top == 0:
        return 2
    return 1 if warn else 0


def report_news() -> int:
    path = ROOT / "ai-news.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    items = data.get("items") or []
    watch = data.get("watch_sources") or []
    append_summary(
        "### Weekly news\n\n"
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
    if code >= 2:
        append_summary(
            "\n**严重不足 · 建议处置**\n\n"
            "1. 打开本 workflow 日志确认分类为空原因（配额 / 网络 / 解析）\n"
            "2. `workflow_dispatch` 重跑；视频可勾选 force\n"
            "3. 仍失败：按 `docs/OPS-RUNBOOK.md` 回滚上一好批次\n"
        )
    elif code == 1:
        append_summary("\n**有警告**：非阻断；关注 B 站短窗口或新闻条数偏低。\n")
    # 0=健康 1=有警告但仍成功 2=严重（workflow 可据此开 Issue）
    print(f"metrics_level={code}")
    return 0 if code < 2 else 1


if __name__ == "__main__":
    raise SystemExit(main())
