#!/usr/bin/env python3
"""FastAPI 内容 API 冒烟测试（TestClient，无需启动服务）。"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from fastapi.testclient import TestClient

from backend.main import app
from backend.services import knowledge as knowledge_mod
from backend.services.data_store import runtime_path

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

    tutorials = client.get("/api/tutorials?limit=5")
    assert tutorials.status_code == 200, tutorials.text
    assert tutorials.json()["count"] >= 1, tutorials.text
    print("✓ /api/tutorials")

    videos = client.get("/api/videos?limit=5")
    assert videos.status_code == 200, videos.text
    vbody = videos.json()
    assert "videos" in vbody and isinstance(vbody["videos"], list)
    print(f"✓ /api/videos (count={vbody.get('count', 0)})")

    ask = client.post("/api/ask", json={"query": "Cursor 编程"})
    assert ask.status_code == 200, ask.text
    body = ask.json()
    assert body.get("answer"), body
    assert isinstance(body.get("sources"), list)
    print("✓ /api/ask")

    search = client.get("/api/search?q=Cursor")
    assert search.status_code == 200, search.text
    assert search.json()["count"] >= 1, search.text
    print("✓ /api/search")

    # 推荐契约：与 site.ai_picker 关键词规则对齐（防与 recommend.js 漂移）
    site = json.loads((ROOT / "data" / "site.json").read_text(encoding="utf-8"))
    coding = next(o for o in site["ai_picker"]["options"] if o["id"] == "coding")
    rec = client.post("/api/recommend", json={"query": "我想开发一个网站写代码"})
    assert rec.status_code == 200, rec.text
    rbody = rec.json()
    assert rbody.get("matched") == "coding", rbody
    assert rbody.get("tools") == coding["tools"][:5] or set(rbody["tools"]).issubset(set(coding["tools"]))
    assert rbody["tools"][0] == coding["tools"][0]
    print("✓ /api/recommend (coding)")

    fallback = client.post("/api/recommend", json={"query": "xyzzy-unknown-need-fallback-99"})
    assert fallback.status_code == 200, fallback.text
    fbody = fallback.json()
    assert fbody.get("matched") in (None, ""), fbody
    assert isinstance(fbody.get("tools"), list) and fbody["tools"]
    print("✓ /api/recommend (fallback)")

    # KnowledgeIndex 随 search-index.json mtime 失效
    idx_path = runtime_path("search-index.json")
    assert idx_path.exists(), idx_path
    knowledge_mod._index = None
    knowledge_mod._index_mtime = None
    first = knowledge_mod.get_knowledge_index()
    m1 = knowledge_mod._index_mtime
    second = knowledge_mod.get_knowledge_index()
    assert first is second and m1 == knowledge_mod._index_mtime
    knowledge_mod._index_mtime = (m1 or 0) - 1
    third = knowledge_mod.get_knowledge_index()
    assert third is not second or knowledge_mod._index_mtime == m1
    print("✓ KnowledgeIndex mtime invalidation")

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

    # 缩略图后缀白名单：缺失文件应为 404（而非因后缀被拒）；有文件则 200
    missing = client.get("/ai/video-thumbs/bilibili/__missing_probe__.jpg")
    assert missing.status_code == 404, missing.status_code
    print("✓ jpg suffix allowed (404 for missing thumb)")

    from backend.main import SITE_ROOT

    thumb_dir = SITE_ROOT / "video-thumbs" / "bilibili"
    if thumb_dir.is_dir():
        sample = next(thumb_dir.glob("*.*"), None)
        if sample and sample.suffix.lower() in {".jpg", ".jpeg", ".webp", ".png"}:
            rel = sample.relative_to(SITE_ROOT).as_posix()
            thumb_resp = client.get(f"/ai/{rel}")
            assert thumb_resp.status_code == 200, thumb_resp.text
            print(f"✓ /ai/{rel}")

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
