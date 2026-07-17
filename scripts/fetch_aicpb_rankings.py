#!/usr/bin/env python3
"""兼容入口：转发至 fetch_rankings.py（多源排行抓取）。"""

from pathlib import Path
import runpy

if __name__ == "__main__":
    runpy.run_path(str(Path(__file__).with_name("fetch_rankings.py")), run_name="__main__")
