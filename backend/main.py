from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from backend.api.routes import router as api_router
from backend.config import ROOT

app = FastAPI(title="Bio AI Lab", version="1.6.0", description="静态站本地预览 + 内容 API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api_router)

SAFE_STATIC = {".html", ".css", ".js", ".ico", ".png", ".svg", ".woff2", ".json", ".xml", ".txt"}


@app.get("/")
def serve_index():
    return FileResponse(ROOT / "index.html")


@app.get("/{filepath:path}")
def serve_static(filepath: str):
    if filepath.startswith(("backend/", "data/", "uploads/")):
        raise HTTPException(404)
    path = (ROOT / filepath).resolve()
    root = ROOT.resolve()
    try:
        path.relative_to(root)
    except ValueError:
        raise HTTPException(404)
    if not path.is_file():
        raise HTTPException(404)
    if path.suffix.lower() not in SAFE_STATIC and path.name not in SAFE_STATIC:
        raise HTTPException(404)
    return FileResponse(path)
