from __future__ import annotations

import os
import secrets

from authlib.integrations.starlette_client import OAuth
from starlette.requests import Request

from backend.auth import create_token, hash_password
from backend.config import CFG
from backend.database import create_user, get_user_by_email

oauth = OAuth()

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID") or CFG.get("google_oauth", {}).get("client_id", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET") or CFG.get("google_oauth", {}).get("client_secret", "")


def google_oauth_enabled() -> bool:
    return bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)


def _register_google() -> None:
    if not google_oauth_enabled():
        return
    oauth.register(
        name="google",
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile"},
    )


_register_google()


def get_or_create_google_user(email: str) -> dict:
    user = get_user_by_email(email)
    if user:
        return user
    random_pw = secrets.token_urlsafe(32)
    return create_user(email, hash_password(random_pw))


async def handle_google_callback(request: Request) -> tuple[str, dict]:
    token = await oauth.google.authorize_access_token(request)
    userinfo = token.get("userinfo")
    if not userinfo:
        raise ValueError("无法获取 Google 用户信息")

    email = userinfo.get("email")
    if not email:
        raise ValueError("Google 账号未提供邮箱")

    user = get_or_create_google_user(email.lower())
    jwt_token = create_token(user["id"], user["email"])
    public_user = {
        "id": user["id"],
        "email": user["email"],
        "name": user["email"].split("@")[0],
    }
    return jwt_token, public_user
