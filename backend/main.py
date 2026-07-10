from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from backend.config import ROOT

app = FastAPI(title="AI 应用指南", version="1.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SAFE_STATIC = {".html", ".css", ".js", ".ico", ".png", ".svg", ".woff2", ".json", ".xml", ".txt"}


@app.get("/")
def serve_index():
    return FileResponse(ROOT / "index.html")


@app.get("/{filepath:path}")
def serve_static(filepath: str):
    if filepath.startswith(("api/", "backend/", "data/", "uploads/")):
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
