"""fetch_resilience 单测。"""

from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))
MODULE_PATH = SCRIPTS / "fetch_resilience.py"

spec = importlib.util.spec_from_file_location("fetch_resilience", MODULE_PATH)
mod = importlib.util.module_from_spec(spec)
assert spec.loader is not None
sys.modules["fetch_resilience"] = mod
spec.loader.exec_module(mod)


class FetchResilienceTest(unittest.TestCase):
    def test_retry_with_backoff_succeeds_after_transient(self) -> None:
        calls = {"n": 0}

        def flaky() -> str:
            calls["n"] += 1
            if calls["n"] < 2:
                raise ConnectionError("reset")
            return "ok"

        with patch.object(mod.time, "sleep"):
            self.assertEqual(mod.retry_with_backoff(flaky, max_attempts=3, label="t"), "ok")
        self.assertEqual(calls["n"], 2)

    def test_atomic_write_json(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "data.json"
            mod.atomic_write_json(path, {"a": 1})
            self.assertEqual(json.loads(path.read_text(encoding="utf-8")), {"a": 1})

    def test_write_or_preserve_keeps_old_on_reject(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "out.json"
            mod.atomic_write_json(path, {"items": [1, 2, 3]})
            ok = mod.write_or_preserve(
                path,
                {"items": []},
                accept=lambda p: len(p.get("items") or []) > 0,
                label="test",
            )
            self.assertFalse(ok)
            self.assertEqual(json.loads(path.read_text(encoding="utf-8"))["items"], [1, 2, 3])

    def test_is_retryable_http_429(self) -> None:
        from urllib.error import HTTPError

        err = HTTPError("https://example.com", 429, "Too Many", hdrs=None, fp=None)
        self.assertTrue(mod.is_retryable_error(err))


if __name__ == "__main__":
    unittest.main()
