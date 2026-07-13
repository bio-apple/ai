from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data"

_CACHE: dict[str, tuple[float, Any]] = {}


def runtime_path(name: str) -> Path:
    for candidate in (ROOT / "dist" / name, ROOT / "public" / name, ROOT / name):
        if candidate.exists():
            return candidate
    return ROOT / name


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _load_cached(key: str, path: Path, default: Any = None) -> Any:
    """按文件 mtime 失效的轻量缓存，避免本地改 JSON 后 API 仍返回旧数据。"""
    if not path.exists():
        return default
    mtime = path.stat().st_mtime
    hit = _CACHE.get(key)
    if hit and hit[0] == mtime:
        return hit[1]
    data = read_json(path)
    _CACHE[key] = (mtime, data)
    return data


def load_tools() -> list[dict]:
    return _load_cached("tools", DATA / "tools.json", [])


def load_prompts_runtime() -> dict:
    return _load_cached("prompts", runtime_path("prompts.json"), {"prompts": []})


def load_tutorials_runtime() -> dict:
    return _load_cached("tutorials", runtime_path("tutorials.json"), {"tutorials": []})


def load_daily_videos() -> dict:
    path = runtime_path("daily-videos.json")
    return _load_cached("videos", path, {"batches": []})


def load_search_index() -> list[dict]:
    path = runtime_path("search-index.json")
    data = _load_cached("search", path, [])
    return data if isinstance(data, list) else []
