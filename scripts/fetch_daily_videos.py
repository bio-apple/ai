#!/usr/bin/env python3
"""每日抓取 AI 应用相关视频（YouTube + B站：3d/30d 直出，100d 补齐，合计 ≤10）。"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Any

import yaml

from fetch_resilience import atomic_write_json, retry_with_backoff

ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = ROOT / "daily-videos.json"
CONFIG_FILE = ROOT / "config" / "video-fetch.yaml"
BILIBILI_THUMB_DIR = ROOT / "video-thumbs" / "bilibili"
TZ_NAME = "Asia/Shanghai"
# 1）3d Top3(≥100万) 直出 2）30d Top5(≥100万) 直出 3）100d Top10(>100万) 补齐；合计 ≤10
CATEGORY_ORDER = (
    "youtube_recent_3d",
    "youtube_recent_30d",
    "youtube_recent_100d",
    "bilibili_recent_3d",
    "bilibili_recent_30d",
    "bilibili_recent_100d",
)

# 抓取填充顺序：先 B站（详情稳）再 YouTube，避免 YT 反爬耗尽 detail 配额
PICK_ORDER = (
    "bilibili_recent_3d",
    "bilibili_recent_30d",
    "bilibili_recent_100d",
    "youtube_recent_3d",
    "youtube_recent_30d",
    "youtube_recent_100d",
)
PLATFORM_ORDER = ("youtube", "bilibili")
DEFAULT_PLATFORM_TOTAL_CAP = 10

# 历史批次键兼容（旧 100 天键名为 *_top_views）
LEGACY_CATEGORY_ALIASES: dict[str, tuple[str, ...]] = {
    "youtube_recent_100d": ("youtube_recent_100d", "youtube_top_views"),
    "bilibili_recent_100d": ("bilibili_recent_100d", "bilibili_top_views"),
}

# ≤30 天视为窄窗口（min_views 回退用）
NARROW_WINDOW_HOURS = 30 * 24

try:
    from zoneinfo import ZoneInfo

    TZ = ZoneInfo(TZ_NAME)
except Exception:  # pragma: no cover
    TZ = None


def load_config() -> dict[str, Any]:
    cfg = yaml.safe_load(CONFIG_FILE.read_text(encoding="utf-8"))
    cfg["ai_keyword_re"] = re.compile(cfg.pop("ai_keyword_pattern"), re.I)
    cfg["summary_strip_res"] = [re.compile(p, re.I) for p in cfg.get("summary", {}).get("strip_patterns", [])]
    return cfg


def youtube_api_key() -> str | None:
    key = (
        os.environ.get("YOUTUBE_API_KEY")
        or os.environ.get("YOUTUBE_DATA_API_V3")
        or os.environ.get("GOOGLE_API_KEY")
        or ""
    ).strip()
    return key or None


def youtube_api_request(endpoint: str, params: dict[str, Any]) -> dict[str, Any]:
    key = youtube_api_key()
    if not key:
        raise RuntimeError("missing YOUTUBE_API_KEY")
    query = urllib.parse.urlencode({**params, "key": key})
    url = f"https://www.googleapis.com/youtube/v3/{endpoint}?{query}"

    def _get() -> dict[str, Any]:
        req = urllib.request.Request(url, headers={"User-Agent": "bio-apple-ai-daily-videos/1.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))

    return retry_with_backoff(_get, label=f"youtube:{endpoint}")


def parse_iso8601_duration(iso: str | None) -> int:
    """PT1H2M3S → 秒数。"""
    if not iso:
        return 0
    m = re.fullmatch(
        r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?",
        iso.strip(),
        flags=re.I,
    )
    if not m:
        return 0
    h, mi, s = (int(x or 0) for x in m.groups())
    return h * 3600 + mi * 60 + s


def parse_iso8601_datetime(iso: str | None) -> datetime | None:
    if not iso:
        return None
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        if TZ:
            return dt.astimezone(TZ)
        return dt
    except ValueError:
        return None


def youtube_api_item_to_detail(item: dict[str, Any], *, default_height: int = 1080) -> dict[str, Any]:
    snippet = item.get("snippet") or {}
    stats = item.get("statistics") or {}
    content = item.get("contentDetails") or {}
    published = parse_iso8601_datetime(snippet.get("publishedAt"))
    thumbs = snippet.get("thumbnails") or {}
    thumb = (
        (thumbs.get("maxres") or {}).get("url")
        or (thumbs.get("high") or {}).get("url")
        or (thumbs.get("medium") or {}).get("url")
        or (thumbs.get("default") or {}).get("url")
        or ""
    )
    duration_sec = parse_iso8601_duration(content.get("duration"))
    upload_date = published.strftime("%Y%m%d") if published else None
    return {
        "id": item.get("id"),
        "title": snippet.get("title") or "",
        "description": snippet.get("description") or "",
        "view_count": int(stats.get("viewCount") or 0),
        "channel": snippet.get("channelTitle") or "未知频道",
        "uploader": snippet.get("channelTitle") or "未知频道",
        "thumbnail": thumb,
        "thumbnails": [{"url": thumb}] if thumb else [],
        "duration": duration_sec,
        "timestamp": int(published.timestamp()) if published else None,
        "upload_date": upload_date,
        "height": default_height,
        "channel_follower_count": 0,
    }


def fetch_youtube_api_detail(video_id: str, *, default_height: int = 1080) -> dict | None:
    try:
        data = youtube_api_request("videos", {"part": "snippet,statistics,contentDetails", "id": video_id})
    except Exception as exc:
        log_reject("youtube_api_detail_failed", composite_id("youtube", video_id), str(exc))
        return None
    items = data.get("items") or []
    if not items:
        return None
    return youtube_api_item_to_detail(items[0], default_height=default_height)


def run_ytdlp(args: list[str], timeout: int = 120) -> str:
    cmd = ["yt-dlp", "--no-warnings", "--no-color", "--no-update", "--js-runtimes", "node"]
    cookies = (os.environ.get("YTDLP_COOKIES_FILE") or "").strip()
    if cookies and Path(cookies).is_file():
        cmd.extend(["--cookies", cookies])
    cmd.extend(args)
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or proc.stdout.strip() or "yt-dlp failed")
    return proc.stdout


def parse_json_lines(raw: str) -> list[dict]:
    items = []
    for line in raw.splitlines():
        line = line.strip()
        if not line or line.startswith("ERROR:"):
            continue
        try:
            items.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return items


def is_relevant(title: str, description: str, cfg: dict) -> bool:
    return bool(cfg["ai_keyword_re"].search(f"{title} {description or ''}"))


def max_height(info: dict) -> int:
    heights = [info.get("height") or 0]
    for fmt in info.get("formats") or []:
        if fmt.get("height"):
            heights.append(fmt["height"])
    return max(heights) if heights else 0


def clean_description(description: str | None, cfg: dict) -> str:
    desc = description or ""
    desc = re.sub(r"https?://\S+", "", desc)
    desc = re.sub(r"www\.\S+", "", desc)
    for pat in cfg.get("summary_strip_res", []):
        desc = pat.sub("", desc)
    desc = re.sub(r"\s+", " ", desc).strip()
    return desc


def make_summary(title: str, description: str | None, channel: str, cfg: dict) -> str:
    desc = clean_description(description, cfg)
    sentence = re.split(r"[.!?\n|｜]", desc)[0].strip() if desc else ""
    smin = cfg.get("summary", {}).get("min_length", 24)
    smax = cfg.get("summary", {}).get("max_length", 130)

    bad = (
        len(sentence) < smin
        or re.search(r"https?://|www\.", sentence, re.I)
        or re.search(r"(?i)get chatgpt|bit\.ly|use code|sponsored|discount", sentence)
    )
    if bad:
        sentence = f"【{channel}】讲解 AI 工具实战应用，围绕「{title[:48]}」展示操作步骤与使用技巧。"
    if len(sentence) > smax:
        sentence = sentence[: smax - 1] + "…"
    return sentence


def format_duration(seconds: int | float | str | None) -> str:
    if not seconds:
        return ""
    if isinstance(seconds, str):
        raw = seconds.strip()
        if re.fullmatch(r"\d+:\d{2}(:\d{2})?", raw):
            return raw
        try:
            seconds = float(raw)
        except ValueError:
            return raw
    total = int(float(seconds))
    h, rem = divmod(total, 3600)
    m, s = divmod(rem, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"


def now_local() -> datetime:
    if TZ:
        return datetime.now(TZ)
    return datetime.utcnow()


def parse_upload_datetime(detail: dict) -> datetime | None:
    ts = detail.get("timestamp")
    if ts:
        return datetime.fromtimestamp(ts, tz=TZ) if TZ else datetime.utcfromtimestamp(ts)
    upload_date = detail.get("upload_date")
    if upload_date and re.fullmatch(r"\d{8}", str(upload_date)):
        dt = datetime.strptime(str(upload_date), "%Y%m%d")
        if TZ:
            dt = dt.replace(tzinfo=TZ)
        return dt
    return None


def is_within_hours(upload_dt: datetime, now: datetime, hours: float) -> bool:
    return (now - upload_dt).total_seconds() <= hours * 3600


def composite_id(platform: str, video_id: str) -> str:
    return f"{platform}:{video_id}"


def platform_video_url(platform: str, video_id: str, detail: dict | None = None) -> str:
    if platform == "bilibili":
        if detail and detail.get("webpage_url") and "bilibili.com/video" in detail["webpage_url"]:
            return detail["webpage_url"].replace("http://", "https://")
        if video_id.startswith("BV"):
            return f"https://www.bilibili.com/video/{video_id}"
        return f"https://www.bilibili.com/video/av{video_id}"
    return f"https://www.youtube.com/watch?v={video_id}"


def source_queries(cfg: dict, platform: str) -> list[str]:
    if platform == "bilibili":
        return cfg.get("bilibili_search_queries") or cfg.get("search_queries", [])
    return cfg.get("search_queries", [])


def should_skip_search_item(item: dict, platform: str) -> bool:
    if item.get("_type") == "playlist":
        return True
    url = item.get("webpage_url") or item.get("url") or ""
    if platform == "bilibili" and ("/cheese/" in url or "search_query=" in url):
        return True
    return False


def bilibili_api_request(params: dict) -> dict:
    query = urllib.parse.urlencode(params)
    cmd = [
        "curl",
        "-sS",
        f"https://api.bilibili.com/x/web-interface/wbi/search/type?{query}",
        "-H",
        "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "-H",
        "Referer: https://www.bilibili.com/",
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or "bilibili api failed")
    data = json.loads(proc.stdout)
    if data.get("code") != 0:
        raise RuntimeError(f"bilibili api code={data.get('code')}")
    return data.get("data") or {}


def parse_bilibili_duration(raw: str | None) -> str:
    if not raw:
        return ""
    raw = str(raw).strip()
    if re.fullmatch(r"\d+:\d{2}(:\d{2})?", raw):
        return raw
    return ""


def search_bilibili_api_candidates(
    cfg: dict,
    source_cfg: dict,
    *,
    sort_by_date: bool = False,
    min_views: int | None = None,
) -> dict[str, dict]:
    found: dict[str, dict] = {}
    threshold = min_views if min_views is not None else source_cfg.get("min_views", 0)
    order = "pubdate" if sort_by_date else "click"
    page_size = min(cfg.get("search_per_query", 20), 20)
    pages = max(1, int(cfg.get("search_pages") or 1))

    for query in source_queries(cfg, "bilibili"):
        for page in range(1, pages + 1):
            try:
                data = bilibili_api_request(
                    {
                        "search_type": "video",
                        "keyword": query,
                        "page": page,
                        "page_size": page_size,
                        "order": order,
                    }
                )
            except Exception as exc:
                print(f"search skip [bilibili-api] ({query} p{page}): {exc}", file=sys.stderr)
                break

            results = data.get("result") or []
            if not results:
                break

            for item in results:
                bvid = item.get("bvid")
                if not bvid:
                    continue
                title = re.sub("<[^>]+>", "", item.get("title") or "")
                desc = item.get("description") or ""
                views = int(item.get("play") or 0)
                if views < threshold:
                    log_reject("low_views_search", composite_id("bilibili", bvid), f"views={views}")
                    continue
                if not is_relevant(title, desc, cfg):
                    log_reject("not_relevant_search", composite_id("bilibili", bvid), title[:60])
                    continue
                key = composite_id("bilibili", bvid)
                pic = item.get("pic") or ""
                if pic.startswith("//"):
                    pic = f"https:{pic}"
                candidate = {
                    "platform": "bilibili",
                    "id": bvid,
                    "title": title,
                    "view_count": views,
                    "url": f"https://www.bilibili.com/video/{bvid}",
                    "detail": {
                        "id": bvid,
                        "title": title,
                        "description": desc,
                        "view_count": views,
                        "uploader": item.get("author") or "未知UP主",
                        "channel": item.get("author") or "未知UP主",
                        "thumbnail": pic,
                        "duration": parse_bilibili_duration(item.get("duration")),
                        "timestamp": item.get("pubdate"),
                        "height": 720,
                        "channel_follower_count": 0,
                    },
                }
                prev = found.get(key)
                if not prev or views > prev.get("view_count", 0):
                    found[key] = candidate
    return found


def search_source_candidates(
    cfg: dict,
    platform: str,
    source_cfg: dict,
    *,
    sort_by_date: bool = False,
    min_views: int | None = None,
) -> dict[str, dict]:
    if platform == "bilibili":
        return search_bilibili_api_candidates(cfg, source_cfg, sort_by_date=sort_by_date, min_views=min_views)

    found: dict[str, dict] = {}
    threshold = min_views if min_views is not None else source_cfg.get("min_views", 0)
    prefix = source_cfg.get("search_prefix", "ytsearch")

    for query in source_queries(cfg, platform):
        try:
            raw = run_ytdlp(
                [
                    "--dump-json",
                    "--flat-playlist",
                    "--no-download",
                    f"{prefix}{cfg['search_per_query']}:{query}",
                ],
                timeout=90,
            )
        except Exception as exc:
            print(f"search skip [{platform}] ({query}): {exc}", file=sys.stderr)
            continue

        for item in parse_json_lines(raw):
            if should_skip_search_item(item, platform):
                continue
            vid = item.get("id")
            if not vid:
                continue
            title = item.get("title") or ""
            desc = item.get("description") or ""
            views = int(item.get("view_count") or 0)
            if views < threshold:
                log_reject("low_views_search", composite_id(platform, vid), f"views={views}")
                continue
            if not is_relevant(title, desc, cfg):
                log_reject("not_relevant_search", composite_id(platform, vid), title[:60])
                continue
            key = composite_id(platform, vid)
            candidate = {
                "platform": platform,
                "id": vid,
                "title": title,
                "view_count": views,
                "url": platform_video_url(platform, vid, item),
                "detail": None,
            }
            prev = found.get(key)
            if not prev or views > prev.get("view_count", 0):
                found[key] = candidate
    return found


def search_platform_candidates(
    cfg: dict,
    platform: str,
    *,
    sort_by_date: bool = False,
    min_views: int | None = None,
) -> dict[str, dict]:
    source_cfg = cfg.get("search_sources", {}).get(platform, {})
    if not source_cfg.get("enabled", True):
        return {}
    platform_min = min_views
    if platform_min is None:
        platform_min = source_cfg.get("recent_min_views" if sort_by_date else "min_views")
    return search_source_candidates(cfg, platform, source_cfg, sort_by_date=sort_by_date, min_views=platform_min)


def load_store() -> dict:
    if DATA_FILE.exists():
        return json.loads(DATA_FILE.read_text(encoding="utf-8"))
    return {"seen_ids": [], "batches": []}


def save_store(store: dict) -> None:
    store["updated_at"] = now_local().isoformat()
    atomic_write_json(DATA_FILE, store)


def log_reject(reason: str, video_id: str, extra: str = "") -> None:
    msg = f"reject [{reason}] {video_id}"
    if extra:
        msg += f" — {extra}"
    print(msg, file=sys.stderr)


def fetch_video_detail(candidate: dict, cache: dict[str, dict | None], cfg: dict | None = None) -> dict | None:
    key = composite_id(candidate["platform"], candidate["id"])
    if key in cache:
        return cache[key]
    if candidate.get("detail"):
        cache[key] = candidate["detail"]
        return candidate["detail"]

    platform = candidate["platform"]
    source_cfg = (cfg or {}).get("search_sources", {}).get(platform, {})
    default_height = int(source_cfg.get("default_height") or 1080)

    if platform == "youtube" and youtube_api_key():
        detail = fetch_youtube_api_detail(candidate["id"], default_height=default_height)
        if detail:
            cache[key] = detail
            return detail

    try:
        raw = run_ytdlp(["--dump-json", "--no-download", candidate["url"]], timeout=90)
        detail = json.loads(raw)
    except Exception as exc:
        if platform == "youtube" and youtube_api_key():
            detail = fetch_youtube_api_detail(candidate["id"], default_height=default_height)
            if detail:
                cache[key] = detail
                return detail
        log_reject("detail_fetch_failed", key, str(exc))
        detail = None
    cache[key] = detail
    return detail


def normalize_remote_url(url: str) -> str:
    if url.startswith("//"):
        return f"https:{url}"
    return url


def thumb_extension(url: str) -> str:
    path = url.split("?", 1)[0].lower()
    for ext in (".webp", ".png", ".jpeg", ".jpg"):
        if path.endswith(ext):
            return ".jpg" if ext == ".jpeg" else ext
    return ".jpg"


def convert_thumb_to_webp(src: Path, dest: Path, max_width: int = 640, quality: int = 78) -> bool:
    """用 ffmpeg 将封面压成 WebP；失败则返回 False。"""
    try:
        proc = subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-loglevel",
                "error",
                "-i",
                str(src),
                "-vf",
                f"scale='min({max_width},iw)':-2",
                "-c:v",
                "libwebp",
                "-quality",
                str(quality),
                str(dest),
            ],
            timeout=60,
            capture_output=True,
        )
        return proc.returncode == 0 and dest.exists() and dest.stat().st_size > 512
    except Exception as exc:
        print(f"thumb webp convert skip [{src.name}]: {exc}", file=sys.stderr)
        return False


def mirror_bilibili_thumbnail(bvid: str, url: str) -> str:
    url = normalize_remote_url(url)
    if not url:
        return url
    BILIBILI_THUMB_DIR.mkdir(parents=True, exist_ok=True)
    webp_dest = BILIBILI_THUMB_DIR / f"{bvid}.webp"
    webp_rel = f"video-thumbs/bilibili/{bvid}.webp"
    if webp_dest.exists() and webp_dest.stat().st_size > 512:
        return webp_rel

    src_ext = thumb_extension(url)
    raw_dest = BILIBILI_THUMB_DIR / f"{bvid}{src_ext}"
    try:
        proc = subprocess.run(
            [
                "curl",
                "-sSL",
                url,
                "-H",
                "Referer: https://www.bilibili.com/",
                "-H",
                "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "-o",
                str(raw_dest),
            ],
            timeout=30,
            capture_output=True,
        )
        if proc.returncode != 0 or not raw_dest.exists() or raw_dest.stat().st_size <= 1024:
            if raw_dest.exists():
                raw_dest.unlink(missing_ok=True)
            return url

        if src_ext == ".webp":
            if raw_dest != webp_dest:
                raw_dest.replace(webp_dest)
            return webp_rel

        if convert_thumb_to_webp(raw_dest, webp_dest):
            raw_dest.unlink(missing_ok=True)
            # 清理历史 jpg/png 副本
            for legacy_ext in (".jpg", ".jpeg", ".png"):
                legacy = BILIBILI_THUMB_DIR / f"{bvid}{legacy_ext}"
                if legacy.exists():
                    legacy.unlink(missing_ok=True)
            return webp_rel

        # ffmpeg 不可用时回退原图
        rel = f"video-thumbs/bilibili/{bvid}{src_ext}"
        return rel
    except Exception as exc:
        print(f"thumb mirror skip [{bvid}]: {exc}", file=sys.stderr)
    return url


def bucket_limits(cfg: dict) -> dict[str, int]:
    return {key: cfg["video_categories"][key]["top_count"] for key in CATEGORY_ORDER}


def validate_and_build_record(
    candidate: dict,
    detail: dict,
    cfg: dict,
    now: datetime,
    *,
    require_hours: float | None,
    min_views: int,
) -> dict | None:
    platform = candidate["platform"]
    key = composite_id(platform, candidate["id"])

    upload_dt = parse_upload_datetime(detail)
    if not upload_dt:
        log_reject("no_upload_date", key)
        return None
    if require_hours is not None and not is_within_hours(upload_dt, now, require_hours):
        log_reject("outside_window", key, upload_dt.isoformat())
        return None

    height = int(detail.get("height") or 0) or max_height(detail)

    views = int(detail.get("view_count") or 0)
    subs = int(detail.get("channel_follower_count") or 0)
    if views < min_views:
        log_reject("low_views_detail", key, f"views={views}")
        return None

    title = detail.get("title") or candidate.get("title") or ""
    channel = detail.get("channel") or detail.get("uploader") or "未知频道"
    if not is_relevant(title, detail.get("description") or "", cfg):
        log_reject("not_relevant_detail", key, title[:60])
        return None

    thumb = detail.get("thumbnail") or ""
    if not thumb:
        thumbs = detail.get("thumbnails") or []
        thumb = thumbs[-1]["url"] if thumbs else ""
    if platform == "bilibili" and thumb:
        thumb = mirror_bilibili_thumbnail(candidate["id"], thumb)

    return {
        "id": key,
        "platform": platform,
        "title": title,
        "summary": make_summary(title, detail.get("description"), channel, cfg),
        "url": platform_video_url(platform, candidate["id"], detail),
        "thumbnail": thumb,
        "channel": channel,
        "subscribers": subs,
        "views": views,
        "duration": format_duration(detail.get("duration")),
        "max_height": height,
        "published_at": upload_dt.isoformat(),
    }


def candidate_within_hours(candidate: dict, now: datetime, hours: float) -> bool | None:
    """若候选已带发布时间则判断是否在窗口内；未知则返回 None。"""
    detail = candidate.get("detail") or {}
    upload_dt = parse_upload_datetime(detail)
    if not upload_dt:
        return None
    return is_within_hours(upload_dt, now, hours)


def rank_candidates_for_bucket(
    candidates: dict[str, dict],
    now: datetime,
    require_hours: float | None,
) -> list[dict]:
    """按播放量排序；已知超窗外的丢弃，窗内与未知时间一律按播放量竞争。"""
    items = list(candidates.values())
    if require_hours is None:
        return sorted(items, key=lambda x: int(x.get("view_count") or 0), reverse=True)

    eligible: list[dict] = []
    for item in items:
        ok = candidate_within_hours(item, now, require_hours)
        if ok is False:
            # 已知超窗外的直接丢弃，不占用 detail 配额
            continue
        eligible.append(item)
    return sorted(eligible, key=lambda x: int(x.get("view_count") or 0), reverse=True)


def collect_top_videos(
    ranked: list[dict],
    cfg: dict,
    now: datetime,
    *,
    limit: int,
    require_hours: float | None,
    min_views: int | None,
    detail_cache: dict[str, dict | None],
    checked: int,
    max_checks: int,
    exclude_ids: set[str] | None = None,
) -> tuple[list[dict], int]:
    exclude_ids = exclude_ids or set()
    picked: list[dict] = []
    picked_ids: set[str] = set()
    for candidate in ranked:
        if len(picked) >= limit:
            break
        if checked >= max_checks:
            break
        key = composite_id(candidate["platform"], candidate["id"])
        if key in exclude_ids or key in picked_ids:
            continue
        # 搜索结果已带 pubdate 时，超窗外直接跳过且不计入 checked
        if require_hours is not None:
            known = candidate_within_hours(candidate, now, require_hours)
            if known is False:
                continue
        checked += 1
        platform = candidate["platform"]
        source_cfg = cfg.get("search_sources", {}).get(platform, {})
        threshold = min_views
        if threshold is None:
            threshold = source_cfg.get("min_views", 0)

        detail = fetch_video_detail(candidate, detail_cache, cfg)
        if not detail:
            continue
        record = validate_and_build_record(
            candidate,
            detail,
            cfg,
            now,
            require_hours=require_hours,
            min_views=threshold,
        )
        if record:
            picked.append(record)
            picked_ids.add(record["id"])

    picked.sort(key=lambda v: v["views"], reverse=True)
    return picked[:limit], checked


def is_narrow_window(require_hours: float | None) -> bool:
    """3d / 30d 为窄窗口；100d 为宽窗口。"""
    return require_hours is not None and require_hours <= NARROW_WINDOW_HOURS


def category_videos_from_batch(cats: dict, key: str) -> list:
    """读取某分类视频；兼容历史别名键。"""
    for alias in LEGACY_CATEGORY_ALIASES.get(key, (key,)):
        videos = (cats.get(alias) or {}).get("videos") or []
        if videos:
            return list(videos)
    return (cats.get(key) or {}).get("videos") or []


def category_min_views(cat: dict, source_cfg: dict) -> int:
    if "min_views" in cat:
        return int(cat["min_views"])
    require_hours = category_window_hours(cat)
    if is_narrow_window(require_hours):
        return int(source_cfg.get("recent_min_views") or source_cfg.get("min_views") or 0)
    return int(source_cfg.get("min_views") or 0)


def pick_today_videos(cfg: dict) -> dict[str, list[dict]]:
    limits = bucket_limits(cfg)
    now = now_local()
    max_checks = cfg.get("max_detail_checks", 320)
    detail_cache: dict[str, dict | None] = {}
    checked = 0
    buckets: dict[str, list[dict]] = {key: [] for key in CATEGORY_ORDER}
    used_ids: set[str] = set()

    for key in PICK_ORDER:
        cat = cfg["video_categories"][key]
        platform = cat["platform"]
        source_cfg = cfg.get("search_sources", {}).get(platform, {})
        require_hours = category_window_hours(cat)
        min_views = category_min_views(cat, source_cfg)

        if require_hours is None:
            candidates = search_platform_candidates(cfg, platform, min_views=min_views)
        else:
            # 热度搜索为主（满足「按播放量 Top」），日期搜索补足近期新片
            candidates = search_platform_candidates(cfg, platform, min_views=min_views)
            for cid, item in search_platform_candidates(
                cfg, platform, sort_by_date=True, min_views=min_views
            ).items():
                if cid not in candidates:
                    candidates[cid] = item

        ranked = rank_candidates_for_bucket(candidates, now, require_hours)
        buckets[key], checked = collect_top_videos(
            ranked,
            cfg,
            now,
            limit=limits[key],
            require_hours=require_hours,
            min_views=min_views,
            detail_cache=detail_cache,
            checked=checked,
            max_checks=max_checks,
            exclude_ids=used_ids,
        )
        for video in buckets[key]:
            used_ids.add(video["id"])

    return buckets


def platform_total_cap(cfg: dict | None = None) -> int:
    if cfg is None:
        return DEFAULT_PLATFORM_TOTAL_CAP
    if cfg.get("platform_total_cap") is not None:
        return max(1, int(cfg["platform_total_cap"]))
    # 兼容旧配置名
    for legacy in ("platform_merged_top", "platform_final_top"):
        if cfg.get(legacy) is not None:
            return max(1, int(cfg[legacy]))
    return DEFAULT_PLATFORM_TOTAL_CAP


def platform_bucket_keys(platform: str) -> tuple[str, str, str]:
    return (
        f"{platform}_recent_3d",
        f"{platform}_recent_30d",
        f"{platform}_recent_100d",
    )


def finalize_platform_top_by_views(
    buckets: dict[str, list[dict]],
    *,
    limit: int = DEFAULT_PLATFORM_TOTAL_CAP,
) -> dict[str, list[dict]]:
    """3d、30d 直接保留；100d 按播放量从高到低补齐；去重后每平台总数不超过 limit。"""
    for platform in PLATFORM_ORDER:
        key_3d, key_30, key_100 = platform_bucket_keys(platform)
        selected: list[tuple[str, dict]] = []
        selected_ids: set[str] = set()

        def take_from(key: str, *, by_views: bool = True) -> None:
            items = list(buckets.get(key) or [])
            if by_views:
                items.sort(key=lambda v: int(v.get("views") or 0), reverse=True)
            for video in items:
                if len(selected) >= limit:
                    return
                vid = video.get("id")
                if not vid or vid in selected_ids:
                    continue
                selected.append((key, video))
                selected_ids.add(vid)

        # 1）3d 直出 2）30d 直出（组内仍按播放量排，便于稳定输出）
        take_from(key_3d, by_views=True)
        take_from(key_30, by_views=True)
        # 3）100d 按播放量从大到小补齐剩余名额
        take_from(key_100, by_views=True)

        keep: dict[str, list[dict]] = {key_3d: [], key_30: [], key_100: []}
        for key, video in selected:
            keep[key].append(video)
        buckets[key_3d] = keep[key_3d]
        buckets[key_30] = keep[key_30]
        buckets[key_100] = keep[key_100]
    return buckets


def category_window_hours(cat: dict) -> float | None:
    if cat.get("all_time"):
        return None
    if "hours" in cat:
        return float(cat["hours"])
    if "days" in cat:
        return float(cat["days"]) * 24
    return None


def category_window(cat: dict) -> dict:
    if cat.get("all_time"):
        return {"all_time": True}
    if "hours" in cat:
        return {"hours": cat["hours"]}
    if "days" in cat:
        return {"days": cat["days"]}
    return {}


def build_categories_payload(buckets: dict[str, list[dict]], cfg: dict) -> dict[str, dict]:
    payload: dict[str, dict] = {}
    for key in CATEGORY_ORDER:
        cat = cfg["video_categories"][key]
        payload[key] = {
            "label": cat["label"],
            "window": category_window(cat),
            "top_count": cat["top_count"],
            "videos": buckets[key],
        }
    return payload


def total_video_count(buckets: dict[str, list[dict]]) -> int:
    return sum(len(buckets[key]) for key in CATEGORY_ORDER)


def platform_bucket_total(buckets: dict[str, list[dict]], platform: str) -> int:
    return sum(
        len(buckets.get(key) or []) for key in CATEGORY_ORDER if key.startswith(platform)
    )


def preserve_platform_from_previous(
    buckets: dict[str, list[dict]],
    store: dict,
    *,
    today: str,
    platform: str,
    cfg: dict | None = None,
) -> dict[str, list[dict]]:
    """今日某平台全空时沿用最近一个有货的批次，避免覆盖掉有效数据。"""
    if platform_bucket_total(buckets, platform) > 0:
        return buckets
    cats_cfg = (cfg or {}).get("video_categories") or {}
    for batch in store.get("batches") or []:
        if batch.get("date") == today:
            continue
        cats = batch.get("categories") or {}
        prev_total = sum(
            len(category_videos_from_batch(cats, key))
            for key in CATEGORY_ORDER
            if key.startswith(platform)
        )
        if prev_total == 0:
            continue
        for key in CATEGORY_ORDER:
            if not key.startswith(platform):
                continue
            prev_videos = category_videos_from_batch(cats, key)
            if not prev_videos:
                continue
            min_views = int((cats_cfg.get(key) or {}).get("min_views") or 0)
            top_count = int((cats_cfg.get(key) or {}).get("top_count") or len(prev_videos))
            filtered = [v for v in prev_videos if int(v.get("views") or 0) >= min_views]
            ranked = sorted(filtered, key=lambda v: int(v.get("views") or 0), reverse=True)
            buckets[key] = [dict(v) for v in ranked[:top_count]]
        kept = platform_bucket_total(buckets, platform)
        print(
            f"警告：今日 {platform} 抓取为空，已沿用 {batch.get('date')} 批次"
            f"（源 {prev_total} 条 → 门槛过滤后 {kept} 条）",
            file=sys.stderr,
        )
        break
    return buckets


def topup_platform_from_previous(
    buckets: dict[str, list[dict]],
    store: dict,
    *,
    today: str,
    platform: str,
    cfg: dict,
    limit: int,
) -> dict[str, list[dict]]:
    """平台总数不足 cap 时，从历史批次按播放量补齐到 100d 桶。"""
    existing: dict[str, dict] = {}
    for key in platform_bucket_keys(platform):
        for video in buckets.get(key) or []:
            vid = video.get("id")
            if vid:
                existing[vid] = video
    have = len(existing)
    if have >= limit:
        return buckets

    fill_key = f"{platform}_recent_100d"
    if fill_key not in buckets:
        return buckets
    cats_cfg = cfg.get("video_categories") or {}
    min_views = int((cats_cfg.get(fill_key) or {}).get("min_views") or 0)
    extras: list[dict] = []

    for batch in store.get("batches") or []:
        if batch.get("date") == today:
            continue
        cats = batch.get("categories") or {}
        hist_keys = [k for k in CATEGORY_ORDER if k.startswith(platform)]
        for alias_key, aliases in LEGACY_CATEGORY_ALIASES.items():
            if alias_key.startswith(platform):
                hist_keys.extend(aliases)
        seen_hist: set[str] = set()
        for key in hist_keys:
            if key in seen_hist:
                continue
            seen_hist.add(key)
            for video in category_videos_from_batch(cats, key):
                vid = video.get("id")
                if not vid or vid in existing:
                    continue
                if int(video.get("views") or 0) < min_views:
                    continue
                extras.append(dict(video))
                existing[vid] = video
        if have + len(extras) >= limit:
            break

    if not extras:
        return buckets

    extras.sort(key=lambda v: int(v.get("views") or 0), reverse=True)
    need = limit - have
    add: list[dict] = []
    have_ids = {v.get("id") for v in (buckets.get(fill_key) or [])}
    for video in extras:
        if len(add) >= need:
            break
        vid = video.get("id")
        if not vid or vid in have_ids:
            continue
        if any(
            vid in {x.get("id") for x in (buckets.get(k) or [])}
            for k in platform_bucket_keys(platform)
            if k != fill_key
        ):
            continue
        add.append(video)
        have_ids.add(vid)

    if add:
        buckets[fill_key] = list(buckets.get(fill_key) or []) + add
        buckets[fill_key].sort(key=lambda v: int(v.get("views") or 0), reverse=True)
        print(
            f"警告：今日 {platform} 仅 {have} 条，已从历史批次补齐 {len(add)} 条到 100d",
            file=sys.stderr,
        )
    return buckets


def preserve_youtube_from_previous(
    buckets: dict[str, list[dict]],
    store: dict,
    *,
    today: str,
    cfg: dict | None = None,
) -> dict[str, list[dict]]:
    return preserve_platform_from_previous(
        buckets, store, today=today, platform="youtube", cfg=cfg
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="抓取每日 AI 视频推荐")
    parser.add_argument(
        "--force",
        action="store_true",
        help="删除今日已有批次并重新抓取（用于升级分类结构后回填）",
    )
    args = parser.parse_args()

    cfg = load_config()
    store = load_store()
    today = now_local().strftime("%Y-%m-%d")
    today_backup: dict | None = None

    if args.force:
        for batch in store.get("batches", []):
            if batch.get("date") == today:
                today_backup = batch
                break
        before = len(store.get("batches", []))
        store["batches"] = [b for b in store.get("batches", []) if b.get("date") != today]
        if before != len(store["batches"]):
            print(f"已移除今日 ({today}) 旧批次，准备重新抓取", file=sys.stderr)
    else:
        for batch in store.get("batches", []):
            if batch.get("date") == today:
                count = total_video_count(
                    {key: (batch.get("categories") or {}).get(key, {}).get("videos", []) for key in CATEGORY_ORDER}
                ) if batch.get("categories") else len(batch.get("videos", []))
                print(f"今日 ({today}) 已更新，共 {count} 条（使用 --force 可强制重抓）")
                return 0

    buckets = pick_today_videos(cfg)
    buckets = preserve_youtube_from_previous(buckets, store, today=today, cfg=cfg)
    buckets = preserve_platform_from_previous(
        buckets, store, today=today, platform="bilibili", cfg=cfg
    )
    limits = bucket_limits(cfg)
    total_cap = platform_total_cap(cfg)
    for platform in PLATFORM_ORDER:
        buckets = topup_platform_from_previous(
            buckets, store, today=today, platform=platform, cfg=cfg, limit=total_cap
        )

    for key in CATEGORY_ORDER:
        got = len(buckets[key])
        need = limits[key]
        if got < need:
            label = cfg["video_categories"][key]["label"]
            print(f"警告：{label} 仅 {got} 条（目标 {need}）", file=sys.stderr)

    before_final = total_video_count(buckets)
    buckets = finalize_platform_top_by_views(buckets, limit=total_cap)
    total = total_video_count(buckets)
    if before_final != total:
        print(
            f"合并截断：候选 {before_final} → 3d/30d 直出 + 100d 补齐（≤{total_cap}）后 {total}",
            file=sys.stderr,
        )
    min_total = len(PLATFORM_ORDER) * total_cap

    if total == 0:
        if today_backup:
            store.setdefault("batches", [])
            store["batches"].insert(0, today_backup)
            print("警告：今日抓取为空，已恢复 force 前的今日批次", file=sys.stderr)
        elif store.get("batches"):
            print("警告：今日抓取为空，未写入新批次，保留历史 daily-videos.json", file=sys.stderr)
        else:
            print("未找到符合条件的新视频，且无历史批次", file=sys.stderr)
            return 1
        return 0

    if total < min_total:
        print(f"警告：合计仅 {total} 条（目标约 {min_total}）", file=sys.stderr)

    store.setdefault("seen_ids", [])
    store.setdefault("batches", [])
    store["batches"].insert(
        0,
        {
            "date": today,
            "timezone": TZ_NAME,
            "criteria": {
                "search_sources": list(cfg.get("search_sources", {}).keys()),
                "platform_total_cap": total_cap,
                "video_categories": {
                    key: {
                        "label": cfg["video_categories"][key]["label"],
                        "window": category_window(cfg["video_categories"][key]),
                        "top_count": limits[key],
                        **(
                            {"min_views": cfg["video_categories"][key]["min_views"]}
                            if "min_views" in cfg["video_categories"][key]
                            else {}
                        ),
                    }
                    for key in CATEGORY_ORDER
                },
            },
            "categories": build_categories_payload(buckets, cfg),
        },
    )
    picked_ids = {v["id"] for key in CATEGORY_ORDER for v in buckets[key]}
    for vid in picked_ids:
        if vid not in store["seen_ids"]:
            store["seen_ids"].append(vid)

    store["batches"] = store["batches"][:60]
    save_store(store)
    counts = {key: len(buckets[key]) for key in CATEGORY_ORDER}
    yt_n = platform_bucket_total(buckets, "youtube")
    bili_n = platform_bucket_total(buckets, "bilibili")
    print(
        f"已写入 {today} 视频 {total} 条"
        f"（YT {yt_n}=3d/{counts['youtube_recent_3d']}+30d/{counts['youtube_recent_30d']}"
        f"+100d/{counts['youtube_recent_100d']}；"
        f"B站 {bili_n}=3d/{counts['bilibili_recent_3d']}+30d/{counts['bilibili_recent_30d']}"
        f"+100d/{counts['bilibili_recent_100d']}；3d/30d 直出+100d 补齐，合计≤{total_cap}）"
        f" → {DATA_FILE}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())  # e.g. python scripts/fetch_daily_videos.py --force
