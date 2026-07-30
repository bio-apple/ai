"""新闻去重：同标题或同 URL 只保留最新 published_at。

供 fetch_ai_news / validate_ci 共用，保证写入与门禁同一规则。
"""

from __future__ import annotations

import re
import unicodedata
from typing import Any

# 标题尾部常见源站名（OG/RSS 常写成「标题 | OpenAI」）
_KNOWN_TRAILING_SOURCES = (
    "OpenAI",
    "Anthropic",
    "量子位",
    "机器之心",
    "新智元",
    "智源社区",
    "智源",
    "Google DeepMind",
    "DeepMind",
    "Google AI",
    "NVIDIA AI",
    "NVIDIA Blog",
    "Hugging Face",
    "HuggingFace",
    "TechCrunch",
    "The Verge",
    "VentureBeat",
    "arXiv cs.AI",
    "arXiv",
    "GitHub Trending",
    "GitHub",
)

_TRAILING_SEP = r"[\s\|/·•・\-–—\uFF5C\uFF0F\uFF1A:：]+"


def normalize_news_title(title: str) -> str:
    text = unicodedata.normalize("NFKC", title or "")
    text = text.replace("\u3000", " ")
    return " ".join(text.split()).casefold()


def _source_aliases(source: str) -> list[str]:
    raw = unicodedata.normalize("NFKC", source or "").strip()
    if not raw:
        return []
    aliases = {raw}
    parts = raw.split()
    if len(parts) > 1:
        aliases.add(parts[0])
        aliases.add(parts[-1])
    # 去掉常见后缀词
    for suffix in (" Blog", " News", " 社区"):
        if raw.endswith(suffix) and len(raw) > len(suffix) + 1:
            aliases.add(raw[: -len(suffix)].strip())
    return sorted(aliases, key=len, reverse=True)


def strip_trailing_source(title: str, source: str = "") -> str:
    """去掉标题尾部粘连的源站名（「… | OpenAI」「…量子位」），留给独立 badge。"""
    # 不整串 NFKC：以免把全角「！」等改成半角，改变展示文案
    text = (title or "").replace("\u3000", " ").strip()
    if not text:
        return text

    candidates: list[str] = []
    seen: set[str] = set()
    for alias in [*_source_aliases(source), *_KNOWN_TRAILING_SOURCES]:
        key = alias.casefold()
        if not alias or key in seen:
            continue
        seen.add(key)
        candidates.append(alias)

    changed = True
    while changed:
        changed = False
        for alias in candidates:
            # 带分隔符：「Title | OpenAI」「Title - 量子位」
            pat_sep = re.compile(
                rf"(?:{_TRAILING_SEP}){re.escape(alias)}\s*$",
                re.IGNORECASE,
            )
            match = pat_sep.search(text)
            if match:
                text = text[: match.start()].rstrip(" \t|-·•–—｜：:/")
                changed = True
                break

            # 中文源站无分隔符粘连：「……量子位」
            if re.search(r"[\u4e00-\u9fff]", alias):
                pat_cjk = re.compile(rf"(?<=[\u4e00-\u9fff\W]){re.escape(alias)}\s*$")
                match = pat_cjk.search(text)
                if match:
                    text = text[: match.start()].rstrip(" \t|-·•–—｜：:/")
                    changed = True
                    break

            # 英文源站：仅当前一字符为空白/标点时剥离（避免误伤 SomethingOpenAI）
            if re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9 .&+-]*", alias):
                pat_lat = re.compile(
                    rf"(?<=[\s\|/·•・\-–—\uFF5C:：]){re.escape(alias)}\s*$",
                    re.IGNORECASE,
                )
                match = pat_lat.search(text)
                if match:
                    text = text[: match.start()].rstrip(" \t|-·•–—｜：:/")
                    changed = True
                    break

    return text.strip()


def clean_news_item_title(item: dict[str, Any]) -> dict[str, Any]:
    """返回标题已剥离尾部源站名的浅拷贝。"""
    title = str(item.get("title") or "")
    source = str(item.get("source") or "")
    cleaned = strip_trailing_source(title, source)
    if cleaned == title:
        return item
    out = dict(item)
    out["title"] = cleaned
    return out


def clean_news_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [clean_news_item_title(item) for item in items]


def news_recency_key(item: dict[str, Any]) -> str:
    return str(item.get("published_at") or "")


def dedupe_news_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """按 published_at 新→旧扫描；标题或 URL 撞车则丢弃旧条。"""
    seen_url: set[str] = set()
    seen_title: set[str] = set()
    unique: list[dict[str, Any]] = []
    for item in sorted(items, key=news_recency_key, reverse=True):
        url = str(item.get("url") or "").strip()
        title_key = normalize_news_title(str(item.get("title") or ""))
        if url and url in seen_url:
            continue
        if title_key and title_key in seen_title:
            continue
        if url:
            seen_url.add(url)
        if title_key:
            seen_title.add(title_key)
        unique.append(item)
    return unique


def find_news_duplicates(items: list[dict[str, Any]]) -> list[str]:
    """返回人类可读的重复描述；无重复则空列表。"""
    by_title: dict[str, list[str]] = {}
    by_url: dict[str, list[str]] = {}
    for item in items:
        title_key = normalize_news_title(str(item.get("title") or ""))
        url = str(item.get("url") or "").strip()
        label = f"{item.get('published_at') or '?'} | {url}"
        if title_key:
            by_title.setdefault(title_key, []).append(label)
        if url:
            by_url.setdefault(url, []).append(label)
    problems: list[str] = []
    for key, rows in by_title.items():
        if len(rows) > 1:
            problems.append(f"标题重复「{key}」×{len(rows)}: " + " ;; ".join(rows))
    for key, rows in by_url.items():
        if len(rows) > 1:
            problems.append(f"URL 重复 {key} ×{len(rows)}")
    return problems


def assert_news_unique(items: list[dict[str, Any]]) -> None:
    problems = find_news_duplicates(items)
    if problems:
        raise ValueError("新闻去重失败：\n- " + "\n- ".join(problems))


def normalize_repo_url(url: str) -> str:
    text = (url or "").strip().rstrip("/")
    lower = text.lower()
    if lower.startswith("http://"):
        text = "https://" + text[7:]
        lower = text.lower()
    if lower.startswith("https://www."):
        text = "https://" + text[len("https://www.") :]
    return text


def exclude_urls(items: list[dict[str, Any]], blocked: set[str]) -> list[dict[str, Any]]:
    if not blocked:
        return items
    out: list[dict[str, Any]] = []
    for item in items:
        url = normalize_repo_url(str(item.get("url") or ""))
        if url and url in blocked:
            continue
        out.append(item)
    return out
