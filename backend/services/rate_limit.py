"""简单滑动窗口限流（进程内，适合单 worker 本地/小流量 API）。"""

from __future__ import annotations

import time
from collections import defaultdict, deque


class SlidingWindowRateLimiter:
    def __init__(self, max_calls: int = 30, window_sec: float = 60.0) -> None:
        self.max_calls = max_calls
        self.window_sec = window_sec
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        q = self._hits[key]
        while q and now - q[0] > self.window_sec:
            q.popleft()
        if len(q) >= self.max_calls:
            return False
        q.append(now)
        return True


# ask/search 默认：每 IP 每分钟 30 次
ASK_LIMITER = SlidingWindowRateLimiter(max_calls=30, window_sec=60.0)
