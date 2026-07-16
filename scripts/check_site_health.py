#!/usr/bin/env python3
"""线上 Pages 健康与内容新鲜度探针。失败时输出可执行修复步骤。"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone

SITE_BASE = os.environ.get("SITE_BASE", "https://bio-apple.github.io/ai").rstrip("/")
VIDEO_MAX_AGE_DAYS = int(os.environ.get("VIDEO_MAX_AGE_DAYS", "2"))
NEWS_MAX_AGE_DAYS = int(os.environ.get("NEWS_MAX_AGE_DAYS", "2"))
TIMEOUT = int(os.environ.get("PROBE_TIMEOUT", "20"))
REPO_ACTIONS = os.environ.get(
    "REPO_ACTIONS_URL",
    "https://github.com/bio-apple/ai/actions",
)


def fetch(url: str) -> tuple[int, bytes, dict]:
    req = urllib.request.Request(url, headers={"User-Agent": "bio-ai-lab-site-health/1.0"})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        return resp.status, resp.read(), dict(resp.headers)


def check_http(path: str, expect_substr: bytes | None = None) -> None:
    url = f"{SITE_BASE}{path}"
    status, body, _ = fetch(url)
    if status != 200:
        raise RuntimeError(f"HTTP:{path}:{status}")
    if expect_substr and expect_substr not in body:
        raise RuntimeError(f"CONTENT:{path}:missing expected marker")
    print(f"✓ {url} ({len(body)} bytes)")


def parse_iso(value: str) -> datetime:
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def age_days(dt: datetime) -> float:
    return (datetime.now(timezone.utc) - dt).total_seconds() / 86400


def check_json_freshness(path: str, date_keys: list[str], max_age_days: int, label: str) -> None:
    url = f"{SITE_BASE}{path}"
    status, body, _ = fetch(url)
    if status != 200:
        raise RuntimeError(f"HTTP:{path}:{status}")
    data = json.loads(body.decode("utf-8"))
    stamp = None
    for key in date_keys:
        if key == "batches.0.date" and data.get("batches"):
            stamp = data["batches"][0].get("date")
            if stamp:
                stamp = f"{stamp}T00:00:00+08:00"
            break
        if key in data and data[key]:
            stamp = data[key]
            break
    if not stamp:
        raise RuntimeError(f"STAMP:{label}:missing date fields {date_keys}")
    try:
        dt = parse_iso(stamp)
    except ValueError:
        dt = datetime.fromisoformat(f"{stamp}T00:00:00+00:00")
    days = age_days(dt)
    print(f"✓ {label} updated≈{stamp} ({days:.1f}d ago)")
    if days > max_age_days:
        raise RuntimeError(f"STALE:{label}:{days:.1f}d>{max_age_days}d:{stamp}")


def remediation_for(exc: BaseException) -> list[str]:
    msg = str(exc)
    lines = [
        "## 建议处置（可复制）",
        "",
        f"- Actions: {REPO_ACTIONS}",
        "- Runbook: `docs/OPS-RUNBOOK.md`",
        "",
    ]
    if msg.startswith("HTTP:") or "URLError" in type(exc).__name__:
        lines += [
            "### P0 · 页面/资源不可达",
            "1. 打开 Pages 部署：Actions → Pages / CI 最近一次是否成功",
            "2. 本地复核：`ASTRO_TELEMETRY_DISABLED=1 npm run build && DIST=dist python3 scripts/validate_ci.py`",
            "3. 若仅为缓存，等待数分钟后重跑 `Site Health Probe`",
            "",
        ]
    elif msg.startswith("STALE:daily-videos") or "daily-videos" in msg and "STALE" in msg:
        lines += [
            "### P1 · 视频过期",
            f"1. 手动重跑：{REPO_ACTIONS}/workflows/daily-videos.yml → Run workflow（可勾选 force）",
            "2. 确认 commit 含 `daily-videos.json` 与 `video-thumbs/`",
            "3. 仍失败则按 runbook 回滚到上一好批次",
            "",
        ]
    elif msg.startswith("STALE:ai-news") or ("ai-news" in msg and "STALE" in msg):
        lines += [
            "### P1 · 新闻过期",
            f"1. 手动重跑：{REPO_ACTIONS}/workflows/daily-news.yml → Run workflow",
            "2. 检查 `ai-news.json` / `content/news/daily-ai-news.md` 是否写入",
            "3. 必要时回滚新闻 JSON",
            "",
        ]
    elif msg.startswith("CONTENT:"):
        lines += [
            "### P0 · 页面内容异常",
            "1. 打开对应 URL 人工确认是否仍在部署旧版",
            "2. 核对最近 merge 是否改坏了标题/关键文案",
            "3. `git revert` 可疑提交或热修后重新 Pages",
            "",
        ]
    else:
        lines += [
            "### 通用",
            "1. 打开失败的 workflow run 日志",
            "2. 对照 `docs/OPS-RUNBOOK.md` 告警分级表",
            "3. 修复后手动 `workflow_dispatch` 复检",
            "",
        ]
    return lines


def write_summary(text: str) -> None:
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not path:
        return
    with open(path, "a", encoding="utf-8") as fh:
        fh.write("### Site health\n\n")
        fh.write(text.rstrip() + "\n")


def emit_outputs(*, fail_code: str = "", remediation: str = "") -> None:
    out = os.environ.get("GITHUB_OUTPUT")
    if not out:
        return
    with open(out, "a", encoding="utf-8") as fh:
        if remediation:
            fh.write("remediation<<EOF\n")
            fh.write(remediation)
            fh.write("\nEOF\n")
        if fail_code:
            safe = fail_code.replace("\n", " ").replace("%", "")[:200]
            fh.write(f"fail_code={safe}\n")


def main() -> int:
    notes: list[str] = []
    try:
        check_http("/", expect_substr=b"Bio AI Lab")
        notes.append("- index OK")
        check_http("/style.css")
        notes.append("- style.css OK")
        check_http("/index.html", expect_substr=b"html")
        notes.append("- index.html OK")
        check_http("/tools/hub.html", expect_substr=b"工具中心")
        notes.append("- tools hub OK")
        check_http("/labs/index.html", expect_substr=b"AI Labs")
        notes.append("- labs OK")
        check_http("/recommend-rules.json", expect_substr=b"schema_version")
        notes.append("- recommend-rules OK")
        check_json_freshness(
            "/daily-videos.json",
            ["updated_at", "batches.0.date"],
            VIDEO_MAX_AGE_DAYS,
            "daily-videos",
        )
        notes.append(f"- videos fresh ≤{VIDEO_MAX_AGE_DAYS}d")
        check_json_freshness(
            "/ai-news.json",
            ["updated_at", "date"],
            NEWS_MAX_AGE_DAYS,
            "ai-news",
        )
        notes.append(f"- news fresh ≤{NEWS_MAX_AGE_DAYS}d")
        write_summary("\n".join(notes))
        print("全部健康检查通过")
        return 0
    except (RuntimeError, urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        rem = remediation_for(exc)
        rem_text = "\n".join(rem)
        notes.append(f"- FAIL: `{exc}`")
        write_summary("\n".join(notes) + "\n\n" + rem_text)
        print(f"健康检查失败: {exc}", file=sys.stderr)
        print(rem_text, file=sys.stderr)
        emit_outputs(fail_code=str(exc), remediation=rem_text)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
