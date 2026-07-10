from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import yaml

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "config.yaml"


def load_config() -> dict[str, Any]:
    with CONFIG_PATH.open(encoding="utf-8") as f:
        cfg = yaml.safe_load(f)

    for key in ("data_dir", "upload_dir"):
        p = ROOT / cfg["paths"][key]
        p.mkdir(parents=True, exist_ok=True)
        cfg["paths"][key] = str(p)

    if os.getenv("PORT"):
        cfg.setdefault("server", {})["port"] = int(os.getenv("PORT", "8765"))
    if os.getenv("HOST"):
        cfg.setdefault("server", {})["host"] = os.getenv("HOST")
    if os.getenv("BASE_URL"):
        cfg["base_url"] = os.getenv("BASE_URL").rstrip("/")

    return cfg


CFG = load_config()
