#!/usr/bin/env python3
"""收集近期升温的 AI 开源项目（非纯 Star 榜）。

数据源：
  1. GitHub Trending HTML（daily / weekly）
  2. GitHub Search API（按方向 query + 近期 pushed）

每个方向最多 top3，写入 data/oss-projects.json，并同步 site.json → oss_frameworks。
"""

from __future__ import annotations

import json
import math
import os
import re
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote, urlencode

import yaml

from fetch_resilience import atomic_write_json, fetch_url_bytes, load_json

ROOT = Path(__file__).resolve().parents[1]
CONFIG_FILE = ROOT / "config" / "oss-fetch.yaml"
OUT_FILE = ROOT / "data" / "oss-projects.json"
SITE_FILE = ROOT / "data" / "site.json"
TZ = timezone(timedelta(hours=8))
USER_AGENT = "BioAI-Lab-OssBot/1.0"


def now_cst() -> datetime:
    return datetime.now(TZ)


def load_config() -> dict[str, Any]:
    return yaml.safe_load(CONFIG_FILE.read_text(encoding="utf-8"))


def github_headers() -> dict[str, str]:
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def fetch_bytes(url: str, *, api: bool = False) -> bytes | None:
    headers = github_headers() if api else None
    return fetch_url_bytes(
        url,
        headers=headers,
        timeout=30,
        max_attempts=4,
        user_agent=USER_AGENT,
    )


def parse_iso(raw: str | None) -> datetime | None:
    if not raw:
        return None
    try:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(TZ)
    except ValueError:
        return None


def strip_text(text: str) -> str:
    text = re.sub(r"\s+", " ", text or "").strip()
    return text


def truncate(text: str, max_len: int) -> str:
    text = strip_text(text)
    if len(text) <= max_len:
        return text
    return text[: max_len - 1] + "…"


def repo_key(full_name: str) -> str:
    return strip_text(full_name).lower()


# --- Trending HTML -----------------------------------------------------------

_TRENDING_HREF = re.compile(
    r'<h2[^>]*>\s*<a[^>]+href="/([^"/]+/[^"/]+)"',
    re.I,
)
_TRENDING_DESC = re.compile(
    r'class="[^"]*col-9[^"]*color-fg-muted[^"]*"[^>]*>\s*<p[^>]*>(.*?)</p>',
    re.I | re.S,
)
_ARTICLE = re.compile(r"<article[\s\S]*?</article>", re.I)


def parse_trending_html(html: str, since: str) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for rank, block in enumerate(_ARTICLE.findall(html), start=1):
        m = _TRENDING_HREF.search(block)
        if not m:
            continue
        full_name = m.group(1).strip()
        desc_m = _TRENDING_DESC.search(block)
        desc = strip_text(re.sub(r"<[^>]+>", "", desc_m.group(1))) if desc_m else ""
        items.append(
            {
                "full_name": full_name,
                "description": desc,
                "trending_since": since,
                "trending_rank": rank,
                "source": f"trending:{since}",
            }
        )
    return items


def collect_trending(cfg: dict[str, Any]) -> list[dict[str, Any]]:
    tcfg = cfg.get("trending") or {}
    if not tcfg.get("enabled", True):
        return []
    out: list[dict[str, Any]] = []
    for since in tcfg.get("since") or ["daily", "weekly"]:
        params = {"since": since}
        spoken = (tcfg.get("spoken_language_code") or "").strip()
        if spoken:
            params["spoken_language_code"] = spoken
        url = "https://github.com/trending?" + urlencode(params)
        raw = fetch_bytes(url)
        if not raw:
            print(f"trending fetch failed: {since}", file=sys.stderr)
            continue
        batch = parse_trending_html(raw.decode("utf-8", errors="replace"), since)
        print(f"trending {since}: {len(batch)} repos")
        out.extend(batch)
        time.sleep(0.4)
    return out


# --- Search API --------------------------------------------------------------

