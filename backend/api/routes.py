from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from backend.services.data_store import (
    load_daily_videos,
    load_prompts_runtime,
    load_tools,
    load_tutorials_runtime,
)
from backend.services.knowledge import get_knowledge_index

router = APIRouter(prefix="/api", tags=["api"])


class AskRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=500)
    limit: int = Field(5, ge=1, le=10)


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "bio-ai-lab"}


@router.get("/tools")
def api_tools() -> dict[str, Any]:
    tools = load_tools()
    return {"count": len(tools), "tools": tools}


@router.get("/prompts")
def api_prompts(
    category: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    payload = load_prompts_runtime()
    prompts = payload.get("prompts", [])
    if category:
        prompts = [p for p in prompts if p.get("category") == category]
    return {"count": len(prompts), "prompts": prompts[:limit], "categories": payload.get("categories", [])}


@router.get("/tutorials")
def api_tutorials(limit: int = Query(50, ge=1, le=200)) -> dict[str, Any]:
    payload = load_tutorials_runtime()
    tutorials = payload.get("tutorials", [])[:limit]
    return {"count": len(tutorials), "tutorials": tutorials}


@router.get("/videos")
def api_videos(limit: int = Query(20, ge=1, le=100)) -> dict[str, Any]:
    data = load_daily_videos()
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
def api_ask(body: AskRequest) -> dict[str, Any]:
    query = body.query.strip()
    if not query:
        raise HTTPException(400, "query 不能为空")
    return get_knowledge_index().answer(query, limit=body.limit)


@router.get("/search")
def api_search(q: str = Query(..., min_length=1, max_length=200), limit: int = Query(8, ge=1, le=20)) -> dict[str, Any]:
    hits = get_knowledge_index().search(q.strip(), limit=limit)
    return {"query": q, "count": len(hits), "results": hits}
