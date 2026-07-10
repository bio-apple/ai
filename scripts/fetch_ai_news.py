#!/usr/bin/env python3
"""从官方 RSS 抓取 AI 新闻，写入 ai-news.json 与 content/news/daily-ai-news.md。"""

from __future__ import annotations

import hashlib
import json
import re
import ssl
import subprocess
import sys
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any
from urllib.request import Request, urlopen

import yaml

ROOT = Path(__file__).resolve().parents[1]
CONFIG_FILE = ROOT / "config" / "news-fetch.yaml"
DATA_FILE = ROOT / "ai-news.json"
MD_FILE = ROOT / "content" / "news" / "daily-ai-news.md"
TZ = timezone(timedelta(hours=8))
USER_AGENT = "BioAI-Lab-NewsBot/1.0"


def ssl_context() -> ssl.SSLContext:
    try:
        import certifi

        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


def fetch_bytes(url: str) -> bytes | None:
    try:
        req = Request(url, headers={"User-Agent": USER_AGENT})
        with urlopen(req, timeout=25, context=ssl_context()) as resp:
            return resp.read()
    except Exception as urllib_err:
        try:
            proc = subprocess.run(
                [
                    "curl",
                    "-sL",
                    "--max-time",
                    "25",
                    "-A",
                    USER_AGENT,
                    url,
                ],
                capture_output=True,
                check=True,
            )
            if proc.stdout:
                return proc.stdout
        except Exception as curl_err:
            print(f"feed skip [{url}]: {urllib_err}; curl: {curl_err}", file=sys.stderr)
            return None
    return None


def load_config() -> dict[str, Any]:
    return yaml.safe_load(CONFIG_FILE.read_text(encoding="utf-8"))


def fetch_xml(url: str) -> ET.Element | None:
    raw = fetch_bytes(url)
    if raw is None:
        return None
    try:
        return ET.fromstring(raw)
    except ET.ParseError as exc:
        print(f"feed parse error [{url}]: {exc}", file=sys.stderr)
        return None


def parse_rss_date(raw: str | None) -> datetime | None:
    if not raw:
        return None
    try:
        dt = parsedate_to_datetime(raw.strip())
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(TZ)
    except Exception:
        return None


def strip_html(text: str) -> str:
    text = re.sub(r"<[^>]+>", "", text or "")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def classify_item(title: str, summary: str, cfg: dict, default: str) -> str:
    blob = f"{title} {summary}".lower()
    for label, pattern in (cfg.get("category_keywords") or {}).items():
        if re.search(pattern, blob, re.I):
            return label
    return default


def item_id(url: str) -> str:
    return hashlib.sha1(url.encode()).hexdigest()[:12]


def parse_feed(feed_cfg: dict, cfg: dict) -> list[dict]:
    root = fetch_xml(feed_cfg["url"])
    if root is None:
        return []

    nodes = root.findall(".//item")
    if not nodes:
        ns = {"atom": "http://www.w3.org/2005/Atom"}
        nodes = root.findall(".//atom:entry", ns)

    items: list[dict] = []
    for node in nodes:
        title = strip_html(node.findtext("title") or "")
        link = (node.findtext("link") or "").strip()
        if not link:
            link_el = node.find("link")
            if link_el is not None:
                link = (link_el.get("href") or "").strip()
        if not title or not link:
            continue
        summary = strip_html(
            node.findtext("description")
            or node.findtext("summary")
            or node.findtext("{http://purl.org/rss/1.0/modules/content/}encoded")
            or ""
        )
        published = parse_rss_date(
            node.findtext("pubDate")
            or node.findtext("published")
            or node.findtext("{http://www.w3.org/2005/Atom}updated")
        )
        category = classify_item(title, summary, cfg, feed_cfg.get("category", "行业新闻"))
        smax = cfg.get("summary_max_length", 160)
        if len(summary) > smax:
            summary = summary[: smax - 1] + "…"
        if not summary:
            summary = title[:smax]
        items.append(
            {
                "id": item_id(link),
                "title": title,
                "summary": summary,
                "url": link,
                "source": feed_cfg["source"],
                "category": category,
                "published_at": published.isoformat() if published else None,
            }
        )
    return items


def filter_recent(items: list[dict], cfg: dict) -> list[dict]:
    max_age = timedelta(days=cfg.get("max_age_days", 14))
    cutoff = datetime.now(TZ) - max_age
    kept: list[dict] = []
    for item in items:
        pub = item.get("published_at")
        if not pub:
            kept.append(item)
            continue
        try:
            dt = datetime.fromisoformat(pub)
            if dt >= cutoff:
                kept.append(item)
        except ValueError:
            kept.append(item)
    return kept


def dedupe_sort(items: list[dict]) -> list[dict]:
    seen: set[str] = set()
    unique: list[dict] = []
    for item in sorted(
        items,
        key=lambda x: x.get("published_at") or "",
        reverse=True,
    ):
        if item["url"] in seen:
            continue
        seen.add(item["url"])
        unique.append(item)
    return unique


def write_markdown(items: list[dict], today: str) -> None:
    MD_FILE.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        f"# 今日 AI 热点 — {today}",
        "",
        "> 自动汇总 OpenAI、Anthropic、Google DeepMind、Hugging Face 等官方动态。",
        "",
    ]
    for i, item in enumerate(items[:12], 1):
        lines.append(f"## {i}. {item['title']}")
        lines.append("")
        lines.append(f"- **来源**：{item['source']}")
        lines.append(f"- **分类**：{item['category']}")
        if item.get("published_at"):
            lines.append(f"- **时间**：{item['published_at']}")
        lines.append(f"- **链接**：{item['url']}")
        lines.append("")
        lines.append(item["summary"])
        lines.append("")
    MD_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    cfg = load_config()
    collected: list[dict] = []
    for feed in cfg.get("feeds", []):
        parsed = parse_feed(feed, cfg)
        collected.extend(parsed[: cfg.get("max_per_feed", 6)])

    items = dedupe_sort(filter_recent(collected, cfg))[: cfg.get("max_items", 24)]
    if not items:
        print("未抓取到 AI 新闻", file=sys.stderr)
        return 1

    today = datetime.now(TZ).strftime("%Y-%m-%d")
    payload = {
        "updated_at": datetime.now(TZ).isoformat(),
        "date": today,
        "items": items,
    }
    DATA_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_markdown(items, today)
    print(f"✓ ai-news.json ({len(items)} 条) → {DATA_FILE}")
    print(f"✓ {MD_FILE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