def search_repos(query: str, *, sort: str, per_page: int) -> list[dict[str, Any]]:
    params = urlencode(
        {
            "q": query,
            "sort": sort,
            "order": "desc",
            "per_page": str(per_page),
        },
        quote_via=quote,
        safe="",
    )
    # GitHub search expects spaces as +
    params = params.replace("%20", "+")
    url = f"https://api.github.com/search/repositories?{params}"
    raw = fetch_bytes(url, api=True)
    if not raw:
        return []
    try:
        payload = json.loads(raw.decode())
    except json.JSONDecodeError:
        return []
    return list(payload.get("items") or [])


def collect_search(cfg: dict[str, Any], directions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    scfg = cfg.get("search") or {}
    if not scfg.get("enabled", True):
        return []
    pushed_days = int(scfg.get("pushed_within_days", 30))
    pushed = (now_cst() - timedelta(days=pushed_days)).strftime("%Y-%m-%d")
    sort = scfg.get("sort", "updated")
    per_page = int(scfg.get("per_page", 15))
    min_stars = int(cfg.get("min_stars", 80))
    out: list[dict[str, Any]] = []
    for direction in directions:
        did = direction["id"]
        for base_q in direction.get("search_queries") or []:
            query = f"{base_q} pushed:>{pushed} stars:>{min_stars}"
            if cfg.get("exclude_forks", True):
                query += " fork:false"
            if cfg.get("exclude_archived", True):
                query += " archived:false"
            repos = search_repos(query, sort=sort, per_page=per_page)
            print(f"search [{did}] hits={len(repos)} · {base_q[:48]}…")
            for repo in repos:
                out.append(
                    {
                        "repo": repo,
                        "direction_hint": did,
                        "source": "search",
                    }
                )
            time.sleep(0.8)
    return out


def hydrate_repo(full_name: str) -> dict[str, Any] | None:
    url = f"https://api.github.com/repos/{full_name}"
    raw = fetch_bytes(url, api=True)
    if not raw:
        return None
    try:
        return json.loads(raw.decode())
    except json.JSONDecodeError:
        return None


# --- Classify + score --------------------------------------------------------

def classify_direction(
    *,
    full_name: str,
    description: str,
    topics: list[str],
    directions: list[dict[str, Any]],
    hint: str | None = None,
) -> str | None:
    """按名称/描述优先于 topics 匹配；更具体方向优先。"""
    priority = {
        "skills": 0,
        "memory": 1,
        "mcp": 2,
        "coding_agent": 3,
        "agent_harness": 4,
        "agent": 5,
    }
    topic_blob = " ".join(topics)
    scored: list[tuple[int, int, str]] = []
    for d in directions:
        pat = d.get("match")
        if not pat:
            continue
        strength = 0
        if re.search(pat, full_name) or re.search(pat, description or ""):
            strength = 2
        elif topic_blob and re.search(pat, topic_blob) and hint == d["id"]:
            # topics 噪声大：仅在 Search 方向提示一致时采用
            strength = 1
        if strength:
            scored.append((strength, -priority.get(d["id"], 99), d["id"]))
    if not scored:
        return None
    scored.sort(reverse=True)
    best_strength = scored[0][0]
    top = [row for row in scored if row[0] == best_strength]
    ids = [row[2] for row in top]
    if hint and hint in ids:
        return hint
    return ids[0]


def heat_score(
    *,
    stars: int,
    created_at: datetime | None,
    pushed_at: datetime | None,
    trending_daily_rank: int | None,
    trending_weekly_rank: int | None,
    from_search: bool,
) -> float:
    """加热分：Trending 权重最高；辅以星速与近期活跃。不按绝对 Star 排名。"""
    score = 0.0
    if trending_daily_rank is not None:
        score += 120.0 - min(trending_daily_rank, 25) * 3.0
    if trending_weekly_rank is not None:
        score += 60.0 - min(trending_weekly_rank, 25) * 1.5
    age_days = 30.0
    if created_at:
        age_days = max((now_cst() - created_at).total_seconds() / 86400.0, 1.0)
    # 星速（对数压缩），避免老牌巨仓碾压
    score += min(40.0, math.log1p(stars / age_days) * 8.0)
    if pushed_at:
        days_since_push = max((now_cst() - pushed_at).total_seconds() / 86400.0, 0.0)
        if days_since_push <= 7:
            score += 18.0
        elif days_since_push <= 30:
            score += 8.0
    if from_search and trending_daily_rank is None and trending_weekly_rank is None:
        score += 6.0
    return round(score, 2)


def merge_candidates(
    trending: list[dict[str, Any]],
    search_hits: list[dict[str, Any]],
    directions: list[dict[str, Any]],
    cfg: dict[str, Any],
) -> dict[str, dict[str, Any]]:
    """full_name → merged candidate."""
    bucket: dict[str, dict[str, Any]] = {}

    def ensure(full_name: str) -> dict[str, Any]:
        key = repo_key(full_name)
        if key not in bucket:
            bucket[key] = {
                "full_name": full_name,
                "description": "",
                "topics": [],
                "stars": 0,
                "created_at": None,
                "pushed_at": None,
                "sources": set(),
                "trending_daily_rank": None,
                "trending_weekly_rank": None,
                "direction_hint": None,
                "api": None,
            }
        return bucket[key]

    for item in trending:
        row = ensure(item["full_name"])
        row["sources"].add(item["source"])
        if item.get("description") and not row["description"]:
            row["description"] = item["description"]
        since = item.get("trending_since")
        rank = item.get("trending_rank")
        if since == "daily":
            row["trending_daily_rank"] = min(rank, row["trending_daily_rank"] or rank)
        elif since == "weekly":
            row["trending_weekly_rank"] = min(rank, row["trending_weekly_rank"] or rank)

    for hit in search_hits:
        repo = hit.get("repo") or {}
        full_name = repo.get("full_name") or ""
        if not full_name:
            continue
        row = ensure(full_name)
        row["sources"].add("search")
        row["api"] = repo
        row["stars"] = int(repo.get("stargazers_count") or 0)
        row["description"] = strip_text(repo.get("description") or row["description"])
        row["topics"] = list(repo.get("topics") or [])
        row["created_at"] = parse_iso(repo.get("created_at"))
        row["pushed_at"] = parse_iso(repo.get("pushed_at"))
        if hit.get("direction_hint") and not row["direction_hint"]:
            row["direction_hint"] = hit["direction_hint"]

    # hydrate trending-only repos missing API fields
    need_hydrate = [
        row for row in bucket.values() if row["api"] is None and (row["trending_daily_rank"] or row["trending_weekly_rank"])
    ]
    for i, row in enumerate(need_hydrate):
        api = hydrate_repo(row["full_name"])
        if not api:
            continue
        row["api"] = api
        row["stars"] = int(api.get("stargazers_count") or 0)
        row["description"] = strip_text(api.get("description") or row["description"])
        row["topics"] = list(api.get("topics") or [])
        row["created_at"] = parse_iso(api.get("created_at"))
        row["pushed_at"] = parse_iso(api.get("pushed_at"))
        if i < len(need_hydrate) - 1:
            time.sleep(0.35)

    min_stars = int(cfg.get("min_stars", 80))
    classified: dict[str, dict[str, Any]] = {}
    for key, row in bucket.items():
        if cfg.get("exclude_archived") and (row.get("api") or {}).get("archived"):
            continue
        if cfg.get("exclude_forks") and (row.get("api") or {}).get("fork"):
            continue
        stars = int(row.get("stars") or 0)
        # trending 可豁免 min_stars，避免漏掉刚起飞的仓
        if stars < min_stars and not (row["trending_daily_rank"] or row["trending_weekly_rank"]):
            continue
        category = classify_direction(
            full_name=row["full_name"],
            description=row.get("description") or "",
            topics=row.get("topics") or [],
            directions=directions,
            hint=row.get("direction_hint"),
        )
        if not category:
            continue
        score = heat_score(
            stars=stars,
            created_at=row.get("created_at"),
            pushed_at=row.get("pushed_at"),
            trending_daily_rank=row.get("trending_daily_rank"),
            trending_weekly_rank=row.get("trending_weekly_rank"),
            from_search="search" in row["sources"],
        )
        name = row["full_name"].split("/")[-1]
        api = row.get("api") or {}
        if api.get("name"):
            name = api["name"]
        classified[key] = {
            "repo": row["full_name"],
            "name": name,
            "stars": stars,
            "category": category,
            "summary": truncate(row.get("description") or row["full_name"], int(cfg.get("summary_max_length", 120))),
            "heat_score": score,
            "sources": sorted(row["sources"]),
            "trending_daily_rank": row.get("trending_daily_rank"),
            "trending_weekly_rank": row.get("trending_weekly_rank"),
            "pushed_at": row["pushed_at"].isoformat() if row.get("pushed_at") else None,
        }
    return classified


def pick_top(classified: dict[str, dict[str, Any]], directions: list[dict[str, Any]], max_n: int) -> list[dict[str, Any]]:
    by_cat: dict[str, list[dict[str, Any]]] = {d["id"]: [] for d in directions}
    for item in classified.values():
        by_cat.setdefault(item["category"], []).append(item)
    picked: list[dict[str, Any]] = []
    for d in directions:
        cat = d["id"]
        rows = sorted(by_cat.get(cat) or [], key=lambda x: (-x["heat_score"], -x["stars"]))
        for rank, row in enumerate(rows[:max_n], start=1):
            item = dict(row)
            item["rank"] = rank
            picked.append(item)
        print(f"pick [{cat}] {min(len(rows), max_n)}/{len(rows)}")
    return picked


def sync_site_json(items: list[dict[str, Any]]) -> None:
    site = load_json(SITE_FILE)
    if not isinstance(site, dict):
        raise RuntimeError(f"无法读取 {SITE_FILE}")
    site["oss_frameworks"] = [
        {
            "repo": it["repo"],
            "name": it["name"],
            "stars": it["stars"],
            "category": it["category"],
            "summary": it["summary"],
            "heat_score": it["heat_score"],
            "sources": it.get("sources") or [],
            "rank": it.get("rank"),
        }
        for it in items
    ]
    atomic_write_json(SITE_FILE, site)


def main() -> int:
    cfg = load_config()
    directions = list(cfg.get("directions") or [])
    if not directions:
        print("config/oss-fetch.yaml 缺少 directions", file=sys.stderr)
        return 1

    trending = collect_trending(cfg)
    search_hits = collect_search(cfg, directions)
    classified = merge_candidates(trending, search_hits, directions, cfg)
    max_n = int(cfg.get("max_per_direction", 3))
    picked = pick_top(classified, directions, max_n)

    if len(picked) < max(3, len(directions)):
        print(
            f"警告：仅选出 {len(picked)} 条（期望约 {len(directions) * max_n}），将尽量写入",
            file=sys.stderr,
        )

    payload = {
        "updated_at": now_cst().isoformat(),
        "window": {
            "max_per_direction": max_n,
            "sources": ["github_trending", "github_search"],
            "focus": [d["label"] for d in directions],
        },
        "items": picked,
    }

    previous = load_json(OUT_FILE)
    if len(picked) == 0 and isinstance(previous, dict) and previous.get("items"):
        print("错误：本次无结果，保留上一版 oss-projects.json", file=sys.stderr)
        return 1

    atomic_write_json(OUT_FILE, payload)
    sync_site_json(picked)
    print(f"wrote {OUT_FILE.relative_to(ROOT)} · {len(picked)} items")
    print(f"synced {SITE_FILE.relative_to(ROOT)} → oss_frameworks")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
