#!/usr/bin/env python3
"""线上 Pages 健康与内容新鲜度探针。"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

SITE_BASE = os.environ.get("SITE_BASE", "https://bio-apple.github.io/ai").rstrip("/")
VIDEO_MAX_AGE_DAYS = int(os.environ.get("VIDEO_MAX_AGE_DAYS", "2"))
NEWS_MAX_AGE_DAYS = int(os.environ.get("NEWS_MAX_AGE_DAYS", "10"))
TIMEOUT = int(os.environ.get("PROBE_TIMEOUT", "20"))


def fetch(url: str) -> tuple[int, bytes, dict]:
    req = urllib.request.Request(url, headers={"User-Agent": "bio-ai-lab-site-health/1.0"})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        return resp.status, resp.read(), dict(resp.headers)


def check_http(path: str, expect_substr: bytes | None = None) -> None:
    url = f"{SITE_BASE}{path}"
    status, body, _ = fetch(url)
    if status != 200:
        raise RuntimeError(f"{url} → HTTP {status}")
    if expect_substr and expect_substr not in body:
        raise RuntimeError(f"{url} 缺少期望内容: {expect_substr!r}")
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
        raise RuntimeError(f"{url} → HTTP {status}")
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
        raise RuntimeError(f"{label}: 缺少时间字段 {date_keys}")
    try:
        dt = parse_iso(stamp)
    except ValueError:
        # YYYY-MM-DD
        dt = datetime.fromisoformat(f"{stamp}T00:00:00+00:00")
    days = age_days(dt)
    print(f"✓ {label} updated≈{stamp} ({days:.1f}d ago)")
    if days > max_age_days:
        raise RuntimeError(f"{label} 过期：{days:.1f} 天 > {max_age_days} 天阈值（{stamp}）")


def write_summary(lines: list[str]) -> None:
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not path:
        return
    with open(path, "a", encoding="utf-8") as fh:
        fh.write("### Site health\n\n")
        for line in lines:
            fh.write(f"- {line}\n")


def main() -> int:
    notes: list[str] = []
    try:
        check_http("/", expect_substr=b"Bio AI Lab")
        notes.append("index OK")
        check_http("/style.css")
        notes.append("style.css OK")
        check_http("/index.html", expect_substr=b"html")
        notes.append("index.html OK")
        check_json_freshness(
            "/daily-videos.json",
            ["updated_at", "batches.0.date"],
            VIDEO_MAX_AGE_DAYS,
            "daily-videos",
        )
        notes.append(f"videos fresh ≤{VIDEO_MAX_AGE_DAYS}d")
        check_json_freshness(
            "/ai-news.json",
            ["updated_at", "date"],
            NEWS_MAX_AGE_DAYS,
            "ai-news",
        )
        notes.append(f"news fresh ≤{NEWS_MAX_AGE_DAYS}d")
        write_summary(notes)
        print("全部健康检查通过")
        return 0
    except (RuntimeError, urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
        notes.append(f"FAIL: {exc}")
        write_summary(notes)
        print(f"健康检查失败: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
