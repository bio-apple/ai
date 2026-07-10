from __future__ import annotations

import shutil
import uuid
from pathlib import Path

from docx import Document
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from backend.auth import (
    create_token,
    get_current_user,
    hash_password,
    verify_password,
)
from backend.config import CFG, ROOT
from backend.database import (
    create_resource,
    create_user,
    delete_resource,
    get_resource,
    get_user_by_email,
    get_user_by_username,
    init_db,
    list_resources,
    list_user_resources,
    validate_email,
    validate_username,
)

init_db()

app = FastAPI(title="AI 编程工具指南", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path(CFG["paths"]["upload_dir"])
ALLOWED = CFG["upload"]["allowed_extensions"]


class RegisterBody(BaseModel):
    username: str = Field(min_length=3, max_length=32)
    email: str
    password: str = Field(min_length=6, max_length=128)


class LoginBody(BaseModel):
    username: str
    password: str


def _detect_file_type(filename: str) -> str | None:
    ext = Path(filename).suffix.lower()
    for ftype, exts in ALLOWED.items():
        if ext in exts:
            return ftype
    return None


def _max_size_mb(file_type: str) -> int:
    if file_type == "video":
        return CFG["upload"]["max_video_mb"]
    return CFG["upload"]["max_doc_mb"]


def _user_public(user: dict) -> dict:
    return {"id": user["id"], "username": user["username"], "email": user["email"]}


def _resource_public(row: dict) -> dict:
    return {
        "id": row["id"],
        "title": row["title"],
        "description": row["description"],
        "file_type": row["file_type"],
        "original_name": row["original_name"],
        "file_size": row["file_size"],
        "created_at": row["created_at"],
        "username": row["username"],
    }


@app.post("/api/auth/register")
def register(body: RegisterBody):
    if err := validate_username(body.username):
        raise HTTPException(400, err)
    if err := validate_email(body.email):
        raise HTTPException(400, err)
    if get_user_by_username(body.username):
        raise HTTPException(400, "用户名已被占用")
    if get_user_by_email(body.email):
        raise HTTPException(400, "邮箱已被注册")

    user = create_user(body.username, body.email, hash_password(body.password))
    token = create_token(user["id"], user["username"])
    return {"token": token, "user": _user_public(user)}


@app.post("/api/auth/login")
def login(body: LoginBody):
    user = get_user_by_username(body.username)
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "用户名或密码错误")
    token = create_token(user["id"], user["username"])
    return {"token": token, "user": _user_public(user)}


@app.get("/api/auth/me")
def me(user: dict = Depends(get_current_user)):
    return _user_public(user)


@app.get("/api/resources")
def resources_public():
    return [_resource_public(r) for r in list_resources()]


@app.get("/api/resources/mine")
def resources_mine(user: dict = Depends(get_current_user)):
    return [_resource_public(r) for r in list_user_resources(user["id"])]


@app.get("/api/resources/{resource_id}")
def resource_detail(resource_id: int):
    row = get_resource(resource_id)
    if not row:
        raise HTTPException(404, "资料不存在")
    return _resource_public(row)


@app.get("/api/resources/{resource_id}/preview")
def resource_preview(resource_id: int):
    row = get_resource(resource_id)
    if not row:
        raise HTTPException(404, "资料不存在")

    path = UPLOAD_DIR / row["stored_name"]
    if not path.exists():
        raise HTTPException(404, "文件已丢失")

    ftype = row["file_type"]
    if ftype == "markdown":
        return {"type": "markdown", "content": path.read_text(encoding="utf-8", errors="replace")}
    if ftype == "word":
        doc = Document(str(path))
        text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
        return {"type": "word", "content": text or "(文档无文本内容)"}
    if ftype == "video":
        return {"type": "video", "url": f"/api/resources/{resource_id}/file"}
    raise HTTPException(400, "不支持预览")


@app.get("/api/resources/{resource_id}/file")
def resource_file(resource_id: int):
    row = get_resource(resource_id)
    if not row:
        raise HTTPException(404, "资料不存在")
    path = UPLOAD_DIR / row["stored_name"]
    if not path.exists():
        raise HTTPException(404, "文件已丢失")

    media = {
        ".mp4": "video/mp4",
        ".webm": "video/webm",
        ".mov": "video/quicktime",
        ".avi": "video/x-msvideo",
        ".mkv": "video/x-matroska",
        ".md": "text/markdown",
        ".markdown": "text/markdown",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }
    ext = path.suffix.lower()
    return FileResponse(path, media_type=media.get(ext, "application/octet-stream"), filename=row["original_name"])


@app.post("/api/resources/upload")
async def upload_resource(
    title: str = Form(...),
    description: str = Form(""),
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    if not title.strip():
        raise HTTPException(400, "请填写标题")
    if not file.filename:
        raise HTTPException(400, "请选择文件")

    file_type = _detect_file_type(file.filename)
    if not file_type:
        allowed = ", ".join(sum(ALLOWED.values(), []))
        raise HTTPException(400, f"不支持的文件类型，允许：{allowed}")

    content = await file.read()
    max_bytes = _max_size_mb(file_type) * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(400, f"文件超过 {_max_size_mb(file_type)}MB 限制")

    ext = Path(file.filename).suffix.lower()
    stored_name = f"{user['id']}_{uuid.uuid4().hex}{ext}"
    dest = UPLOAD_DIR / stored_name
    dest.write_bytes(content)

    row = create_resource(
        user_id=user["id"],
        title=title.strip(),
        description=description.strip(),
        file_type=file_type,
        original_name=file.filename,
        stored_name=stored_name,
        file_size=len(content),
    )
    return _resource_public(row)


@app.delete("/api/resources/{resource_id}")
def remove_resource(resource_id: int, user: dict = Depends(get_current_user)):
    row = get_resource(resource_id)
    if not row:
        raise HTTPException(404, "资料不存在")
    if not delete_resource(resource_id, user["id"]):
        raise HTTPException(403, "无权删除此资料")
    path = UPLOAD_DIR / row["stored_name"]
    if path.exists():
        path.unlink()
    return {"ok": True}


SAFE_STATIC = {".html", ".css", ".js", ".ico", ".png", ".svg", ".woff2"}


@app.get("/")
def serve_index():
    return FileResponse(ROOT / "index.html")


@app.get("/{filepath:path}")
def serve_static(filepath: str):
    if filepath.startswith(("api/", "backend/", "data/", "uploads/")):
        raise HTTPException(404)
    path = (ROOT / filepath).resolve()
    root = ROOT.resolve()
    if not str(path).startswith(str(root)) or not path.is_file():
        raise HTTPException(404)
    if path.suffix.lower() not in SAFE_STATIC and path.name not in SAFE_STATIC:
        raise HTTPException(404)
    return FileResponse(path)
