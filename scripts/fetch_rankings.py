#!/usr/bin/env python3
"""抓取多源 AI 排行榜 Top 10，写入 data/rankings.json。

仅展示三榜：
- AICPB（Global AI Website 访问量）
- LMSYS Chatbot Arena Elo
- Artificial Analysis Intelligence Index
"""

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

AICPB_BOARD: dict[str, str] = {
    "id": "aicpb",
    "label": "AICPB",
    "title": "AICPB · Global AI · Website",
    "path": "/ai-rankings/products/global-ai-rankings/websites",
}

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

ARENA_API = "https://api.wulong.dev/arena-ai-leaderboards/v1/leaderboard?name=text"
AA_PAGE = "https://artificialanalysis.ai/leaderboards/models"


def ssl_context() -> ssl.SSLContext:
    try:
        import certifi

        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


def fetch_text(url: str, timeout: int = 40) -> str:
    last_err: Exception | None = None
    for _ in range(3):
        try:
            req = Request(url, headers={"User-Agent": USER_AGENT})
            with urlopen(req, timeout=timeout, context=ssl_context()) as resp:
                return resp.read().decode("utf-8", "replace")
        except Exception as err:
            last_err = err
            proc = subprocess.run(
                ["curl", "-sL", f"--max-time={timeout}", "-A", USER_AGENT, url],
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


def format_votes(n: int | float | None) -> str:
    if n is None:
        return "—"
    val = float(n)
    if val >= 1_000_000:
        return f"{val / 1_000_000:.1f}M".rstrip("0").rstrip(".") + " votes"
    if val >= 1_000:
        return f"{val / 1_000:.1f}K".rstrip("0").rstrip(".") + " votes"
    return f"{int(val)} votes"


def parse_aicpb_board(meta: dict[str, str]) -> dict[str, Any]:
    base = "https://www.aicpb.com"
    source_url = f"{base}{meta['path']}"
    html = fetch_text(source_url)
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
        "subtitle": "Global AI · 根据 Website 访问量排名",
        "metric": "Website Visits",
        "month": month_label,
        "source_url": source_url,
        "source_name": "AICPB",
        "columns": {"name": "产品名", "primary": "访问量", "secondary": "月环比"},
        "show_bar": True,
        "items": items,
    }


def parse_lmsys_arena() -> dict[str, Any]:
    payload = json.loads(fetch_text(ARENA_API))
    models = payload.get("models") or []
    meta = payload.get("meta") or {}
    if len(models) < TOP_N:
        raise RuntimeError(f"lmsys-arena: expected ≥{TOP_N}, got {len(models)}")

    month = meta.get("last_updated") or ""
    source_url = meta.get("source_url") or "https://arena.ai/leaderboard/text"
    items: list[dict[str, Any]] = []
    for row in models[:TOP_N]:
        score = row.get("score")
        vendor = row.get("vendor") or ""
        name = row.get("model") or ""
        items.append(
            {
                "rank": int(row.get("rank") or len(items) + 1),
                "name": name,
                "description": vendor,
                "visits": str(int(score)) if score is not None else "—",
                "mom": format_votes(row.get("votes")),
                "mom_bar_pct": 0,
                "url": source_url,
                "source": "LMSYS Arena",
            }
        )

    return {
        "id": "lmsys-arena",
        "label": "LMSYS Chatbot Arena Elo",
        "title": "LMSYS Chatbot Arena Elo",
        "subtitle": "人类盲测对战 Elo（Arena AI / LMSYS）",
        "metric": "Arena Elo",
        "month": month,
        "source_url": source_url,
        "source_name": "LMSYS Chatbot Arena",
        "columns": {"name": "模型", "primary": "Arena Elo", "secondary": "Votes"},
        "show_bar": False,
        "items": items,
    }


