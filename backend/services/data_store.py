from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data"


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def load_tools() -> list[dict]:
    return read_json(DATA / "tools.json")


@lru_cache(maxsize=1)
def load_prompts_runtime() -> dict:
    return read_json(ROOT / "prompts.json")


@lru_cache(maxsize=1)
def load_tutorials_runtime() -> dict:
    return read_json(ROOT / "tutorials.json")


@lru_cache(maxsize=1)
def load_daily_videos() -> dict:
    path = ROOT / "daily-videos.json"
    if not path.exists():
        return {"batches": []}
    return read_json(path)


@lru_cache(maxsize=1)
def load_search_index() -> list[dict]:
    path = ROOT / "search-index.json"
    if not path.exists():
        return []
    data = read_json(path)
    return data if isinstance(data, list) else []
