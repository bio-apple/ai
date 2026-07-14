#!/usr/bin/env python3
"""把 Playwright JSON 结果写成 Actions annotations，方便未登录也能看到失败原因。"""
from __future__ import annotations

import json
import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: report_e2e_annotations.py <playwright-json>", file=sys.stderr)
        return 2
    path = Path(sys.argv[1])
    if not path.exists():
        print(f"::error::缺少 Playwright 结果文件 {path}")
        return 1
    data = json.loads(path.read_text(encoding="utf-8"))
    failed = 0
    for suite in data.get("suites") or []:
        failed += walk(suite)
    stats = data.get("stats") or {}
    unexpected = stats.get("unexpected", 0)
    if unexpected or failed:
        print(
            f"::error::E2E 失败 unexpected={unexpected} failed_specs≈{failed} "
            f"duration={stats.get('duration')}ms"
        )
        return 1
    print(f"E2E OK expected={stats.get('expected', 0)}")
    return 0


def walk(node: dict, title_prefix: str = "") -> int:
    failed = 0
    title = " › ".join(x for x in [title_prefix, node.get("title") or ""] if x)
    for spec in node.get("specs") or []:
        ok = spec.get("ok", True)
        name = f"{title} › {spec.get('title')}" if title else spec.get("title")
        file_ = (spec.get("file") or "tests/e2e/smoke.spec.js").replace("\\", "/")
        line = 1
        for t in spec.get("tests") or []:
            for r in t.get("results") or []:
                line = max(line, int((r.get("error") or {}).get("location", {}).get("line") or 1))
                err = r.get("error") or {}
                msg = (err.get("message") or err.get("stack") or "").strip()
                if r.get("status") in ("failed", "timedOut", "interrupted") or not ok:
                    failed += 1
                    # Actions annotation：单行
                    short = " ".join(msg.split())[:350] or "test failed"
                    print(f"::error file={file_},line={line}::{name} — {short}")
                    # Step Summary
                    summary = Path(os_environ_summary())
                    if summary:
                        with summary.open("a", encoding="utf-8") as fh:
                            fh.write(f"### ❌ {name}\n\n```\n{msg[:2000]}\n```\n\n")
                    break
    for child in node.get("suites") or []:
        failed += walk(child, title)
    return failed


def os_environ_summary() -> str:
    import os

    return os.environ.get("GITHUB_STEP_SUMMARY") or ""


if __name__ == "__main__":
    raise SystemExit(main())