def parse_artificial_analysis() -> dict[str, Any]:
    html = fetch_text(AA_PAGE, timeout=60)
    chunks = re.findall(r'self\.__next_f\.push\(\[1,"((?:\\.|[^"\\])*)"\]\)', html)
    candidates = [c for c in chunks if "intelligenceIndex" in c and "shortName" in c]
    if not candidates:
        raise RuntimeError("artificial-analysis: no RSC payload with intelligenceIndex")

    text = bytes(max(candidates, key=len), "utf-8").decode("unicode_escape")
    parsed: list[dict[str, Any]] = []
    for m in re.finditer(r'"shortName":"([^"]+)","slug":"([^"]+)"', text):
        snip = text[m.start() : m.start() + 3000]
        score_m = re.search(r'"intelligenceIndex":([0-9.]+|null)', snip)
        creator_m = re.search(r'"modelCreatorName":"([^"]+)"', snip)
        if not score_m or score_m.group(1) == "null":
            continue
        parsed.append(
            {
                "name": m.group(1),
                "slug": m.group(2),
                "creator": creator_m.group(1) if creator_m else "",
                "score": float(score_m.group(1)),
            }
        )

    seen: set[str] = set()
    uniq: list[dict[str, Any]] = []
    for row in sorted(parsed, key=lambda x: -x["score"]):
        if row["slug"] in seen:
            continue
        seen.add(row["slug"])
        uniq.append(row)
    if len(uniq) < TOP_N:
        raise RuntimeError(f"artificial-analysis: expected ≥{TOP_N}, got {len(uniq)}")

    source_url = AA_PAGE
    items: list[dict[str, Any]] = []
    for i, row in enumerate(uniq[:TOP_N], start=1):
        items.append(
            {
                "rank": i,
                "name": row["name"],
                "description": row["creator"],
                "visits": f"{row['score']:.1f}",
                "mom": row["creator"] or "—",
                "mom_bar_pct": 0,
                "url": f"https://artificialanalysis.ai/models/{row['slug']}",
                "source": "Artificial Analysis",
            }
        )

    month = datetime.now(TZ).strftime("%b %Y")
    return {
        "id": "artificial-analysis",
        "label": "Artificial Analysis Intelligence Index",
        "title": "Artificial Analysis Intelligence Index",
        "subtitle": "独立基准合成的 Intelligence Index",
        "metric": "Intelligence Index",
        "month": month,
        "source_url": source_url,
        "source_name": "Artificial Analysis",
        "columns": {"name": "模型", "primary": "Intelligence", "secondary": "厂商"},
        "show_bar": False,
        "items": items,
    }


def enrich_legacy_boards(boards: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """为旧 AICPB 榜补齐 columns 字段（兼容手工编辑）。"""
    out = []
    for board in boards:
        b = dict(board)
        b.setdefault("source_name", "AICPB")
        b.setdefault(
            "columns",
            {"name": "产品名", "primary": "访问量", "secondary": "月环比"},
        )
        b.setdefault("show_bar", True)
        out.append(b)
    return out


def main() -> None:
    aicpb = parse_aicpb_board(AICPB_BOARD)
    arena = parse_lmsys_arena()
    aa = parse_artificial_analysis()
    boards = enrich_legacy_boards([aicpb, arena, aa])

    updated_at = datetime.now(TZ).strftime("%Y-%m-%d")
    month_label = aicpb.get("month") or ""
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
            "同步 AICPB、LMSYS Chatbot Arena Elo，"
            "以及 Artificial Analysis Intelligence Index；各榜展示 Top 10。"
        ),
        "methodology": [
            "AICPB：引用 Global AI Website 访问量、排名与月环比。",
            "LMSYS Chatbot Arena Elo：引用文本对战 Arena Elo 与投票数。",
            "Artificial Analysis Intelligence Index：引用公开榜单分数与厂商信息。",
            "展示：仅上述三榜，各保留前 10 名；完整榜单请跳转原文。",
            "更新：每日同步；若某一源失败则整次抓取失败，保留仓库内上一版数据。",
        ],
        "boards": boards,
        "highlights": [
            {
                "medal": "🌍",
                "name": aicpb["items"][0]["name"],
                "dimension": "AICPB Top 1",
                "url": aicpb["items"][0]["url"],
            },
            {
                "medal": "🏟️",
                "name": arena["items"][0]["name"],
                "dimension": "LMSYS Chatbot Arena Elo Top 1",
                "url": arena["items"][0]["url"],
            },
            {
                "medal": "📈",
                "name": aa["items"][0]["name"],
                "dimension": "Artificial Analysis Intelligence Index Top 1",
                "url": aa["items"][0]["url"],
            },
        ],
    }

    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"✓ {OUT} ({len(boards)} 榜 × Top {TOP_N})")


if __name__ == "__main__":
    main()
