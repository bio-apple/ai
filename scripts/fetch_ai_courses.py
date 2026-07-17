#!/usr/bin/env python3
"""抓取免费 AI 课程资源（必收录核心课 + 近半年补充），按学习路线写入 ai-courses.json。"""

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
USER_AGENT = "BioAI-Lab-CoursesBot/2.0"
ATOM_NS = {"a": "http://www.w3.org/2005/Atom"}

DEFAULT_TRACK_ORDER = [
    "入门",
    "机器学习",
    "深度学习",
    "LLM 大模型",
    "AI Agent",
    "AI 工程实践",
]


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
    return yaml.safe_load(CONFIG_FILE.read_text(encoding="utf-8")) or {}


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
    digest = hashlib.sha1(f"{platform}|{url}".encode("utf-8")).hexdigest()[:12]  # noqa: S324
    return f"{re.sub(r'[^a-z0-9]+', '-', platform.lower()).strip('-')}-{digest}"


def normalize_url(url: str) -> str:
    return (url or "").strip().rstrip("/")


def decode_js_str(value: str) -> str:
    text = value.replace("\\u0026", "&").replace("\\/", "/")
    try:
        return json.loads(f'"{text}"')
    except json.JSONDecodeError:
        return unescape(text)


def classify_track(title: str, summary: str, keywords: dict[str, str], fallback: str) -> str:
    blob = f"{title}\n{summary}".lower()
    for track, pattern in (keywords or {}).items():
        try:
            if re.search(pattern, blob, re.I):
                return str(track)
        except re.error:
            continue
    return fallback


def course_item(
    *,
    source: str,
    title: str,
    url: str,
    summary: str,
    track: str,
    fmt: str,
    published_at: str,
    language: str = "en",
    is_new: bool = False,
    course_id: str | None = None,
    required: bool = False,
) -> dict[str, Any]:
    return {
        "id": course_id or make_id(source, url),
        "title": title,
        "url": url,
        "summary": (summary or "")[:280],
        "platform": source,
        "track": track,
        "format": fmt,
        "published_at": published_at,
        "language": language,
        "is_free": True,
        "is_new": is_new,
        "required": required,
    }


def fetch_required(cfg: dict[str, Any]) -> list[dict[str, Any]]:
    today = now_local().strftime("%Y-%m-%d")
    items: list[dict[str, Any]] = []
    for row in cfg.get("required") or []:
        if not isinstance(row, dict):
            continue
        url = str(row.get("url") or "").strip()
        title = str(row.get("title") or "").strip()
        if not url or not title:
            continue
        platform = str(row.get("platform") or "Official")
        items.append(
            course_item(
                source=platform,
                title=title,
                url=url,
                summary=str(row.get("summary") or ""),
                track=str(row.get("track") or "入门"),
                fmt=str(row.get("format") or "官方课程"),
                published_at=today,
                language=str(row.get("language") or "en"),
                course_id=str(row.get("id") or make_id(platform, url)),
                required=True,
            )
        )
    print(f"  · 必收录: {len(items)}")
    return items


def fetch_deeplearning_ai(cfg: dict[str, Any], cutoff: datetime, keywords: dict[str, str]) -> list[dict]:
    if not cfg.get("enabled", True):
        return []
    html = fetch_text(cfg["url"])
    if not html:
        return []
    base = cfg.get("base_url") or "https://www.deeplearning.ai/courses/"
    source = cfg.get("source") or "DeepLearning.AI"
    fallback = "LLM 大模型"
    items: list[dict] = []
    seen: set[str] = set()
    for m in re.finditer(r'releasedAt\\":\\"(20\d{2}-\d{2}-\d{2}T[^\\"]*)\\"', html):
        published = parse_iso_date(m.group(1))
        if not published or published < cutoff:
            continue
        window = html[max(0, m.start() - 500) : m.start()]
        if 'type\\":\\"short_course\\"' not in window and 'type\\":\\"course\\"' not in window:
            continue
        slug_m = re.search(r'slug\\":\\"([a-z0-9-]+)\\"', window)
        name_m = re.search(r'name\\":\\"((?:[^\\]|\\[^"])*?)\\"', window)
        if not slug_m or not name_m:
            continue
        slug = slug_m.group(1)
        if slug in seen:
            continue
        seen.add(slug)
        name = decode_js_str(name_m.group(1)).strip()
        if not name or len(name) > 160 or '"' in name or "type\\" in name:
            continue
        url = urljoin(base if base.endswith("/") else base + "/", slug)
        summary = "DeepLearning.AI 免费短课程"
        desc_m = re.search(
            rf'\\"description\\":\\"((?:[^\\]|\\[^"])*?)\\",\\"slug\\":\\"{re.escape(slug)}\\"',
            html,
        )
        if desc_m:
            summary = decode_js_str(desc_m.group(1)).strip() or summary
        items.append(
            course_item(
                source=source,
                title=name,
                url=url,
                summary=summary,
                track=classify_track(name, summary, keywords, fallback),
                fmt="短课程",
                published_at=published.strftime("%Y-%m-%d"),
            )
        )
    print(f"  · DeepLearning.AI (免费): {len(items)}")
    return items


