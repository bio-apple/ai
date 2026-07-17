#!/usr/bin/env python3
"""抓取近半年上线的 AI 在线课程，写入 ai-courses.json。"""

from __future__ import annotations

import hashlib
import json
import os
import re
import ssl
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from html import unescape
from pathlib import Path
from typing import Any
from urllib.parse import quote, urljoin
from urllib.request import Request, urlopen
from xml.etree import ElementTree as ET

import yaml

ROOT = Path(__file__).resolve().parents[1]
CONFIG_FILE = ROOT / "config" / "courses-fetch.yaml"
DATA_FILE = ROOT / "ai-courses.json"
TZ = timezone(timedelta(hours=8))
USER_AGENT = "BioAI-Lab-CoursesBot/1.0"
ATOM_NS = {
    "a": "http://www.w3.org/2005/Atom",
}


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
            req = Request(
                url,
                headers={
                    "User-Agent": USER_AGENT,
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                },
            )
            with urlopen(req, timeout=30, context=ssl_context()) as resp:
                return resp.read()
        except Exception as urllib_err:  # noqa: BLE001
            last_err = urllib_err
            try:
                proc = subprocess.run(
                    ["curl", "-sL", "--max-time", "30", "-A", USER_AGENT, url],
                    capture_output=True,
                    timeout=35,
                )
                if proc.returncode == 0 and proc.stdout:
                    return proc.stdout
            except Exception as curl_err:  # noqa: BLE001
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


def now_local() -> datetime:
    return datetime.now(TZ)


def parse_iso_date(raw: str | None) -> datetime | None:
    if not raw:
        return None
    text = str(raw).strip()
    try:
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", text):
            return datetime(int(text[:4]), int(text[5:7]), int(text[8:10]), tzinfo=TZ)
        dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(TZ)
    except ValueError:
        return None


def make_id(platform: str, url: str) -> str:
    digest = hashlib.sha1(f"{platform}|{url}".encode("utf-8")).hexdigest()[:12]
    return f"{re.sub(r'[^a-z0-9]+', '-', platform.lower()).strip('-')}-{digest}"


def decode_js_str(value: str) -> str:
    text = value.replace("\\u0026", "&").replace("\\/", "/")
    try:
        return json.loads(f'"{text}"')
    except json.JSONDecodeError:
        return unescape(text)


def classify_category(title: str, summary: str, keywords: dict[str, str], fallback: str) -> str:
    blob = f"{title}\n{summary}".lower()
    for cat, pattern in (keywords or {}).items():
        try:
            if re.search(pattern, blob, re.I):
                return cat
        except re.error:
            continue
    return fallback


def fetch_deeplearning_ai(cfg: dict[str, Any], cutoff: datetime, keywords: dict[str, str]) -> list[dict]:
    if not cfg.get("enabled", True):
        return []
    html = fetch_text(cfg["url"])
    if not html:
        return []
    pat = re.compile(
        r'slug\\":\\"([a-z0-9-]+)\\",\\"name\\":\\"(.*?)\\",\\"type\\":\\"short_course\\",'
        r'\\"maintenanceMode\\":(?:true|false),\\"comingSoon\\":(?:true|false),'
        r'\\"releasedAt\\":\\"(20\d{2}-\d{2}-\d{2}T[^\\"]*)\\"',
        re.S,
    )
    base = cfg.get("base_url") or "https://www.deeplearning.ai/courses/"
    source = cfg.get("source") or "DeepLearning.AI"
    fallback_cat = cfg.get("category") or "短课程"
    items: list[dict] = []
    seen: set[str] = set()
    for slug, name_raw, released in pat.findall(html):
        if slug in seen:
            continue
        seen.add(slug)
        published = parse_iso_date(released)
        if not published or published < cutoff:
            continue
        name = decode_js_str(name_raw).strip()
        url = urljoin(base if base.endswith("/") else base + "/", slug)
        # pull nearby description if present
        summary = ""
        desc_m = re.search(
            rf'\\"description\\":\\"(.*?)\\",\\"slug\\":\\"{re.escape(slug)}\\"',
            html,
            re.S,
        )
        if desc_m:
            summary = decode_js_str(desc_m.group(1)).strip()
        items.append(
            {
                "id": make_id(source, url),
                "title": name,
                "url": url,
                "summary": summary[:200],
                "platform": source,
                "category": classify_category(name, summary, keywords, fallback_cat),
                "format": "短课程",
                "published_at": published.strftime("%Y-%m-%d"),
                "language": "en",
            }
        )
    print(f"  · DeepLearning.AI: {len(items)}")
    return items


