"""抓取脚本共享：指数退避重试、原子写入、失败保留上一版 JSON。"""

from __future__ import annotations

import json
import os
import random
import ssl
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Callable, TypeVar
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

T = TypeVar("T")

RETRYABLE_HTTP = frozenset({408, 425, 429, 500, 502, 503, 504})


def ssl_context() -> ssl.SSLContext:
    try:
        import certifi

        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


def is_retryable_error(exc: BaseException) -> bool:
    if isinstance(exc, HTTPError):
        return exc.code in RETRYABLE_HTTP
    if isinstance(exc, (URLError, TimeoutError, ConnectionError, OSError)):
        return True
    msg = str(exc).lower()
    return any(
        token in msg
        for token in (
            "timeout",
            "timed out",
            "temporary failure",
            "connection reset",
            "connection refused",
            "503",
            "429",
            "rate limit",
            "too many requests",
            "service unavailable",
        )
    )


def retry_with_backoff(
    fn: Callable[[], T],
    *,
    max_attempts: int = 4,
    base_delay: float = 1.0,
    max_delay: float = 30.0,
    jitter: float = 0.25,
    label: str = "request",
) -> T:
    last: BaseException | None = None
    for attempt in range(1, max_attempts + 1):
        try:
            return fn()
        except BaseException as exc:
            last = exc
            if attempt >= max_attempts or not is_retryable_error(exc):
                raise
            delay = min(max_delay, base_delay * (2 ** (attempt - 1)))
            delay *= 1 + random.uniform(-jitter, jitter)
            print(
                f"retry [{label}] {attempt}/{max_attempts} · 等待 {delay:.1f}s · {exc}",
                file=sys.stderr,
            )
            time.sleep(delay)
    if last:
        raise last
    raise RuntimeError("retry_with_backoff: empty loop")


def load_json(path: Path) -> Any | None:
    if not path.is_file():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


def atomic_write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(f"{path.suffix}.tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(tmp, path)


def write_or_preserve(
    path: Path,
    payload: Any,
    *,
    accept: Callable[[Any], bool],
    label: str,
    mirror_paths: list[Path] | None = None,
) -> bool:
    """accept(payload) 为真则原子写入；否则若已有文件则保留并返回 False。"""
    if accept(payload):
        atomic_write_json(path, payload)
        for mirror in mirror_paths or []:
            atomic_write_json(mirror, payload)
        return True
    if load_json(path) is not None:
        print(f"警告：{label} 结果不可接受，保留现有 {path.name}", file=sys.stderr)
        return False
    print(f"错误：{label} 失败且无历史 {path.name}", file=sys.stderr)
    return False


def fetch_url_bytes(
    url: str,
    *,
    headers: dict[str, str] | None = None,
    timeout: int = 30,
    max_attempts: int = 4,
    user_agent: str = "BioAI-Lab-Fetch/1.0",
    curl_fallback: bool = True,
) -> bytes | None:
    """带指数退避的 HTTP GET；失败时可选 curl 兜底。"""
    hdrs = {"User-Agent": user_agent, **(headers or {})}
    last_err: Exception | None = None

    def _urllib_get() -> bytes:
        req = Request(url, headers=hdrs)
        with urlopen(req, timeout=timeout, context=ssl_context()) as resp:
            return resp.read()

    for attempt in range(1, max_attempts + 1):
        try:
            return _urllib_get()
        except Exception as exc:
            last_err = exc
            if curl_fallback:
                try:
                    cmd = ["curl", "-sL", "--max-time", str(timeout), "-A", user_agent, url]
                    for key, value in hdrs.items():
                        if key.lower() != "user-agent":
                            cmd.extend(["-H", f"{key}: {value}"])
                    proc = subprocess.run(cmd, capture_output=True, timeout=timeout + 5)
                    if proc.returncode == 0 and proc.stdout:
                        return proc.stdout
                except Exception as curl_err:
                    last_err = curl_err
            if attempt < max_attempts and is_retryable_error(exc):
                delay = min(30.0, 1.0 * (2 ** (attempt - 1)))
                delay *= 1 + random.uniform(-0.25, 0.25)
                print(
                    f"retry [fetch] {attempt}/{max_attempts} · 等待 {delay:.1f}s · {url[:100]}",
                    file=sys.stderr,
                )
                time.sleep(delay)
                continue
            break

    if last_err:
        print(f"fetch failed ({max_attempts}x): {url} → {last_err}", file=sys.stderr)
    return None
