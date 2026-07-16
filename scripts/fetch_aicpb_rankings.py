#!/usr/bin/env python3
"""从 AICPB 原网页抓取排行榜 Top 10，写入 data/rankings.json。"""

from __future__ import annotations

import json
import re
import ssl
import subprocess
from datetime import datetime, timedelta, timezone
from html import unescape
from pathlib import Path
from typing import Any
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "rankings.json"
TZ = timezone(timedelta(hours=8))
USER_AGENT = "BioAI-Lab-RankingsBot/1.0"
TOP_N = 10

BOARDS: list[dict[str, str]] = [
    {
        "id": "global-ai",
        "label": "Global AI",
        "title": "AI产品榜 · Global AI · Website",
        "path": "/ai-rankings/products/global-ai-rankings/websites",
    },
    {
        "id": "china-ai",
        "label": "China AI",
        "title": "AI产品榜 · China AI · Website",
        "path": "/ai-rankings/products/china-ai-rankings/websites",
    },
    {
        "id": "vibe-coding",
        "label": "AI Vibe Coding",
        "title": "AI产品榜 · AI Vibe Coding · Website",
        "path": "/ai-rankings/products/vibe-coding-rankings/websites",
    },
    {
        "id": "video-generators",
        "label": "AI Video Generators",
        "title": "AI产品榜 · AI Video Generators · Website",
        "path": "/ai-rankings/products/ai-video-generators-rankings/websites",
    },
    {
        "id": "ppt",
        "label": "AI PPT Rankings",
        "title": "AI产品榜 · AI PPT · Website",
        "path": "/ai-rankings/products/ai-ppt-rankings",
    },
]

ROW_RE = re.compile(
    r"grid-cols-\[40px_60px.*?"
    r'<div class="flex items-center justify-center">(\d+)</div>.*?'
    r'href="(/product/[^"]+)".*?>'
    r"([^<]+)</a><p class=\"line-clamp-2\">(.*?)</p>.*?"
    r'justify-center">([^<]+)</div>.*?'
    r'z-9">([^<]+)</span>.*?'
    r"width:([\d.]+)%",
    re.S,
)
MONTH_RE = re.compile(r"Website (?:Monthly )?Visits in ([A-Za-z]+ \d{4})")
UPDATED_RE = re.compile(r"Last Updated:\s*([^<]+)")


def ssl_context() -> ssl.SSLContext:
    try:
        import certifi

        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


def fetch_html(url: str) -> str:
    last_err: Exception | None = None
    for attempt in range(1, 4):
        try:
            req = Request(url, headers={"User-Agent": USER_AGENT})
            with urlopen(req, timeout=30, context=ssl_context()) as resp:
                return resp.read().decode("utf-8", "replace")
        except Exception as err:
            last_err = err
            proc = subprocess.run(
                ["curl", "-sL", "--max-time", "30", "-A", USER_AGENT, url],
                capture_output=True,
                text=True,
                check=False,
            )
            if proc.returncode == 0 and proc.stdout:
                return proc.stdout
    raise RuntimeError(f"fetch failed: {url}") from last_err


def clean_text(raw: str) -> str:
    text = unescape(re.sub(r"<[^>]+>", "", raw or ""))
    return re.sub(r"\s+", " ", text).strip()


def parse_board(meta: dict[str, str]) -> dict[str, Any]:
    base = "https://www.aicpb.com"
    source_url = f"{base}{meta['path']}"
    html = fetch_html(source_url)
    month = MONTH_RE.search(html) or re.search(r"— ([A-Za-z]+ \d{4})", html)
    month_label = month.group(1) if month else ""

    items: list[dict[str, Any]] = []
    for rank_s, path, name, desc, visits, mom, bar in ROW_RE.findall(html)[:TOP_N]:
        items.append(
            {
                "rank": int(rank_s),
                "name": clean_text(name),
                "description": clean_text(desc),
                "visits": clean_text(visits),
                "mom": clean_text(mom),
                "mom_bar_pct": round(float(bar), 2),
                "url": f"{base}{path}",
                "source": "AICPB",
            }
        )

    if len(items) < TOP_N:
        raise RuntimeError(f"{meta['id']}: expected {TOP_N} rows, got {len(items)}")

    return {
        "id": meta["id"],
        "label": meta["label"],
        "title": meta["title"],
        "subtitle": "根据 Website 访问量排名",
        "metric": "Website Visits",
        "month": month_label,
        "source_url": source_url,
        "items": items,
    }


def main() -> None:
    boards = [parse_board(meta) for meta in BOARDS]
    updated_at = datetime.now(TZ).strftime("%Y-%m-%d")
    month_label = boards[0]["month"] if boards else ""
    month_key = ""
    if month_label:
        try:
            month_key = datetime.strptime(month_label, "%b %Y").strftime("%Y-%m")
        except ValueError:
            month_key = updated_at[:7]

    payload = {
        "month": month_key or updated_at[:7],
        "month_label": month_label,
        "updated_at": updated_at,
        "cadence": "daily",
        "title": "2026 AI 工具排行榜（每日更新）",
        "lead": (
            "每天同步 AICPB 原网页榜单，仅展示各榜 Top 10。"
            "来源：Global AI、China AI、AI Vibe Coding、AI Video Generators、AI PPT Rankings。"
        ),
        "methodology": [
            "来源：AICPB（AI产品榜）官方页面，仅引用原文排名、访问量与月环比。",
            "展示：每个专题榜仅保留前 10 名；完整榜单请点击「查看全部产品」跳转原网页。",
            "更新：每日同步；若官方未更新则保留最近一次抓取结果。",
        ],
        "boards": boards,
        "highlights": [
            {
                "medal": "🌍",
                "name": boards[0]["items"][0]["name"],
                "dimension": f"{boards[0]['label']} Top 1",
                "url": boards[0]["items"][0]["url"],
            },
            {
                "medal": "🇨🇳",
                "name": boards[1]["items"][0]["name"],
                "dimension": f"{boards[1]['label']} Top 1",
                "url": boards[1]["items"][0]["url"],
            },
            {
                "medal": "💻",
                "name": boards[2]["items"][0]["name"],
                "dimension": f"{boards[2]['label']} Top 1",
                "url": boards[2]["items"][0]["url"],
            },
        ],
    }

    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"✓ {OUT} ({len(boards)} 榜 × Top {TOP_N})")


if __name__ == "__main__":
    main()
