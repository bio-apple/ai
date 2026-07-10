from __future__ import annotations

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

    return cfg


CFG = load_config()
