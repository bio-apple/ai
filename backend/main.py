from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse

from backend.api.routes import router as api_router
from backend.config import ROOT

SITE_ROOT = ROOT / "dist" if (ROOT / "dist" / "index.html").exists() else ROOT
BASE_PATH = "/ai"

app = FastAPI(title="Bio AI Lab", version="1.8.0", description="Astro 静态站本地预览 + 内容 API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api_router)

SAFE_STATIC = {".html", ".css", ".js", ".ico", ".png", ".svg", ".woff2", ".json", ".xml", ".txt"}


def _safe_file(filepath: str):
    if filepath.startswith(("backend/", "data/", "uploads/", "src/", "api/")):
        raise HTTPException(404)
    path = (SITE_ROOT / filepath).resolve()
    root = SITE_ROOT.resolve()
    try:
        path.relative_to(root)
    except ValueError:
        raise HTTPException(404)
    if not path.is_file():
        raise HTTPException(404)
    if path.suffix.lower() not in SAFE_STATIC and path.name not in SAFE_STATIC:
        raise HTTPException(404)
    return path


@app.get("/")
def root_redirect():
    """与 Astro base `/ai/` 对齐，避免本地打开首页资源 404。"""
    return RedirectResponse(url=f"{BASE_PATH}/", status_code=307)


@app.get(BASE_PATH)
@app.get(f"{BASE_PATH}/")
def serve_ai_index():
    return FileResponse(_safe_file("index.html"))


@app.get(f"{BASE_PATH}/{{filepath:path}}")
def serve_ai_static(filepath: str):
    return FileResponse(_safe_file(filepath))


@app.get("/{filepath:path}")
def serve_legacy_static(filepath: str):
    """兼容无 /ai 前缀的旧本地路径与冒烟测试。"""
    return FileResponse(_safe_file(filepath))
