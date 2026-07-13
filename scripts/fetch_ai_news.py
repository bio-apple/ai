#!/usr/bin/env python3
"""从 RSS / 官方页面 / GitHub API 抓取 AI 新闻，写入 ai-news.json 与 content/news/daily-ai-news.md。"""

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
from urllib.parse import urljoin
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


def fetch_bytes(url: str, retries: int = 3) -> bytes | None:
    last_err: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            req = Request(url, headers={"User-Agent": USER_AGENT})
            with urlopen(req, timeout=25, context=ssl_context()) as resp:
                return resp.read()
        except Exception as urllib_err:
            last_err = urllib_err
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
                    timeout=30,
                )
                if proc.returncode == 0 and proc.stdout:
                    return proc.stdout
            except Exception as curl_err:
                last_err = curl_err
            if attempt < retries:
                continue
    if last_err:
        print(f"fetch failed ({retries}x): {url} → {last_err}", file=sys.stderr)
    return None


def fetch_text(url: str) -> str | None:
    raw = fetch_bytes(url)
    if raw is None:
        return None
    return raw.decode("utf-8", errors="replace")


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


def slug_to_title(slug: str) -> str:
    slug = slug.strip("/").split("/")[-1]
    return re.sub(r"[-_]+", " ", slug).strip().title()


def decode_js_string(raw: str) -> str:
    def repl(match: re.Match[str]) -> str:
        return chr(int(match.group(1), 16))

    text = re.sub(r"\\u([0-9a-fA-F]{4})", repl, raw)
    return text.replace("\\/", "/").replace('\\"', '"').replace("\\n", "\n")


def parse_js_nuxt_var_map(html: str) -> dict[str, str]:
    start = html.find("window.__NUXT__=")
    if start < 0:
        return {}
    chunk = html[start : start + 120000]
    sig = re.search(r"function\(([^)]*)\)\{return", chunk)
    args = re.search(r"\}\)\((.*)\)\);</script>", chunk, re.S)
    if not sig or not args:
        return {}
    names = [n.strip() for n in sig.group(1).split(",") if n.strip()]
    values = _split_js_args(args.group(1))
    return {name: value for name, value in zip(names, values) if isinstance(value, str)}


def _split_js_args(raw: str) -> list[Any]:
    values: list[Any] = []
    i = 0
    n = len(raw)
    while i < n:
        while i < n and raw[i] in " \t\n\r,":
            i += 1
        if i >= n:
            break
        ch = raw[i]
        if ch == '"':
            i += 1
            buf: list[str] = []
            while i < n:
                c = raw[i]
                if c == "\\" and i + 1 < n:
                    buf.append(raw[i : i + 2])
                    i += 2
                    continue
                if c == '"':
                    i += 1
                    break
                buf.append(c)
                i += 1
            values.append(decode_js_string("".join(buf)))
            continue
        if ch in "-0123456789":
            j = i
            while j < n and raw[j] not in ",)":
                j += 1
            token = raw[i:j].strip()
            values.append(int(token) if token.isdigit() else token)
            i = j
            continue
        j = i
        while j < n and raw[j] not in ",)":
            j += 1
        token = raw[i:j].strip()
        if token == "true":
            values.append(True)
        elif token == "false":
            values.append(False)
        elif token in ("null", "void", "0") or token.startswith("void"):
            values.append(None)
        else:
            values.append(token)
        i = j
    return values


def parse_nuxt_hub_feed(feed_cfg: dict, cfg: dict) -> list[dict]:
    html = fetch_text(feed_cfg["url"])
    if not html:
        return []

    var_map = parse_js_nuxt_var_map(html)
    max_items = feed_cfg.get("max_items", cfg.get("max_per_feed", 5))
    items: list[dict] = []
    start = html.find("window.__NUXT__=")
    if start < 0:
        return []
    chunk = html[start : start + 120000]
    for block in re.split(r"\{story_info:\{", chunk)[1:]:
        title_m = re.search(r'title:"((?:\\.|[^"\\])*)"', block)
        url_m = re.search(r'url:"((?:\\.|[^"\\])*)"', block)
        summary_m = re.search(r'summary:"((?:\\.|[^"\\])*)"', block)
        user_m = re.search(r"story_show_user_name:([^,}]+)", block)
        created_m = re.search(r"created_at:([^,}]+)", block)
        if not title_m or not url_m:
            continue
        title = decode_js_string(title_m.group(1))
        link = decode_js_string(url_m.group(1))
        summary = decode_js_string(summary_m.group(1)) if summary_m else title
        smax = cfg.get("summary_max_length", 160)
        if len(summary) > smax:
            summary = summary[: smax - 1] + "…"

        source = feed_cfg["source"]
        if user_m:
            raw_user = user_m.group(1).strip()
            if raw_user.startswith('"'):
                source = decode_js_string(raw_user.strip('"'))
            elif len(raw_user) == 1 and raw_user in var_map:
                source = var_map[raw_user]
        content_m = re.search(r'content:"((?:\\.|[^"\\])*)"', block)
        if content_m:
            content = decode_js_string(content_m.group(1))
            for name in ("新智元", "机器之心", "量子位"):
                if name in content:
                    source = name
                    break

        published = None
        if created_m:
            raw_created = created_m.group(1).strip()
            if raw_created.startswith('"'):
                published = decode_js_string(raw_created.strip('"'))
            elif len(raw_created) == 1 and raw_created in var_map:
                published = var_map[raw_created]

        items.append(
            {
                "id": item_id(link),
                "title": title,
                "summary": summary,
                "url": link,
                "source": source,
                "category": feed_cfg.get("category", "中文资讯"),
                "published_at": published,
            }
        )
        if len(items) >= max_items:
            break
    return items


