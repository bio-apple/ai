#!/usr/bin/env python3
"""check_site_health 可导入，且中文 marker 以 UTF-8 匹配。"""

from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path
from unittest import mock


ROOT = Path(__file__).resolve().parents[2]


def load_module():
    path = ROOT / "scripts" / "check_site_health.py"
    spec = importlib.util.spec_from_file_location("check_site_health", path)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class CheckSiteHealthTests(unittest.TestCase):
    def test_module_imports(self):
        mod = load_module()
        self.assertTrue(callable(mod.check_http))
        self.assertTrue(callable(mod.main))

    def test_chinese_marker_matches_utf8_body(self):
        mod = load_module()
        html = "<title>AI 工具中心</title>".encode("utf-8")
        with mock.patch.object(mod, "fetch", return_value=(200, html, {})):
            mod.check_http("/tools/hub.html", expect_substr="工具中心")

    def test_missing_marker_raises(self):
        mod = load_module()
        with mock.patch.object(mod, "fetch", return_value=(200, b"<html></html>", {})):
            with self.assertRaisesRegex(RuntimeError, r"CONTENT:"):
                mod.check_http("/tools/hub.html", expect_substr="工具中心")

    def test_main_probes_standalone_pages(self):
        mod = load_module()
        paths: list[str] = []

        def fake_http(path: str, expect_substr=None) -> None:
            paths.append(path)

        with (
            mock.patch.object(mod, "check_http", side_effect=fake_http),
            mock.patch.object(mod, "check_json_freshness"),
            mock.patch.object(mod, "write_summary"),
        ):
            self.assertEqual(mod.main(), 0)
        for path in (
            "/",
            "/tools/hub.html",
            "/oss.html",
            "/courses.html",
            "/news/daily-ai-news.html",
            "/videos.html",
        ):
            self.assertIn(path, paths)


if __name__ == "__main__":
    unittest.main()
