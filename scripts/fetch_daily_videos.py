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
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = ROOT / "daily-videos.json"
TZ = ZoneInfo("Asia/Shanghai")

MIN_DAILY = 10
MIN_VIEWS = 8_000
MIN_SUBSCRIBERS = 1_000
MIN_HEIGHT = 1080
SEARCH_PER_QUERY = 18

SEARCH_QUERIES = [
    "ChatGPT tutorial 2026",
    "Claude AI tutorial",
    "Cursor AI editor tutorial",
    "Gemini AI tutorial",
    "DeepSeek AI tutorial",
    "GitHub Copilot tutorial",
    "OpenAI Codex tutorial",
    "AI prompt engineering tutorial",
    "ChatGPT 教程",
    "Claude 教程",
    "Cursor 编程 教程",
    "Kimi AI 教程",
    "通义千问 教程",
    "豆包 AI 教程",
    "大模型 应用 教程",
]

AI_KEYWORDS = re.compile(
    r"(ai|chatgpt|claude|gemini|deepseek|cursor|copilot|codex|kimi|qwen|通义|豆包|"
    r"prompt|llm|gpt|openai|anthropic|大模型|人工智能|智能体|agent)",
    re.I,
)


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


def is_relevant(title: str, description: str) -> bool:
    text = f"{title} {description or ''}"
    return bool(AI_KEYWORDS.search(text))


def max_height(info: dict) -> int:
    heights = [info.get("height") or 0]
    for fmt in info.get("formats") or []:
        if fmt.get("height"):
            heights.append(fmt["height"])
    return max(heights) if heights else 0


def score_video(views: int, subscribers: int) -> float:
    return views * (1 + math.log10(max(subscribers, 1)))


def make_summary(title: str, description: str | None, channel: str) -> str:
    desc = re.sub(r"https?://\S+", "", description or "")
    desc = re.sub(r"\s+", " ", desc).strip()
    desc = re.sub(r"(?i)^(sponsored|ad|广告)\s*", "", desc)
    sentence = re.split(r"[.!?\n|｜]", desc)[0].strip() if desc else ""
    if len(sentence) < 24 or "http" in sentence.lower():
        sentence = (
            f"【{channel}】讲解 AI 工具实战应用，围绕「{title[:48]}」展示操作步骤与使用技巧。"
        )
    if len(sentence) > 130:
        sentence = sentence[:127] + "…"
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
    store["updated_at"] = datetime.now(TZ).isoformat()
    DATA_FILE.write_text(
        json.dumps(store, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def search_candidates() -> dict[str, dict]:
    found: dict[str, dict] = {}
    for query in SEARCH_QUERIES:
        try:
            raw = run_ytdlp(
                [
                    "--dump-json",
                    "--flat-playlist",
                    "--no-download",
                    f"ytsearch{SEARCH_PER_QUERY}:{query}",
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
            if views < MIN_VIEWS or not is_relevant(title, desc):
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
        print(f"detail skip ({video_id}): {exc}", file=sys.stderr)
        return None


def pick_today_videos(store: dict) -> list[dict]:
    seen = set(store.get("seen_ids") or [])
    candidates = search_candidates()
    ranked = sorted(
        candidates.values(),
        key=lambda x: int(x.get("view_count") or 0),
        reverse=True,
    )

    selected: list[dict] = []
    checked = 0
    for item in ranked:
        if len(selected) >= MIN_DAILY:
            break
        vid = item["id"]
        if vid in seen:
            continue
        checked += 1
        if checked > 120:
            break

        detail = fetch_video_detail(vid)
        if not detail:
            continue

        height = max_height(detail)
        if height < MIN_HEIGHT:
            continue

        views = int(detail.get("view_count") or 0)
        subs = int(detail.get("channel_follower_count") or 0)
        if views < MIN_VIEWS or subs < MIN_SUBSCRIBERS:
            continue

        title = detail.get("title") or item.get("title") or ""
        channel = detail.get("channel") or detail.get("uploader") or "未知频道"
        if not is_relevant(title, detail.get("description") or ""):
            continue

        thumb = detail.get("thumbnail") or ""
        if not thumb:
            thumbs = detail.get("thumbnails") or []
            thumb = thumbs[-1]["url"] if thumbs else ""

        selected.append(
            {
                "id": vid,
                "title": title,
                "summary": make_summary(title, detail.get("description"), channel),
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
    store = load_store()
    today = datetime.now(TZ).strftime("%Y-%m-%d")

    for batch in store.get("batches", []):
        if batch.get("date") == today:
            print(f"今日 ({today}) 已更新，共 {len(batch.get('videos', []))} 条")
            return 0

    videos = pick_today_videos(store)
    if len(videos) < MIN_DAILY:
        print(
            f"警告：仅筛选到 {len(videos)} 条（目标 {MIN_DAILY}），仍将写入今日批次",
            file=sys.stderr,
        )

    if not videos:
        print("未找到符合条件的新视频", file=sys.stderr)
        return 1

    store.setdefault("seen_ids", [])
    store.setdefault("batches", [])
    store["batches"].insert(
        0,
        {
            "date": today,
            "timezone": "Asia/Shanghai",
            "criteria": {
                "min_height": MIN_HEIGHT,
                "min_views": MIN_VIEWS,
                "min_subscribers": MIN_SUBSCRIBERS,
                "min_daily": MIN_DAILY,
            },
            "videos": videos,
        },
    )
    for v in videos:
        if v["id"] not in store["seen_ids"]:
            store["seen_ids"].append(v["id"])

    # 保留最近 60 天
    store["batches"] = store["batches"][:60]
    save_store(store)
    print(f"已写入 {today} 视频 {len(videos)} 条 → {DATA_FILE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
