#!/usr/bin/env python3
"""检查构建产物与 data 中的外链可达性（HEAD/GET）。"""

from __future__ import annotations

import os
import re
import ssl
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BUILD = Path(os.environ.get("DIST", ROOT / "dist"))
SITE = BUILD if (BUILD / "index.html").exists() else ROOT
URL_RE = re.compile(r"https?://[^\s\"'<>]+")
SKIP_HOSTS = {"localhost", "127.0.0.1", "bio-apple.github.io"}
USER_AGENT = "BioAILab-LinkChecker/1.0 (+https://bio-apple.github.io/ai/)"
TIMEOUT = 12
MAX_URLS = 80


def collect_urls() -> set[str]:
    urls: set[str] = set()
    patterns = [
        SITE / "index.html",
        SITE / "ai-tools-ranking.html",
        *SITE.glob("tools/*.html"),
        *SITE.glob("compare/*.html"),
        ROOT / "data" / "compares.json",
        ROOT / "data" / "tools.json",
        SITE / "daily-videos.json",
        SITE / "ai-news.json",
    ]
    for path in patterns:
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        for raw in URL_RE.findall(text):
            url = raw.rstrip(".,);]")
            if any(host in url for host in SKIP_HOSTS):
                continue
            urls.add(url)
    return urls


def check_url(url: str) -> tuple[str, str | None]:
    ctx = ssl.create_default_context()
    headers = {"User-Agent": USER_AGENT}
    for method in ("HEAD", "GET"):
        try:
            req = urllib.request.Request(url, method=method, headers=headers)
            with urllib.request.urlopen(req, timeout=TIMEOUT, context=ctx) as resp:
                if 200 <= resp.status < 400:
                    return url, None
        except urllib.error.HTTPError as exc:
            if exc.code in (403, 405, 429, 999):
                return url, None
            if method == "HEAD":
                continue
            return url, f"HTTP {exc.code}"
        except Exception as exc:
            if method == "HEAD":
                continue
            return url, str(exc)[:120]
    return url, "unreachable"


def main() -> int:
    urls = sorted(collect_urls())
    if len(urls) > MAX_URLS:
        urls = urls[:MAX_URLS]
    if not urls:
        print("✓ 无外链需检测")
        return 0

    broken: list[str] = []
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(check_url, u): u for u in urls}
        for fut in as_completed(futures):
            url, err = fut.result()
            if err:
                broken.append(f"{url} -> {err}")

    if broken:
        print(f"发现 {len(broken)} 个可疑外链（共检测 {len(urls)} 个）:", file=sys.stderr)
        for line in broken[:25]:
            print(line, file=sys.stderr)
        return 1

    print(f"✓ 外链检测通过 ({len(urls)} 个)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
