#!/usr/bin/env python3
"""每日抓取 AI 应用相关 YouTube 视频（1080p+，按播放量与订阅数筛选）。"""

from __future__ import annotations

import json
import math
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


def score_video(views: int, subscribers: int) -> float:
    return views * (1 + math.log10(max(subscribers, 1)))


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


def load_store() -> dict:
    if DATA_FILE.exists():
        return json.loads(DATA_FILE.read_text(encoding="utf-8"))
    return {"seen_ids": [], "batches": []}


def save_store(store: dict) -> None:
    if TZ:
        store["updated_at"] = datetime.now(TZ).isoformat()
    else:
        store["updated_at"] = datetime.utcnow().isoformat() + "Z"
    DATA_FILE.write_text(json.dumps(store, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def log_reject(reason: str, video_id: str, extra: str = "") -> None:
    msg = f"reject [{reason}] {video_id}"
    if extra:
        msg += f" — {extra}"
    print(msg, file=sys.stderr)


def search_candidates(cfg: dict) -> dict[str, dict]:
    found: dict[str, dict] = {}
    min_views = cfg["min_views"]
    for query in cfg["search_queries"]:
        try:
            raw = run_ytdlp(
                [
                    "--dump-json",
                    "--flat-playlist",
                    "--no-download",
                    f"ytsearch{cfg['search_per_query']}:{query}",
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
            if views < min_views:
                log_reject("low_views_search", vid, f"views={views}")
                continue
            if not is_relevant(title, desc, cfg):
                log_reject("not_relevant_search", vid, title[:60])
                continue
            prev = found.get(vid)
            if not prev or views > prev.get("view_count", 0):
                found[vid] = item
    return found


def fetch_video_detail(video_id: str) -> dict | None:
    url = f"https://www.youtube.com/watch?v={video_id}"
    try:
        raw = run_ytdlp(["--dump-json", "--no-download", url], timeout=90)
        return json.loads(raw)
    except Exception as exc:
        log_reject("detail_fetch_failed", video_id, str(exc))
        return None


def pick_today_videos(store: dict, cfg: dict) -> list[dict]:
    seen = set(store.get("seen_ids") or [])
    candidates = search_candidates(cfg)
    ranked = sorted(candidates.values(), key=lambda x: int(x.get("view_count") or 0), reverse=True)

    selected: list[dict] = []
    checked = 0
    for item in ranked:
        if len(selected) >= cfg["min_daily"]:
            break
        vid = item["id"]
        if vid in seen:
            log_reject("already_seen", vid)
            continue
        checked += 1
        if checked > cfg.get("max_detail_checks", 120):
            break

        detail = fetch_video_detail(vid)
        if not detail:
            continue

        height = max_height(detail)
        if height < cfg["min_height"]:
            log_reject("low_resolution", vid, f"height={height}")
            continue

        views = int(detail.get("view_count") or 0)
        subs = int(detail.get("channel_follower_count") or 0)
        if views < cfg["min_views"]:
            log_reject("low_views_detail", vid, f"views={views}")
            continue
        if subs < cfg["min_subscribers"]:
            log_reject("low_subscribers", vid, f"subs={subs}")
            continue

        title = detail.get("title") or item.get("title") or ""
        channel = detail.get("channel") or detail.get("uploader") or "未知频道"
        if not is_relevant(title, detail.get("description") or "", cfg):
            log_reject("not_relevant_detail", vid, title[:60])
            continue

        thumb = detail.get("thumbnail") or ""
        if not thumb:
            thumbs = detail.get("thumbnails") or []
            thumb = thumbs[-1]["url"] if thumbs else ""

        selected.append(
            {
                "id": vid,
                "title": title,
                "summary": make_summary(title, detail.get("description"), channel, cfg),
                "url": f"https://www.youtube.com/watch?v={vid}",
                "thumbnail": thumb,
                "channel": channel,
                "subscribers": subs,
                "views": views,
                "duration": format_duration(detail.get("duration")),
                "max_height": height,
                "score": round(score_video(views, subs), 2),
            }
        )

    selected.sort(key=lambda v: v["score"], reverse=True)
    return selected


def main() -> int:
    cfg = load_config()
    store = load_store()
    today = datetime.now(TZ).strftime("%Y-%m-%d") if TZ else datetime.utcnow().strftime("%Y-%m-%d")

    for batch in store.get("batches", []):
        if batch.get("date") == today:
            print(f"今日 ({today}) 已更新，共 {len(batch.get('videos', []))} 条")
            return 0

    videos = pick_today_videos(store, cfg)
    if len(videos) < cfg["min_daily"]:
        print(f"警告：仅筛选到 {len(videos)} 条（目标 {cfg['min_daily']}）", file=sys.stderr)

    if not videos:
        print("未找到符合条件的新视频", file=sys.stderr)
        return 1

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
                "min_subscribers": cfg["min_subscribers"],
                "min_daily": cfg["min_daily"],
            },
            "videos": videos,
        },
    )
    for v in videos:
        if v["id"] not in store["seen_ids"]:
            store["seen_ids"].append(v["id"])

    store["batches"] = store["batches"][:60]
    save_store(store)
    print(f"已写入 {today} 视频 {len(videos)} 条 → {DATA_FILE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
