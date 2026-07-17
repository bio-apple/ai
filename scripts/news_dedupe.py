"""新闻去重：同标题或同 URL 只保留最新 published_at。

供 fetch_ai_news / validate_ci 共用，保证写入与门禁同一规则。
"""

from __future__ import annotations

import json
import unicodedata
from typing import Any


def normalize_news_title(title: str) -> str:
    text = unicodedata.normalize("NFKC", title or "")
    text = text.replace("\u3000", " ")
    return " ".join(text.split()).casefold()


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


def load_oss_project_urls(path: Any) -> set[str]:
    """读取开源精选里的仓库 URL，供新闻侧排除，避免首页重复。"""
    from pathlib import Path

    p = Path(path)
    if not p.is_file():
        return set()
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return set()
    urls: set[str] = set()

    def walk(node: Any) -> None:
        if isinstance(node, dict):
            url = node.get("url") or node.get("html_url")
            if isinstance(url, str) and "github.com" in url:
                urls.add(normalize_repo_url(url))
            for v in node.values():
                walk(v)
        elif isinstance(node, list):
            for v in node:
                walk(v)

    walk(data)
    return urls


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
