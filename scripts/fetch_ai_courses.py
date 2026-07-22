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

from fetch_resilience import atomic_write_json, fetch_url_bytes, load_json, retry_with_backoff

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
]


def ssl_context() -> ssl.SSLContext:
    try:
        import certifi

        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


def fetch_bytes(url: str, retries: int = 4) -> bytes | None:
    return fetch_url_bytes(url, timeout=30, max_attempts=retries, user_agent=USER_AGENT)


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


def title_tokens(title: str) -> set[str]:
    stop = {
        "a",
        "an",
        "the",
        "and",
        "or",
        "with",
        "for",
        "to",
        "of",
        "in",
        "on",
        "course",
        "courses",
        "full",
        "complete",
        "free",
        "ai",
        "系列",
        "课程",
        "官方",
        "入门",
    }
    parts = re.findall(r"[a-z0-9\u4e00-\u9fff]+", (title or "").lower())
    return {p for p in parts if len(p) > 1 and p not in stop}


def title_jaccard(a: str, b: str) -> float:
    ta, tb = title_tokens(a), title_tokens(b)
    if not ta or not tb:
        return 0.0
    inter = len(ta & tb)
    union = len(ta | tb)
    return inter / union if union else 0.0


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
    official_url: str | None = None,
) -> dict[str, Any]:
    item: dict[str, Any] = {
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
    official = (official_url or "").strip()
    if official and normalize_url(official) != normalize_url(url):
        item["official_url"] = official
    return item


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
                official_url=str(row.get("official_url") or "").strip() or None,
            )
        )
    print(f"  · 必收录: {len(items)}")
    return items


def fetch_hubs(cfg: dict[str, Any]) -> list[dict[str, Any]]:
    """合集入口：一卡代表整套系列，避免与下属单课并列。"""
    today = now_local().strftime("%Y-%m-%d")
    items: list[dict[str, Any]] = []
    for row in cfg.get("hubs") or []:
        if not isinstance(row, dict):
            continue
        url = str(row.get("url") or "").strip()
        title = str(row.get("title") or "").strip()
        if not url or not title:
            continue
        platform = str(row.get("platform") or "Official")
        item = course_item(
            source=platform,
            title=title,
            url=url,
            summary=str(
                row.get("summary")
                or "系列合集入口：点此浏览全部短课程（不与下属单课重复罗列）。"
            ),
            track=str(row.get("track") or "LLM 大模型"),
            fmt=str(row.get("format") or "短课程合集"),
            published_at=today,
            language=str(row.get("language") or "en"),
            course_id=str(row.get("id") or make_id(platform, url)),
            required=True,
        )
        item["hub"] = True
        item["child_url_prefix"] = str(row.get("child_url_prefix") or "").strip()
        items.append(item)
    print(f"  · 合集入口: {len(items)}")
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

    def _get() -> dict:
        req = Request(api, headers=headers)
        with urlopen(req, timeout=20, context=ssl_context()) as resp:
            return json.loads(resp.read().decode("utf-8"))

    try:
        data = retry_with_backoff(_get, label=f"github:{repo}")
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


def fetch_youtube_courses(
    cfg: dict[str, Any],
    cutoff: datetime,
    keywords: dict[str, str],
    *,
    ai_pattern: str | None = None,
) -> list[dict]:
    if not cfg.get("enabled", True):
        return []
    pattern = cfg.get("title_pattern") or "course"
    try:
        title_re = re.compile(pattern, re.I)
    except re.error:
        title_re = re.compile(r"course", re.I)
    ai_re = None
    if ai_pattern:
        try:
            ai_re = re.compile(ai_pattern, re.I)
        except re.error:
            ai_re = None
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
            if ai_re and not ai_re.search(title):
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
        print(f"  · YouTube {ch.get('name')} (免费·AI): +{n}")
    return items


def suppress_hub_children(items: list[dict], *, prefer_hub: bool) -> list[dict]:
    if not prefer_hub:
        return items
    prefixes = [
        normalize_url(str(i.get("child_url_prefix") or ""))
        for i in items
        if i.get("hub") and i.get("child_url_prefix")
    ]
    if not prefixes:
        return items
    out: list[dict] = []
    dropped = 0
    for item in items:
        if item.get("hub"):
            out.append(item)
            continue
        url = normalize_url(str(item.get("url") or ""))
        if any(url.startswith(p) for p in prefixes if p):
            dropped += 1
            continue
        out.append(item)
    if dropped:
        print(f"  · 去重：合集下属单课已抑制 {dropped} 条")
    return out


