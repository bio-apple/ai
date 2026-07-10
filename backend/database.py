from __future__ import annotations

import re
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from backend.config import CFG

DB_PATH = Path(CFG["paths"]["data_dir"]) / "app.db"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def init_db() -> None:
    with get_conn() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE COLLATE NOCASE,
                email TEXT NOT NULL UNIQUE COLLATE NOCASE,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS resources (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                description TEXT DEFAULT '',
                file_type TEXT NOT NULL,
                original_name TEXT NOT NULL,
                stored_name TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE INDEX IF NOT EXISTS idx_resources_user ON resources(user_id);
            """
        )


@contextmanager
def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def _unique_username(conn, email: str) -> str:
    base = re.sub(r"[^a-zA-Z0-9_]", "_", email.split("@")[0])[:24] or "user"
    candidate = base
    n = 1
    while conn.execute(
        "SELECT 1 FROM users WHERE username = ? COLLATE NOCASE", (candidate,)
    ).fetchone():
        candidate = f"{base}_{n}"
        n += 1
    return candidate


def create_user(email: str, password_hash: str) -> dict:
    email = email.lower()
    with get_conn() as conn:
        username = _unique_username(conn, email)
        cur = conn.execute(
            "INSERT INTO users (username, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
            (username, email, password_hash, _now()),
        )
        user_id = cur.lastrowid
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return dict(row)


def get_user_by_email(email: str) -> dict | None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE email = ? COLLATE NOCASE", (email.lower(),)
        ).fetchone()
        return dict(row) if row else None


def get_user_by_username(username: str) -> dict | None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE username = ? COLLATE NOCASE", (username,)
        ).fetchone()
        return dict(row) if row else None


def get_user_by_id(user_id: int) -> dict | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return dict(row) if row else None


def create_resource(
    user_id: int,
    title: str,
    description: str,
    file_type: str,
    original_name: str,
    stored_name: str,
    file_size: int,
) -> dict:
    with get_conn() as conn:
        cur = conn.execute(
            """INSERT INTO resources
               (user_id, title, description, file_type, original_name, stored_name, file_size, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (user_id, title, description, file_type, original_name, stored_name, file_size, _now()),
        )
        rid = cur.lastrowid
        row = conn.execute(
            """SELECT r.*, u.username FROM resources r
               JOIN users u ON r.user_id = u.id WHERE r.id = ?""",
            (rid,),
        ).fetchone()
        return dict(row)


def list_resources(limit: int = 100) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT r.*, u.username FROM resources r
               JOIN users u ON r.user_id = u.id
               ORDER BY r.created_at DESC LIMIT ?""",
            (limit,),
        ).fetchall()
        return [dict(r) for r in rows]


def list_user_resources(user_id: int) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT r.*, u.username FROM resources r
               JOIN users u ON r.user_id = u.id
               WHERE r.user_id = ? ORDER BY r.created_at DESC""",
            (user_id,),
        ).fetchall()
        return [dict(r) for r in rows]


def get_resource(resource_id: int) -> dict | None:
    with get_conn() as conn:
        row = conn.execute(
            """SELECT r.*, u.username FROM resources r
               JOIN users u ON r.user_id = u.id WHERE r.id = ?""",
            (resource_id,),
        ).fetchone()
        return dict(row) if row else None


def delete_resource(resource_id: int, user_id: int) -> bool:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id FROM resources WHERE id = ? AND user_id = ?", (resource_id, user_id)
        ).fetchone()
        if not row:
            return False
        conn.execute("DELETE FROM resources WHERE id = ?", (resource_id,))
        return True


USERNAME_RE = re.compile(r"^[a-zA-Z0-9_]{3,32}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def validate_email(email: str) -> str | None:
    if not EMAIL_RE.match(email):
        return "请输入有效的邮箱地址"
    return None
