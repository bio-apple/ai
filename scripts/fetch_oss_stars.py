#!/usr/bin/env python3
"""刷新 data/oss-projects.json 中各仓库的 GitHub Stars。"""

from __future__ import annotations

import json
import ssl
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = ROOT / "data" / "oss-projects.json"
PUBLIC_FILE = ROOT / "oss-projects.json"
TZ = timezone(timedelta(hours=8))
USER_AGENT = "BioAI-Lab-OSSBot/1.0"


def ssl_context() -> ssl.SSLContext:
    try:
        import certifi

        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


def fetch_repo_stars(repo: str) -> int | None:
    url = f"https://api.github.com/repos/{repo}"
    try:
        req = Request(url, headers={"Accept": "application/vnd.github+json", "User-Agent": USER_AGENT})
        with urlopen(req, timeout=20, context=ssl_context()) as resp:
            data = json.loads(resp.read().decode())
        return int(data.get("stargazers_count", 0))
    except Exception as err:
        try:
            proc = subprocess.run(
                ["curl", "-sL", "--max-time", "20", "-H", f"User-Agent: {USER_AGENT}", url],
                capture_output=True,
                check=True,
                text=True,
            )
            data = json.loads(proc.stdout)
            return int(data.get("stargazers_count", 0))
        except Exception as curl_err:
            print(f"skip {repo}: {err}; curl: {curl_err}", file=sys.stderr)
            return None


def main() -> int:
    payload = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    updated = 0
    for domain in payload.get("domains", []):
        for project in domain.get("projects", []):
            repo = project.get("repo")
            if not repo:
                continue
            stars = fetch_repo_stars(repo)
            if stars is None:
                continue
            project["stars"] = stars
            updated += 1

    payload["updated_at"] = datetime.now(TZ).strftime("%Y-%m-%d")
    text = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    DATA_FILE.write_text(text, encoding="utf-8")
    PUBLIC_FILE.write_text(text, encoding="utf-8")
    print(f"✓ oss-projects.json ({updated} repos) → {DATA_FILE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