def fetch_og_title(url: str) -> str | None:
    html = fetch_text(url)
    if not html:
        return None
    match = re.search(r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)', html, re.I)
    if not match:
        match = re.search(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:title', html, re.I)
    if match:
        return strip_html(match.group(1))
    title_match = re.search(r"<title>([^<]+)</title>", html, re.I)
    if title_match:
        return strip_html(title_match.group(1))
    return None


def parse_html_links_feed(feed_cfg: dict, cfg: dict) -> list[dict]:
    html = fetch_text(feed_cfg["url"])
    if not html:
        return []

    pattern = feed_cfg.get("link_pattern", r'href="(/news/[a-z0-9-]+)"')
    base_url = feed_cfg.get("base_url", feed_cfg["url"])
    max_items = feed_cfg.get("max_items", cfg.get("max_per_feed", 5))
    seen: set[str] = set()
    items: list[dict] = []

    for match in re.finditer(pattern, html):
        path = match.group(1)
        if path in seen:
            continue
        seen.add(path)
        link = urljoin(base_url, path)
        title = fetch_og_title(link) or slug_to_title(path)
        summary = title
        smax = cfg.get("summary_max_length", 160)
        if len(summary) > smax:
            summary = summary[: smax - 1] + "…"
        items.append(
            {
                "id": item_id(link),
                "title": title,
                "summary": summary,
                "url": link,
                "source": feed_cfg["source"],
                "category": feed_cfg.get("category", "行业新闻"),
                "published_at": None,
            }
        )
        if len(items) >= max_items:
            break
    return items


def parse_github_trending(cfg: dict) -> list[dict]:
    trending_cfg = cfg.get("github_trending") or {}
    if not trending_cfg.get("enabled"):
        return []

    query = trending_cfg.get("query", "topic:artificial-intelligence stars:>500")
    sort = trending_cfg.get("sort", "stars")
    per_page = trending_cfg.get("per_page", 6)
    source = trending_cfg.get("source", "GitHub Trending")
    category = trending_cfg.get("category", "开源项目")
    url = (
        "https://api.github.com/search/repositories?"
        f"q={urllib_parse_quote(query)}&sort={sort}&order=desc&per_page={per_page}"
    )

    raw = fetch_bytes(url)
    if raw is None:
        return []

    try:
        payload = json.loads(raw.decode())
    except json.JSONDecodeError:
        return []

    items: list[dict] = []
    for repo in payload.get("items", []):
        full_name = repo.get("full_name") or ""
        link = repo.get("html_url") or f"https://github.com/{full_name}"
        stars = repo.get("stargazers_count", 0)
        description = strip_html(repo.get("description") or full_name)
        smax = cfg.get("summary_max_length", 160)
        if len(description) > smax:
            description = description[: smax - 1] + "…"
        pushed = repo.get("pushed_at")
        items.append(
            {
                "id": item_id(link),
                "title": f"{full_name} · ★ {stars:,}",
                "summary": description or full_name,
                "url": link,
                "source": source,
                "category": category,
                "published_at": pushed,
            }
        )
    return items


def urllib_parse_quote(text: str) -> str:
    from urllib.parse import quote

    return quote(text, safe=":>+")


def parse_feed(feed_cfg: dict, cfg: dict) -> list[dict]:
    feed_type = feed_cfg.get("type", "rss")
    if feed_type == "html_links":
        return parse_html_links_feed(feed_cfg, cfg)
    if feed_type == "nuxt_hub":
        return parse_nuxt_hub_feed(feed_cfg, cfg)

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
            dt = datetime.fromisoformat(pub.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=TZ)
            if dt.astimezone(TZ) >= cutoff:
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


def select_diverse_items(items: list[dict], cfg: dict) -> list[dict]:
    max_items = cfg.get("max_items", 40)
    min_per_source = cfg.get("min_per_source", 1)
    by_source: dict[str, list[dict]] = {}
    for item in items:
        by_source.setdefault(item["source"], []).append(item)
    for src_items in by_source.values():
        src_items.sort(key=lambda x: x.get("published_at") or "", reverse=True)

    picked: list[dict] = []
    seen: set[str] = set()
    for src in sorted(by_source):
        for item in by_source[src][:min_per_source]:
            if item["url"] in seen:
                continue
            picked.append(item)
            seen.add(item["url"])

    for item in sorted(items, key=lambda x: x.get("published_at") or "", reverse=True):
        if len(picked) >= max_items:
            break
        if item["url"] in seen:
            continue
        picked.append(item)
        seen.add(item["url"])
    return picked[:max_items]


def write_markdown(items: list[dict], today: str) -> None:
    MD_FILE.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        f"# 本周 AI 热点 — {today}",
        "",
        "> 每周汇总 OpenAI、Anthropic、Google DeepMind、NVIDIA、Microsoft、arXiv、GitHub Trending 与中文 AI 媒体动态。",
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

    collected.extend(parse_github_trending(cfg))

    recent = filter_recent(collected, cfg)
    items = select_diverse_items(dedupe_sort(recent), cfg)
    if not items:
        print("未抓取到 AI 新闻", file=sys.stderr)
        return 1

    today = datetime.now(TZ).strftime("%Y-%m-%d")
    payload = {
        "updated_at": datetime.now(TZ).isoformat(),
        "date": today,
        "cadence": "weekly",
        "items": items,
        "watch_sources": cfg.get("watch_sources", []),
    }
    DATA_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_markdown(items, today)
    print(f"✓ ai-news.json ({len(items)} 条) → {DATA_FILE}")
    print(f"✓ {MD_FILE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