def drop_near_duplicate_titles(items: list[dict], *, threshold: float) -> list[dict]:
    if threshold <= 0:
        return items
    kept: list[dict] = []
    dropped = 0
    for item in items:
        title = str(item.get("title") or "")
        track = str(item.get("track") or "")
        dup = False
        for prev in kept:
            if str(prev.get("track") or "") != track:
                continue
            # required/hub 优先保留；后来者若过近则丢
            if title_jaccard(title, str(prev.get("title") or "")) >= threshold:
                dup = True
                break
        if dup:
            dropped += 1
            continue
        kept.append(item)
    if dropped:
        print(f"  · 去重：标题近重复丢弃 {dropped} 条")
    return kept


def cap_platform_track(items: list[dict], *, max_per: int) -> list[dict]:
    if max_per <= 0:
        return items
    counts: dict[tuple[str, str], int] = {}
    out: list[dict] = []
    dropped = 0
    for item in items:
        if item.get("required") or item.get("hub"):
            out.append(item)
            continue
        key = (str(item.get("platform") or ""), str(item.get("track") or ""))
        n = counts.get(key, 0)
        if n >= max_per:
            dropped += 1
            continue
        counts[key] = n + 1
        out.append(item)
    if dropped:
        print(f"  · 去重：平台×路线超额丢弃 {dropped} 条")
    return out


def cap_track(
    items: list[dict],
    *,
    track_order: list[str],
    max_per: int,
) -> list[dict]:
    """每条学习路线最多 max_per 条；必学/合集优先。"""
    if max_per <= 0:
        return items

    order_index = {name: i for i, name in enumerate(track_order)}

    def item_rank(row: dict[str, Any]) -> tuple[int, str, str]:
        req_rank = 0 if (row.get("required") or row.get("hub")) else 1
        return (
            req_rank,
            str(row.get("published_at") or ""),
            str(row.get("title") or "").lower(),
        )

    buckets: dict[str, list[dict]] = {t: [] for t in track_order}
    extras: list[dict] = []
    for item in items:
        track = str(item.get("track") or "")
        if track in buckets:
            buckets[track].append(item)
        else:
            extras.append(item)

    out: list[dict] = []
    dropped = 0
    for track in track_order:
        rows = sorted(buckets.get(track) or [], key=item_rank)
        if len(rows) > max_per:
            dropped += len(rows) - max_per
            rows = rows[:max_per]
        out.extend(rows)

    extra_tracks: dict[str, list[dict]] = {}
    for item in extras:
        track = str(item.get("track") or "其他")
        extra_tracks.setdefault(track, []).append(item)
    for track in sorted(extra_tracks, key=lambda t: order_index.get(t, 999)):
        rows = sorted(extra_tracks[track], key=item_rank)
        if len(rows) > max_per:
            dropped += len(rows) - max_per
            rows = rows[:max_per]
        out.extend(rows)

    if dropped:
        print(f"  · 限额：每条路线最多 {max_per} 门，已丢弃 {dropped} 条")
    return out


