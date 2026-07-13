#!/usr/bin/env python3
"""FastAPI 内容 API 冒烟测试（TestClient，无需启动服务）。"""

from __future__ import annotations

import os
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
    print("✓ /api/health")

    tools = client.get("/api/tools")
    assert tools.status_code == 200, tools.text
    assert tools.json()["count"] >= 5
    print("✓ /api/tools")

    prompts = client.get("/api/prompts?limit=5")
    assert prompts.status_code == 200, prompts.text
    assert prompts.json()["count"] >= 1, prompts.text
    print("✓ /api/prompts")

    ask = client.post("/api/ask", json={"query": "Cursor 编程"})
    assert ask.status_code == 200, ask.text
    body = ask.json()
    assert body.get("answer"), body
    assert isinstance(body.get("sources"), list)
    print("✓ /api/ask")

    search = client.get("/api/search?q=Prompt")
    assert search.status_code == 200, search.text
    assert search.json()["count"] >= 1, search.text
    print("✓ /api/search")

    root = client.get("/", follow_redirects=False)
    assert root.status_code in (301, 302, 307, 308), root.status_code
    assert "/ai" in root.headers.get("location", "")
    print("✓ / → /ai/")

    ai_index = client.get("/ai/")
    assert ai_index.status_code == 200, ai_index.text
    assert b"Bio AI Lab" in ai_index.content or b"html" in ai_index.content.lower()
    print("✓ /ai/")

    style = client.get("/ai/style.css")
    assert style.status_code == 200, style.text
    print("✓ /ai/style.css")

    legacy = client.get("/index.html")
    assert legacy.status_code == 200, legacy.text
    print("✓ /index.html (legacy)")

    print("✓ FastAPI API 冒烟测试通过")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        import traceback
        print(f"API 冒烟失败: {exc}", file=sys.stderr)
        traceback.print_exc()
        summary = os.environ.get("GITHUB_STEP_SUMMARY")
        if summary:
            with open(summary, "a", encoding="utf-8") as fh:
                fh.write(f"### API 冒烟失败\n\n```\n{exc}\n```\n")
        raise SystemExit(1)
