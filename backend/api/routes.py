from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from backend.services.data_store import (
    DataLoadError,
    load_daily_videos,
    load_prompts_runtime,
    load_recommend_rules,
    load_tools,
    load_tutorials_runtime,
    runtime_path,
)
from backend.services.knowledge import get_knowledge_index
from backend.services.rate_limit import ASK_LIMITER

router = APIRouter(prefix="/api", tags=["api"])


class AskRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=500)
    limit: int = Field(5, ge=1, le=10)


def _client_key(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def _enforce_ask_limit(request: Request) -> None:
    if not ASK_LIMITER.allow(_client_key(request)):
        raise HTTPException(429, detail="请求过于频繁，请稍后再试")


@router.get("/health")
def health() -> dict[str, Any]:
    checks: dict[str, Any] = {}
    for name in (
        "search-index.json",
        "prompts.json",
        "tutorials.json",
        "daily-videos.json",
        "ai-news.json",
        "oss-projects.json",
        "recommend-rules.json",
    ):
        path = runtime_path(name)
        entry: dict[str, Any] = {"ok": path.exists(), "path": str(path)}
        if path.exists():
            try:
                raw = path.read_text(encoding="utf-8")
                json_ok = True
                if name.endswith(".json"):
                    import json

                    json.loads(raw)
                entry["bytes"] = len(raw.encode("utf-8"))
                entry["json_ok"] = json_ok
            except Exception as exc:  # noqa: BLE001
                entry["ok"] = False
                entry["error"] = str(exc)
        checks[name] = entry

    try:
        idx = get_knowledge_index()
        checks["knowledge_index"] = {"ok": True, "docs": len(idx._docs)}
    except Exception as exc:  # noqa: BLE001
        checks["knowledge_index"] = {"ok": False, "error": str(exc)}

    critical = ("search-index.json", "knowledge_index")
    ok = all(checks[k].get("ok") for k in critical if k in checks)
    return {
        "status": "ok" if ok else "degraded",
        "service": "bio-ai-lab",
        "checks": checks,
    }


@router.get("/tools")
def api_tools() -> dict[str, Any]:
    try:
        tools = load_tools()
    except DataLoadError as exc:
        raise HTTPException(503, detail=str(exc)) from exc
    return {"count": len(tools), "tools": tools}


@router.get("/prompts")
def api_prompts(
    category: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    try:
        payload = load_prompts_runtime()
    except DataLoadError as exc:
        raise HTTPException(503, detail=str(exc)) from exc
    prompts = payload.get("prompts", [])
    if category:
        prompts = [p for p in prompts if p.get("category") == category]
    return {"count": len(prompts), "prompts": prompts[:limit], "categories": payload.get("categories", [])}


@router.get("/tutorials")
def api_tutorials(limit: int = Query(50, ge=1, le=200)) -> dict[str, Any]:
    try:
        payload = load_tutorials_runtime()
    except DataLoadError as exc:
        raise HTTPException(503, detail=str(exc)) from exc
    tutorials = payload.get("tutorials", [])[:limit]
    return {"count": len(tutorials), "tutorials": tutorials}


@router.get("/videos")
def api_videos(limit: int = Query(20, ge=1, le=100)) -> dict[str, Any]:
    try:
        data = load_daily_videos()
    except DataLoadError as exc:
        raise HTTPException(503, detail=str(exc)) from exc
    batches = data.get("batches", [])
    if not batches:
        return {"count": 0, "videos": [], "updated_at": None}
    latest = batches[0]
    videos: list[dict] = []
    if latest.get("categories"):
        for cat in latest["categories"].values():
            videos.extend(cat.get("videos", []))
    else:
        videos = latest.get("videos", [])
    return {
        "count": min(len(videos), limit),
        "videos": videos[:limit],
        "updated_at": latest.get("fetched_at") or latest.get("date"),
    }


@router.post("/ask")
def api_ask(body: AskRequest, request: Request) -> dict[str, Any]:
    _enforce_ask_limit(request)
    query = body.query.strip()
    if not query:
        raise HTTPException(400, detail="query 不能为空")
    try:
        return get_knowledge_index().answer(query, limit=body.limit)
    except DataLoadError as exc:
        raise HTTPException(503, detail=str(exc)) from exc


class RecommendRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=500)


@router.post("/recommend")
def api_recommend(body: RecommendRequest) -> dict[str, Any]:
    """基于 recommend-rules.json（由 site.ai_picker 构建）的工具推荐。"""
    query = body.query.strip().lower()
    try:
        rules = load_recommend_rules()
    except DataLoadError as exc:
        raise HTTPException(503, detail=str(exc)) from exc
    options = rules.get("options") or []
    fallback = rules.get("fallback") or {}
    best = None
    best_score = 0
    for opt in options:
        keys = list(opt.get("keywords") or []) + [opt.get("label") or "", opt.get("id") or ""]
        score = 0
        for k in keys:
            key = str(k).lower()
            if key and (key in query or query in key):
                score += len(key)
        if score > best_score:
            best_score = score
            best = opt
    chosen = best if best_score > 0 else None
    tools = (chosen or {}).get("tools") or fallback.get("tools") or []
    return {
        "query": body.query.strip(),
        "matched": (chosen or {}).get("id"),
        "label": (chosen or {}).get("label") or "通用推荐",
        "tools": tools[:5],
        "path_title": (chosen or {}).get("path_title") or fallback.get("path_title"),
        "steps": (chosen or {}).get("steps") or fallback.get("steps") or [],
        "guide": (chosen or {}).get("guide") or fallback.get("guide"),
        "schema_version": rules.get("schema_version"),
    }


@router.get("/search")
def api_search(
    request: Request,
    q: str = Query(..., min_length=1, max_length=200),
    limit: int = Query(8, ge=1, le=20),
) -> dict[str, Any]:
    _enforce_ask_limit(request)
    try:
        hits = get_knowledge_index().search(q.strip(), limit=limit)
    except DataLoadError as exc:
        raise HTTPException(503, detail=str(exc)) from exc
    return {"query": q, "count": len(hits), "results": hits}
