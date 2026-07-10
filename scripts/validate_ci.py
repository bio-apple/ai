#!/usr/bin/env python3
"""CI 校验：JSON Schema、sitemap/robots、HTML 内部链接。"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

import jsonschema
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]


def validate_daily_videos() -> None:
    schema = json.loads((ROOT / "schemas/daily-videos.schema.json").read_text())
    data = json.loads((ROOT / "daily-videos.json").read_text(encoding="utf-8"))
    jsonschema.validate(data, schema)
    for batch in data.get("batches", []):
        for v in batch.get("videos", []):
            summary = v.get("summary", "")
            if re.search(r"https?://", summary, re.I):
                raise ValueError(f"摘要含 URL: {v.get('id')} -> {summary[:80]}")
            if re.search(r"(?i)get chatgpt|bit\.ly|use code", summary):
                raise ValueError(f"摘要含广告残留: {v.get('id')}")
    print("✓ daily-videos.json schema + summary")


def validate_sitemap_robots() -> None:
    robots = (ROOT / "robots.txt").read_text(encoding="utf-8")
    sitemap = (ROOT / "sitemap.xml").read_text(encoding="utf-8")
    if "Sitemap:" not in robots:
        raise ValueError("robots.txt 缺少 Sitemap 声明")
    if "<urlset" not in sitemap or "<loc>" not in sitemap:
        raise ValueError("sitemap.xml 格式无效")
    if "https://bio-apple.github.io/ai/" not in sitemap:
        raise ValueError("sitemap 缺少首页 URL")
    print("✓ robots.txt + sitemap.xml")


def validate_search_index() -> None:
    data = json.loads((ROOT / "search-index.json").read_text(encoding="utf-8"))
    if not isinstance(data, list) or len(data) < 10:
        raise ValueError("search-index.json 条目过少")
    for item in data:
        if not item.get("label") or not item.get("keywords"):
            raise ValueError(f"search-index 条目不完整: {item}")
        if not item.get("section") and not item.get("url"):
            raise ValueError(f"search-index 缺少 section/url: {item}")
    print(f"✓ search-index.json ({len(data)} 条)")


def validate_html_links() -> None:
    html_files = [ROOT / "index.html", *ROOT.glob("tools/*.html"), *ROOT.glob("compare/*.html")]
    missing = []
    for fp in html_files:
        soup = BeautifulSoup(fp.read_text(encoding="utf-8"), "html.parser")
        for a in soup.select("a[href]"):
            href = a["href"].strip()
            if not href or href.startswith(("#", "http://", "https://", "mailto:")):
                continue
            if "#" in href:
                href = href.split("#", 1)[0]
                if not href:
                    continue
            target = (fp.parent / href).resolve()
            if href.startswith("/"):
                continue
            if not target.exists():
                missing.append(f"{fp.relative_to(ROOT)} -> {href}")
    if missing:
        raise ValueError("死链:\n" + "\n".join(missing[:20]))
    print(f"✓ HTML 链接检查 ({len(html_files)} 个文件)")


def validate_data_json() -> None:
    for name in ("site.json", "tools.json", "cases.json", "compares.json"):
        path = ROOT / "data" / name
        if not path.exists():
            raise FileNotFoundError(path)
        json.loads(path.read_text(encoding="utf-8"))
    print("✓ data/*.json 可解析")


def main() -> int:
    validate_data_json()
    validate_daily_videos()
    validate_sitemap_robots()
    validate_search_index()
    validate_html_links()
    print("全部 CI 校验通过")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"CI 校验失败: {exc}", file=sys.stderr)
        raise SystemExit(1)