def fetch_coursera(cfg: dict[str, Any], cutoff: datetime, keywords: dict[str, str]) -> list[dict]:
    if not cfg.get("enabled", True):
        return []
    base = cfg.get("base_url") or "https://www.coursera.org"
    source = cfg.get("source") or "Coursera"
    fallback_cat = cfg.get("category") or "MOOC"
    max_per = int(cfg.get("max_per_query") or 10)
    today = now_local().strftime("%Y-%m-%d")
    items: list[dict] = []
    seen: set[str] = set()
    for query in cfg.get("queries") or []:
        url = (
            f"{base}/courses?query={quote(query)}&sortBy=NEW"
        )
        html = fetch_text(url)
        if not html:
            continue
        m = re.search(
            r"window\.__APOLLO_STATE__\s*=\s*(\{.*?\})\s*(?:;|\n|</script>)",
            html,
            re.S,
        )
        if not m:
            print(f"  · Coursera warn: no Apollo state for q={query}", file=sys.stderr)
            continue
        try:
            state = json.loads(m.group(1))
        except json.JSONDecodeError as exc:
            print(f"  · Coursera warn: JSON {exc}", file=sys.stderr)
            continue
        hits = [
            v
            for v in state.values()
            if isinstance(v, dict)
            and v.get("__typename") == "Search_ProductHit"
            and v.get("productType") == "COURSE"
        ]
        n = 0
        for hit in hits:
            path = str(hit.get("url") or "").strip()
            title = str(hit.get("name") or "").strip()
            if not path or not title:
                continue
            full = urljoin(base + "/", path.lstrip("/"))
            if full in seen:
                continue
            # NEW 排序下优先 isNewContent；无日期时用抓取日（仅新内容）
            if not hit.get("isNewContent"):
                continue
            seen.add(full)
            partners = hit.get("partners") or []
            partner = partners[0] if partners else ""
            summary = str(hit.get("tagline") or partner or "").strip()
            level = str(hit.get("productDifficultyLevel") or "").replace("_", " ").title()
            if level:
                summary = f"{summary} · {level}".strip(" ·")
            items.append(
                {
                    "id": make_id(source, full),
                    "title": title,
                    "url": full,
                    "summary": summary[:200],
                    "platform": source,
                    "category": classify_category(title, summary, keywords, fallback_cat),
                    "format": "MOOC",
                    "published_at": today,
                    "language": "en",
                    "is_new": True,
                }
            )
            n += 1
            if n >= max_per:
                break
        print(f"  · Coursera q={query!r}: +{n}")
    # cutoff unused for Coursera new-only, but keep signature consistent
    _ = cutoff
    return items


