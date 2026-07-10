#!/usr/bin/env python3
"""FastAPI 内容 API 冒烟测试（TestClient，无需启动服务）。"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


def main() -> int:
    health = client.get("/api/health")
    assert health.status_code == 200, health.text
    assert health.json()["status"] == "ok"

    tools = client.get("/api/tools")
    assert tools.status_code == 200
    assert tools.json()["count"] >= 5

    prompts = client.get("/api/prompts?limit=5")
    assert prompts.status_code == 200
    assert prompts.json()["count"] >= 1

    ask = client.post("/api/ask", json={"query": "Cursor 编程"})
    assert ask.status_code == 200
    body = ask.json()
    assert body.get("answer")
    assert isinstance(body.get("sources"), list)

    search = client.get("/api/search?q=Prompt")
    assert search.status_code == 200
    assert search.json()["count"] >= 1

    static = client.get("/index.html")
    assert static.status_code == 200

    print("✓ FastAPI API 冒烟测试通过")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"API 冒烟失败: {exc}", file=sys.stderr)
        raise SystemExit(1)
