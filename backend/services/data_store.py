from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data"

_CACHE: dict[str, tuple[float, Any]] = {}


class DataLoadError(Exception):
    """运行时 JSON 不可读或格式错误。"""

    def __init__(self, path: Path, message: str) -> None:
        self.path = path
        super().__init__(f"{path}: {message}")


def runtime_path(name: str) -> Path:
    for candidate in (ROOT / "dist" / name, ROOT / "public" / name, ROOT / name):
        if candidate.exists():
            return candidate
    return ROOT / name


def read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise DataLoadError(path, "文件不存在") from exc
    except json.JSONDecodeError as exc:
        raise DataLoadError(path, f"JSON 解析失败: {exc.msg}") from exc


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


def load_daily_videos() -> dict:
    path = runtime_path("daily-videos.json")
    return _load_cached("videos", path, {"batches": []})


def load_search_index() -> list[dict]:
    path = runtime_path("search-index.json")
    data = _load_cached("search", path, [])
    return data if isinstance(data, list) else []


def load_site() -> dict:
    return _load_cached("site", DATA / "site.json", {})


def load_recommend_rules() -> dict:
    path = runtime_path("recommend-rules.json")
    data = _load_cached("recommend_rules", path, None)
    if isinstance(data, dict) and data.get("options"):
        return data
    # 回退：从 site.json 现场组装，避免旧 dist 无产物时 500
    site = load_site()
    options = (site.get("ai_picker") or {}).get("options") or []
    return {
        "schema_version": 1,
        "options": options,
        "fallback": site.get("recommend_fallback") or {},
    }