def github_repo_pushed_at(repo: str) -> datetime | None:
    api = f"https://api.github.com/repos/{repo}"
    token = (os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN") or "").strip()
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/vnd.github+json",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        req = Request(api, headers=headers)
        with urlopen(req, timeout=20, context=ssl_context()) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as exc:  # noqa: BLE001
        print(f"  · GitHub API warn: {repo} → {exc}", file=sys.stderr)
        return None
    return parse_iso_date(data.get("pushed_at") or data.get("updated_at"))


def fetch_huggingface(cfg: dict[str, Any], cutoff: datetime, keywords: dict[str, str]) -> list[dict]:
    if not cfg.get("enabled", True):
        return []
    source = cfg.get("source") or "Hugging Face"
    fallback_cat = cfg.get("category") or "开源课程"
    items: list[dict] = []
    for course in cfg.get("courses") or []:
        url = course.get("url")
        name = course.get("name") or course.get("id")
        if not url or not name:
            continue
        published = github_repo_pushed_at(course["repo"]) if course.get("repo") else None
        if not published:
            # 页面可达则保留，日期取抓取日（仅当 hub 列表仍挂着）
            hub_html = fetch_text(cfg.get("hub") or "https://huggingface.co/learn") or ""
            if course.get("id") and course["id"] not in hub_html and url not in hub_html:
                continue
            published = now_local()
        if published < cutoff:
            continue
        summary = f"Hugging Face Learn · {course.get('id')}"
        items.append(
            {
                "id": make_id(source, url),
                "title": name,
                "url": url,
                "summary": summary,
                "platform": source,
                "category": classify_category(name, summary, keywords, fallback_cat),
                "format": "开源课程",
                "published_at": published.strftime("%Y-%m-%d"),
                "language": "en",
            }
        )
    print(f"  · Hugging Face Learn: {len(items)}")
    return items


def fetch_youtube_courses(cfg: dict[str, Any], cutoff: datetime, keywords: dict[str, str]) -> list[dict]:
    if not cfg.get("enabled", True):
        return []
    pattern = cfg.get("title_pattern") or "course"
    try:
        title_re = re.compile(pattern, re.I)
    except re.error:
        title_re = re.compile(r"course", re.I)
    fallback_cat = cfg.get("category") or "视频课程"
    items: list[dict] = []
    for ch in cfg.get("channels") or []:
        cid = ch.get("channel_id")
        if not cid:
            continue
        feed = f"https://www.youtube.com/feeds/videos.xml?channel_id={cid}"
        raw = fetch_bytes(feed)
        if not raw:
            if ch.get("optional"):
                continue
            print(f"  · YouTube warn: {ch.get('name')} feed failed", file=sys.stderr)
            continue
        try:
            root = ET.fromstring(raw)
        except ET.ParseError as exc:
            print(f"  · YouTube parse error: {exc}", file=sys.stderr)
            continue
        source = ch.get("source") or ch.get("name") or "YouTube"
        n = 0
        for entry in root.findall("a:entry", ATOM_NS):
            title = (entry.findtext("a:title", default="", namespaces=ATOM_NS) or "").strip()
            if not title_re.search(title):
                continue
            published = parse_iso_date(entry.findtext("a:published", default="", namespaces=ATOM_NS))
            if not published or published < cutoff:
                continue
            link_el = entry.find("a:link", ATOM_NS)
            href = link_el.get("href") if link_el is not None else ""
            if not href:
                continue
            summary = f"{ch.get('name') or source} · YouTube 完整课程向视频"
            items.append(
                {
                    "id": make_id(source, href),
                    "title": unescape(title),
                    "url": href,
                    "summary": summary,
                    "platform": source,
                    "category": classify_category(title, summary, keywords, fallback_cat),
                    "format": "视频课程",
                    "published_at": published.strftime("%Y-%m-%d"),
                    "language": "en",
                }
            )
            n += 1
        print(f"  · YouTube {ch.get('name')}: +{n}")
    return items


def dedupe_courses(items: list[dict]) -> list[dict]:
    sorted_items = sorted(
        items,
        key=lambda x: (x.get("published_at") or "", x.get("title") or ""),
        reverse=True,
    )
    seen_url: set[str] = set()
    seen_title: set[str] = set()
    out: list[dict] = []
    for item in sorted_items:
        url = str(item.get("url") or "").strip().rstrip("/")
        title_key = re.sub(r"\s+", " ", str(item.get("title") or "").lower()).strip()
        if url and url in seen_url:
            continue
        if title_key and title_key in seen_title:
            continue
        if url:
            seen_url.add(url)
        if title_key:
            seen_title.add(title_key)
        out.append(item)
    return out


def main() -> int:
    cfg = load_config()
    max_age = int(cfg.get("max_age_days") or 180)
    max_items = int(cfg.get("max_items") or 60)
    min_items = int(cfg.get("min_items") or 8)
    cutoff = now_local() - timedelta(days=max_age)
    keywords = cfg.get("category_keywords") or {}

    print(f"规则：近 {max_age} 天 AI 在线课程 · 最多 {max_items} 条")
    collected: list[dict] = []
    collected += fetch_deeplearning_ai(cfg.get("deeplearning_ai") or {}, cutoff, keywords)
    collected += fetch_coursera(cfg.get("coursera") or {}, cutoff, keywords)
    collected += fetch_huggingface(cfg.get("huggingface_learn") or {}, cutoff, keywords)
    collected += fetch_youtube_courses(cfg.get("youtube_courses") or {}, cutoff, keywords)

    items = dedupe_courses(collected)[:max_items]
    if len(items) < min_items:
        print(f"✗ 课程条数不足（{len(items)} < {min_items}）", file=sys.stderr)
        return 1

    payload = {
        "schema_version": 1,
        "updated_at": now_local().strftime("%Y-%m-%d %H:%M:%S%z"),
        "date": now_local().strftime("%Y-%m-%d"),
        "cadence": "weekly",
        "window_days": max_age,
        "title": "AI 学习资源",
        "lead": f"近 {max_age // 30} 个月上线的 AI 在线课程（DeepLearning.AI / Coursera / Hugging Face / 视频课），每周刷新。",
        "source_note": "筛选：发布或标注为新上线的课程；DeepLearning.AI 用 releasedAt；Coursera 取 NEW+isNewContent；Hugging Face 用仓库最近推送；YouTube 匹配课程向标题。",
        "items": items,
    }
    DATA_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    platforms = sorted({i.get("platform") for i in items if i.get("platform")})
    print(f"✓ ai-courses.json ({len(items)} 门) → {DATA_FILE}")
    print(f"  platforms: {', '.join(platforms)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