def fetch_coursera(cfg: dict[str, Any], cutoff: datetime, keywords: dict[str, str]) -> list[dict]:
    if not cfg.get("enabled", True):
        return []
    base = cfg.get("base_url") or "https://www.coursera.org"
    source = cfg.get("source") or "Coursera"
    fallback = "机器学习"
    max_per = int(cfg.get("max_per_query") or 10)
    sort = str(cfg.get("sort") or "NEW")
    today = now_local().strftime("%Y-%m-%d")
    items: list[dict] = []
    seen: set[str] = set()
    for query in cfg.get("queries") or []:
        for sort_by in (sort, "BEST_MATCH"):
            url = f"{base}/courses?query={quote(query)}&sortBy={quote(sort_by)}"
            html = fetch_text(url)
            if not html:
                continue
            m = re.search(
                r"window\.__APOLLO_STATE__\s*=\s*(\{.*?\})\s*(?:;|\n|</script>)",
                html,
                re.S,
            )
            if not m:
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
                if not hit.get("isCourseFree"):
                    continue
                path = str(hit.get("url") or "").strip()
                title = str(hit.get("name") or "").strip()
                if not path or not title:
                    continue
                full = urljoin(base + "/", path.lstrip("/"))
                if full in seen:
                    continue
                if not hit.get("isNewContent"):
                    continue
                seen.add(full)
                partners = hit.get("partners") or []
                partner = partners[0] if partners else ""
                summary = str(hit.get("tagline") or partner or "Coursera 免费课程").strip()
                level = str(hit.get("productDifficultyLevel") or "").replace("_", " ").title()
                if level:
                    summary = f"{summary} · {level}".strip(" ·")
                items.append(
                    course_item(
                        source=source,
                        title=title,
                        url=full,
                        summary=summary,
                        track=classify_track(title, summary, keywords, fallback),
                        fmt="MOOC",
                        published_at=today,
                        is_new=bool(hit.get("isNewContent")),
                    )
                )
                n += 1
                if n >= max_per:
                    break
            if n:
                print(f"  · Coursera free q={query!r} sort={sort_by}: +{n}")
            if n >= max_per:
                break
    _ = cutoff
    print(f"  · Coursera (免费合计): {len(items)}")
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
    fallback = "LLM 大模型"
    items: list[dict] = []
    for course in cfg.get("courses") or []:
        url = course.get("url")
        name = course.get("name") or course.get("id")
        if not url or not name:
            continue
        published = github_repo_pushed_at(course["repo"]) if course.get("repo") else None
        if not published:
            hub_html = fetch_text(cfg.get("hub") or "https://huggingface.co/learn") or ""
            if course.get("id") and course["id"] not in hub_html and url not in hub_html:
                continue
            published = now_local()
        if published < cutoff:
            continue
        summary = f"Hugging Face Learn 免费开源课程 · {course.get('id')}"
        track = str(course.get("track") or "").strip() or classify_track(
            str(name), summary, keywords, fallback
        )
        items.append(
            course_item(
                source=source,
                title=name,
                url=url,
                summary=summary,
                track=track,
                fmt="开源课程",
                published_at=published.strftime("%Y-%m-%d"),
                course_id=str(course.get("id") or make_id(source, url)),
            )
        )
    print(f"  · Hugging Face Learn (免费): {len(items)}")
    return items


def fetch_youtube_courses(cfg: dict[str, Any], cutoff: datetime, keywords: dict[str, str]) -> list[dict]:
    if not cfg.get("enabled", True):
        return []
    pattern = cfg.get("title_pattern") or "course"
    try:
        title_re = re.compile(pattern, re.I)
    except re.error:
        title_re = re.compile(r"course", re.I)
    fallback = "入门"
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
            summary = f"{ch.get('name') or source} · YouTube 免费完整课程向视频"
            items.append(
                course_item(
                    source=source,
                    title=unescape(title),
                    url=href,
                    summary=summary,
                    track=classify_track(title, summary, keywords, fallback),
                    fmt="视频课程",
                    published_at=published.strftime("%Y-%m-%d"),
                )
            )
            n += 1
        print(f"  · YouTube {ch.get('name')} (免费): +{n}")
    return items


