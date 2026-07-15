"""news_dedupe 轻量单测（stdlib unittest，无额外依赖）。"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

from news_dedupe import (  # noqa: E402
    assert_news_unique,
    dedupe_news_items,
    find_news_duplicates,
    normalize_news_title,
)


class NewsDedupeTest(unittest.TestCase):
    def test_normalize_title_nfkc_and_casefold(self):
        self.assertEqual(normalize_news_title("  ＡＩ\u3000News  "), "ai news")

    def test_dedupe_keeps_newer_by_url(self):
        items = [
            {"title": "A", "url": "https://ex/a", "published_at": "2026-01-01"},
            {"title": "A-new", "url": "https://ex/a", "published_at": "2026-07-01"},
        ]
        out = dedupe_news_items(items)
        self.assertEqual(len(out), 1)
        self.assertEqual(out[0]["title"], "A-new")

    def test_dedupe_keeps_newer_by_title(self):
        items = [
            {"title": "同一标题", "url": "https://ex/1", "published_at": "2026-01-01"},
            {"title": "同一标题", "url": "https://ex/2", "published_at": "2026-07-01"},
        ]
        out = dedupe_news_items(items)
        self.assertEqual(len(out), 1)
        self.assertEqual(out[0]["url"], "https://ex/2")

    def test_find_duplicates_and_assert(self):
        items = [
            {"title": "dup", "url": "https://a", "published_at": "2026-01-01"},
            {"title": "dup", "url": "https://b", "published_at": "2026-01-02"},
        ]
        problems = find_news_duplicates(items)
        self.assertTrue(any("标题重复" in p for p in problems))
        with self.assertRaises(ValueError):
            assert_news_unique(items)

    def test_unique_assert_ok(self):
        assert_news_unique(
            [
                {"title": "x", "url": "https://x", "published_at": "2026-01-01"},
                {"title": "y", "url": "https://y", "published_at": "2026-01-02"},
            ]
        )


if __name__ == "__main__":
    unittest.main()
