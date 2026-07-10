#!/usr/bin/env python3
"""每日抓取 AI 应用相关 YouTube 视频（1080p+，按播放量 Top10 分两类推荐）。"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

import yaml

ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = ROOT / "daily-videos.json"
CONFIG_FILE = ROOT / "config" / "video-fetch.yaml"
TZ_NAME = "Asia/Shanghai"
CATEGORY_ORDER = ("top_views", "recent_7d")

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


def run_ytdlp(args: list[str], timeout: int = 120) -> str:
    cmd = ["yt-dlp", "--no-warnings", "--no-color", *args]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or proc.stdout.strip() or "yt-dlp failed")
    return proc.stdout


def parse_json_lines(raw: str) -> list[dict]:
    items = []
    for line in raw.splitlines():
        line = line.strip()
        if not line:
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


def format_duration(seconds: int | float | None) -> str:
    if not seconds:
        return ""
    total = int(seconds)
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


def load_store() -> dict:
    if DATA_FILE.exists():
        return json.loads(DATA_FILE.read_text(encoding="utf-8"))
    return {"seen_ids": [], "batches": []}


def save_store(store: dict) -> None:
    store["updated_at"] = now_local().isoformat()
    DATA_FILE.write_text(json.dumps(store, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def log_reject(reason: str, video_id: str, extra: str = "") -> None:
    msg = f"reject [{reason}] {video_id}"
    if extra:
        msg += f" — {extra}"
    print(msg, file=sys.stderr)


def search_candidates(
    cfg: dict,
    *,
    sort_by_date: bool = False,
    min_views: int | None = None,
) -> dict[str, dict]:
    found: dict[str, dict] = {}
    threshold = min_views if min_views is not None else cfg["min_views"]
    search_prefix = "ytsearchdate" if sort_by_date else "ytsearch"
    for query in cfg["search_queries"]:
        try:
            raw = run_ytdlp(
                [
                    "--dump-json",
                    "--flat-playlist",
                    "--no-download",
                    f"{search_prefix}{cfg['search_per_query']}:{query}",
                ],
                timeout=90,
            )
        except Exception as exc:
            print(f"search skip ({query}): {exc}", file=sys.stderr)
            continue

        for item in parse_json_lines(raw):
            vid = item.get("id")
            if not vid or item.get("_type") == "playlist":
                continue
            title = item.get("title") or ""
            desc = item.get("description") or ""
            views = int(item.get("view_count") or 0)
            if views < threshold:
                log_reject("low_views_search", vid, f"views={views}")
                continue
            if not is_relevant(title, desc, cfg):
                log_reject("not_relevant_search", vid, title[:60])
                continue
            prev = found.get(vid)
            if not prev or views > prev.get("view_count", 0):
                found[vid] = item
    return found


def fetch_video_detail(video_id: str, cache: dict[str, dict | None]) -> dict | None:
    if video_id in cache:
        return cache[video_id]
    url = f"https://www.youtube.com/watch?v={video_id}"
    try:
        raw = run_ytdlp(["--dump-json", "--no-download", url], timeout=90)
        detail = json.loads(raw)
    except Exception as exc:
        log_reject("detail_fetch_failed", video_id, str(exc))
        detail = None
    cache[video_id] = detail
    return detail


def bucket_limits(cfg: dict) -> dict[str, int]:
    return {key: cfg["video_categories"][key]["top_count"] for key in CATEGORY_ORDER}


def validate_and_build_record(
    item: dict,
    detail: dict,
    cfg: dict,
    now: datetime,
    *,
    require_hours: float | None,
    min_views: int,
) -> dict | None:
    upload_dt = parse_upload_datetime(detail)
    if not upload_dt:
        log_reject("no_upload_date", item["id"])
        return None
    if require_hours is not None and not is_within_hours(upload_dt, now, require_hours):
        log_reject("outside_window", item["id"], upload_dt.isoformat())
        return None

    height = max_height(detail)
    if height < cfg["min_height"]:
        log_reject("low_resolution", item["id"], f"height={height}")
        return None

    views = int(detail.get("view_count") or 0)
    subs = int(detail.get("channel_follower_count") or 0)
    if views < min_views:
        log_reject("low_views_detail", item["id"], f"views={views}")
        return None
    if subs < cfg["min_subscribers"]:
        log_reject("low_subscribers", item["id"], f"subs={subs}")
        return None

    title = detail.get("title") or item.get("title") or ""
    channel = detail.get("channel") or detail.get("uploader") or "未知频道"
    if not is_relevant(title, detail.get("description") or "", cfg):
        log_reject("not_relevant_detail", item["id"], title[:60])
        return None

    thumb = detail.get("thumbnail") or ""
    if not thumb:
        thumbs = detail.get("thumbnails") or []
        thumb = thumbs[-1]["url"] if thumbs else ""

    return {
        "id": item["id"],
        "title": title,
        "summary": make_summary(title, detail.get("description"), channel, cfg),
        "url": f"https://www.youtube.com/watch?v={item['id']}",
        "thumbnail": thumb,
        "channel": channel,
        "subscribers": subs,
        "views": views,
        "duration": format_duration(detail.get("duration")),
        "max_height": height,
        "published_at": upload_dt.isoformat(),
    }


def collect_top_videos(
    ranked: list[dict],
    cfg: dict,
    now: datetime,
    *,
    limit: int,
    require_hours: float | None,
    min_views: int,
    detail_cache: dict[str, dict | None],
    checked: int,
    max_checks: int,
) -> tuple[list[dict], int]:
    picked: list[dict] = []
    for item in ranked:
        if len(picked) >= limit:
            break
        if checked >= max_checks:
            break
        checked += 1
        detail = fetch_video_detail(item["id"], detail_cache)
        if not detail:
            continue
        record = validate_and_build_record(
            item,
            detail,
            cfg,
            now,
            require_hours=require_hours,
            min_views=min_views,
        )
        if record:
            picked.append(record)

    picked.sort(key=lambda v: v["views"], reverse=True)
    return picked[:limit], checked


def pick_today_videos(cfg: dict) -> dict[str, list[dict]]:
    limits = bucket_limits(cfg)
    now = now_local()
    max_checks = cfg.get("max_detail_checks", 200)
    detail_cache: dict[str, dict | None] = {}
    checked = 0
    buckets: dict[str, list[dict]] = {key: [] for key in CATEGORY_ORDER}

    popular_candidates = search_candidates(cfg)
    ranked_popular = sorted(
        popular_candidates.values(),
        key=lambda x: int(x.get("view_count") or 0),
        reverse=True,
    )
    buckets["top_views"], checked = collect_top_videos(
        ranked_popular,
        cfg,
        now,
        limit=limits["top_views"],
        require_hours=None,
        min_views=cfg["min_views"],
        detail_cache=detail_cache,
        checked=checked,
        max_checks=max_checks,
    )

    recent_candidates = search_candidates(
        cfg,
        sort_by_date=True,
        min_views=cfg.get("recent_min_views", cfg["min_views"]),
    )
    recent_candidates.update(popular_candidates)
    ranked_recent = sorted(
        recent_candidates.values(),
        key=lambda x: int(x.get("view_count") or 0),
        reverse=True,
    )
    recent_hours = category_window_hours(cfg["video_categories"]["recent_7d"])
    buckets["recent_7d"], checked = collect_top_videos(
        ranked_recent,
        cfg,
        now,
        limit=limits["recent_7d"],
        require_hours=recent_hours,
        min_views=cfg.get("recent_min_views", cfg["min_views"]),
        detail_cache=detail_cache,
        checked=checked,
        max_checks=max_checks,
    )

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


def main() -> int:
    cfg = load_config()
    store = load_store()
    today = now_local().strftime("%Y-%m-%d")

    for batch in store.get("batches", []):
        if batch.get("date") == today:
            count = total_video_count(
                {key: (batch.get("categories") or {}).get(key, {}).get("videos", []) for key in CATEGORY_ORDER}
            ) if batch.get("categories") else len(batch.get("videos", []))
            print(f"今日 ({today}) 已更新，共 {count} 条")
            return 0

    buckets = pick_today_videos(cfg)
    limits = bucket_limits(cfg)
    total = total_video_count(buckets)
    min_total = sum(limits.values())

    for key in CATEGORY_ORDER:
        got = len(buckets[key])
        need = limits[key]
        if got < need:
            label = cfg["video_categories"][key]["label"]
            print(f"警告：{label} 仅 {got} 条（目标 {need}）", file=sys.stderr)

    if total == 0:
        print("未找到符合条件的新视频", file=sys.stderr)
        return 1

    if total < min_total:
        print(f"警告：合计仅 {total} 条（目标 {min_total}）", file=sys.stderr)

    store.setdefault("seen_ids", [])
    store.setdefault("batches", [])
    store["batches"].insert(
        0,
        {
            "date": today,
            "timezone": TZ_NAME,
            "criteria": {
                "min_height": cfg["min_height"],
                "min_views": cfg["min_views"],
                "recent_min_views": cfg.get("recent_min_views", cfg["min_views"]),
                "min_subscribers": cfg["min_subscribers"],
                "video_categories": {
                    key: {
                        "label": cfg["video_categories"][key]["label"],
                        "window": category_window(cfg["video_categories"][key]),
                        "top_count": limits[key],
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
    print(
        f"已写入 {today} 视频 {total} 条"
        f"（全网 Top: {len(buckets['top_views'])}, 一周 Top: {len(buckets['recent_7d'])})"
        f" → {DATA_FILE}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