def merge_and_sort(
    required: list[dict],
    discovered: list[dict],
    *,
    track_order: list[str],
    max_items: int,
) -> list[dict]:
    order_index = {name: i for i, name in enumerate(track_order)}
    seen_url: set[str] = set()
    seen_title: set[str] = set()
    merged: list[dict] = []

    for item in required + discovered:
        if item.get("is_free") is not True:
            continue
        url = normalize_url(str(item.get("url") or ""))
        title_key = re.sub(r"\s+", " ", str(item.get("title") or "").lower()).strip()
        if url and url in seen_url:
            continue
        if title_key and title_key in seen_title:
            continue
        if url:
            seen_url.add(url)
        if title_key:
            seen_title.add(title_key)
        merged.append(item)

    def sort_key(row: dict[str, Any]) -> tuple[int, int, str, str]:
        track = str(row.get("track") or "")
        # required first within the same track
        req_rank = 0 if row.get("required") else 1
        return (
            order_index.get(track, 999),
            req_rank,
            str(row.get("published_at") or ""),
            str(row.get("title") or "").lower(),
        )

    merged.sort(key=sort_key)

    required_urls = {normalize_url(str(x.get("url") or "")) for x in required}
    if len(merged) <= max_items:
        return merged

    keep = [r for r in merged if normalize_url(str(r.get("url") or "")) in required_urls]
    extras = [r for r in merged if normalize_url(str(r.get("url") or "")) not in required_urls]
    remain = max(0, max_items - len(keep))
    out = keep + extras[:remain]
    out.sort(key=sort_key)
    return out


def main() -> int:
    cfg = load_config()
    max_age = int(cfg.get("max_age_days") or 180)
    max_items = int(cfg.get("max_items") or 80)
    min_items = int(cfg.get("min_items") or 8)
    cutoff = now_local() - timedelta(days=max_age)
    track_order = [str(x) for x in (cfg.get("track_order") or DEFAULT_TRACK_ORDER)]
    keywords = {
        str(k): str(v) for k, v in (cfg.get("track_keywords") or {}).items() if v
    }

    print(f"规则：必收录 + 近 {max_age} 天免费补充 · 路线编排 · 最多 {max_items} 条")
    required = fetch_required(cfg)
    discovered: list[dict] = []
    discovered += fetch_deeplearning_ai(cfg.get("deeplearning_ai") or {}, cutoff, keywords)
    discovered += fetch_coursera(cfg.get("coursera") or {}, cutoff, keywords)
    discovered += fetch_huggingface(cfg.get("huggingface_learn") or {}, cutoff, keywords)
    discovered += fetch_youtube_courses(cfg.get("youtube_courses") or {}, cutoff, keywords)

    items = merge_and_sort(required, discovered, track_order=track_order, max_items=max_items)
    if len(items) < min_items:
        print(f"✗ 免费课程条数不足（{len(items)} < {min_items}）", file=sys.stderr)
        return 1

    required_urls = {normalize_url(str(r.get("url") or "")) for r in required}
    present = {normalize_url(str(i.get("url") or "")) for i in items}
    missing = sorted(required_urls - present)
    if missing:
        print(f"✗ 必收录课程缺失: {missing}", file=sys.stderr)
        return 1

    payload = {
        "schema_version": 2,
        "updated_at": now_local().strftime("%Y-%m-%d %H:%M:%S%z"),
        "date": now_local().strftime("%Y-%m-%d"),
        "cadence": "weekly",
        "window_days": max_age,
        "free_only": True,
        "track_order": track_order,
        "title": "AI 课程资源",
        "lead": (
            "按「入门 → 机器学习 → 深度学习 → LLM 大模型 → AI Agent → AI 工程实践」编排的免费课程；"
            "必收录微软 / 吴恩达 / 斯坦福 / Google 核心课，并补充近半年新课。"
        ),
        "source_note": (
            "必收录不受时间窗限制；补充课来自 DeepLearning.AI / Coursera 免费课 / "
            "Hugging Face Learn / YouTube 公开视频课。"
        ),
        "items": items,
    }
    DATA_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    platforms = sorted({i.get("platform") for i in items if i.get("platform")})
    tracks = sorted({i.get("track") for i in items if i.get("track")})
    print(f"✓ ai-courses.json ({len(items)} 门, required={len(required)}) → {DATA_FILE}")
    print(f"  tracks: {', '.join(tracks)}")
    print(f"  platforms: {', '.join(str(p) for p in platforms)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