def merge_and_sort(
    required: list[dict],
    discovered: list[dict],
    *,
    track_order: list[str],
    max_items: int,
    dedupe_cfg: dict[str, Any],
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
        # 不把内部字段写进最终 JSON
        clean = {k: v for k, v in item.items() if k != "child_url_prefix"}
        # 暂存 prefix 供 suppress 使用
        if item.get("child_url_prefix"):
            clean["child_url_prefix"] = item["child_url_prefix"]
        merged.append(clean)

    prefer_hub = bool(dedupe_cfg.get("prefer_hub_over_children", True))
    merged = suppress_hub_children(merged, prefer_hub=prefer_hub)

    def sort_key(row: dict[str, Any]) -> tuple[int, int, str, str]:
        track = str(row.get("track") or "")
        req_rank = 0 if (row.get("required") or row.get("hub")) else 1
        return (
            order_index.get(track, 999),
            req_rank,
            str(row.get("published_at") or ""),
            str(row.get("title") or "").lower(),
        )

    merged.sort(key=sort_key)
    merged = drop_near_duplicate_titles(
        merged, threshold=float(dedupe_cfg.get("title_jaccard") or 0)
    )
    merged = cap_platform_track(
        merged, max_per=int(dedupe_cfg.get("max_per_platform_per_track") or 0)
    )
    merged.sort(key=sort_key)
    merged = cap_track(
        merged,
        track_order=track_order,
        max_per=int(dedupe_cfg.get("max_per_track") or 5),
    )
    merged.sort(key=sort_key)

    # 清理内部字段
    for row in merged:
        row.pop("child_url_prefix", None)

    required_urls = {
        normalize_url(str(x.get("url") or ""))
        for x in required
        if x.get("required") or x.get("hub")
    }
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

    dedupe_cfg = cfg.get("dedupe") or {}
    required_only = bool(cfg.get("required_only"))
    print(
        (
            f"规则：仅必推荐核心课 · 去重 · 每路线≤{int(dedupe_cfg.get('max_per_track') or 5)}"
            if required_only
            else (
                f"规则：必收录 + 近 {max_age} 天免费补充 · 去重 · 每路线≤"
                f"{int(dedupe_cfg.get('max_per_track') or 5)} · 最多 {max_items} 条"
            )
        )
    )
    required = fetch_required(cfg) + fetch_hubs(cfg)
    discovered: list[dict] = []
    if not required_only:
        discovered += fetch_deeplearning_ai(cfg.get("deeplearning_ai") or {}, cutoff, keywords)
        discovered += fetch_coursera(cfg.get("coursera") or {}, cutoff, keywords)
        discovered += fetch_huggingface(cfg.get("huggingface_learn") or {}, cutoff, keywords)
        discovered += fetch_youtube_courses(
            cfg.get("youtube_courses") or {},
            cutoff,
            keywords,
            ai_pattern=str(dedupe_cfg.get("youtube_ai_pattern") or "") or None,
        )

    items = merge_and_sort(
        required,
        discovered,
        track_order=track_order,
        max_items=max_items,
        dedupe_cfg=dedupe_cfg,
    )
    payload = {
        "schema_version": 2,
        "updated_at": now_local().strftime("%Y-%m-%d %H:%M:%S%z"),
        "date": now_local().strftime("%Y-%m-%d"),
        "cadence": "daily",
        "window_days": max_age,
        "free_only": True,
        "required_only": required_only,
        "track_order": track_order,
        "title": "AI 课程资源",
        "lead": (
            "按学习路线精选免费课：微软与谷歌入门，斯坦福 CS230 / CS231n / CS224n / CS336"
            "（YouTube 最新学年讲座 + 官网）。"
            if required_only
            else (
                "按「入门 → 机器学习 → 深度学习 → LLM 大模型 → AI Agent」编排的免费课程；"
                "每条路线最多推荐 5 门；必收录微软 / 斯坦福 / Google 核心课。"
            )
        ),
        "source_note": (
            "仅收录微软、谷歌与斯坦福公开课；斯坦福同时给出 YouTube 播放列表与官方主页。"
            if required_only
            else (
                "去重规则：URL/标题唯一；合集优先于下属单课；每条路线≤5 门（必学优先）；"
                "同平台同路线限额。补充课来自 Coursera 免费课 / Hugging Face / YouTube（AI 向）。"
            )
        ),
        "items": items,
    }

    required_urls = {normalize_url(str(r.get("url") or "")) for r in required}
    present = {normalize_url(str(i.get("url") or "")) for i in items}
    missing = sorted(required_urls - present)

    def courses_acceptable(data: dict) -> bool:
        got = data.get("items") or []
        if len(got) < min_items:
            return False
        got_urls = {normalize_url(str(i.get("url") or "")) for i in got}
        return not (required_urls - got_urls)

    if not courses_acceptable(payload):
        if load_json(DATA_FILE) is not None:
            reason = f"条数 {len(items)} < {min_items}" if len(items) < min_items else f"缺失必收录 {missing}"
            print(f"警告：课程抓取未达标（{reason}），保留现有 ai-courses.json", file=sys.stderr)
            return 0
        if len(items) < min_items:
            print(f"✗ 免费课程条数不足（{len(items)} < {min_items}）", file=sys.stderr)
            return 1
        if missing:
            print(f"✗ 必收录课程缺失: {missing}", file=sys.stderr)
            return 1

    atomic_write_json(DATA_FILE, payload)
    platforms = sorted({i.get("platform") for i in items if i.get("platform")})
    tracks = sorted({i.get("track") for i in items if i.get("track")})
    print(f"✓ ai-courses.json ({len(items)} 门, required={len(required)}) → {DATA_FILE}")
    print(f"  tracks: {', '.join(tracks)}")
    print(f"  platforms: {', '.join(str(p) for p in platforms)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
