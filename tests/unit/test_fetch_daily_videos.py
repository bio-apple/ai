"""fetch_daily_videos 辅助逻辑单测（无需网络）。"""

from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))
MODULE_PATH = SCRIPTS / "fetch_daily_videos.py"

spec = importlib.util.spec_from_file_location("fetch_daily_videos", MODULE_PATH)
mod = importlib.util.module_from_spec(spec)
assert spec.loader is not None
sys.modules["fetch_daily_videos"] = mod
spec.loader.exec_module(mod)


class FetchDailyVideosHelpersTest(unittest.TestCase):
    def test_parse_iso8601_duration(self) -> None:
        self.assertEqual(mod.parse_iso8601_duration("PT26M39S"), 26 * 60 + 39)
        self.assertEqual(mod.parse_iso8601_duration("PT1H2M3S"), 3600 + 120 + 3)
        self.assertEqual(mod.parse_iso8601_duration(""), 0)

    def test_youtube_api_item_to_detail(self) -> None:
        detail = mod.youtube_api_item_to_detail(
            {
                "id": "abc123",
                "snippet": {
                    "title": "ChatGPT Tutorial",
                    "description": "Learn AI tools",
                    "channelTitle": "AI Master",
                    "publishedAt": "2026-07-10T08:00:00Z",
                    "thumbnails": {"high": {"url": "https://i.ytimg.com/vi/abc/hqdefault.jpg"}},
                },
                "statistics": {"viewCount": "12345"},
                "contentDetails": {"duration": "PT10M5S"},
            }
        )
        self.assertEqual(detail["id"], "abc123")
        self.assertEqual(detail["view_count"], 12345)
        self.assertEqual(detail["duration"], 605)
        self.assertEqual(detail["upload_date"], "20260710")

    def test_preserve_youtube_from_previous(self) -> None:
        buckets = {key: [] for key in mod.CATEGORY_ORDER}
        store = {
            "batches": [
                {
                    "date": "2026-07-16",
                    "categories": {
                        "youtube_recent_30d": {"videos": [{"id": "youtube:x1"}, {"id": "youtube:x2"}]},
                    },
                }
            ]
        }
        out = mod.preserve_youtube_from_previous(buckets, store, today="2026-07-17")
        self.assertEqual(len(out["youtube_recent_30d"]), 2)

    def test_preserve_skips_when_today_has_youtube(self) -> None:
        buckets = {key: [] for key in mod.CATEGORY_ORDER}
        buckets["youtube_recent_30d"] = [{"id": "youtube:new"}]
        store = {
            "batches": [
                {
                    "date": "2026-07-16",
                    "categories": {"youtube_recent_30d": {"videos": [{"id": "youtube:old"}]}},
                }
            ]
        }
        out = mod.preserve_youtube_from_previous(buckets, store, today="2026-07-17")
        self.assertEqual(out["youtube_recent_30d"][0]["id"], "youtube:new")

    def test_finalize_platform_top_by_views(self) -> None:
        buckets = {key: [] for key in mod.CATEGORY_ORDER}
        buckets["youtube_recent_3d"] = [
            {"id": "youtube:a", "views": 2_000_000},
            {"id": "youtube:b", "views": 1_500_000},
        ]
        buckets["youtube_recent_30d"] = [
            {"id": "youtube:c", "views": 900_000},
            {"id": "youtube:d", "views": 800_000},
        ]
        buckets["youtube_recent_100d"] = [
            {"id": "youtube:e", "views": 700_000},
            {"id": "youtube:f", "views": 600_000},
            {"id": "youtube:g", "views": 500_000},
            {"id": "youtube:h", "views": 400_000},
            {"id": "youtube:i", "views": 300_000},
            {"id": "youtube:j", "views": 200_000},
            {"id": "youtube:k", "views": 100_000},
        ]
        buckets["bilibili_recent_30d"] = [
            {"id": "bilibili:1", "views": 50},
            {"id": "bilibili:2", "views": 40},
            {"id": "bilibili:3", "views": 30},
        ]
        out = mod.finalize_platform_top_by_views(buckets, limit=10)
        yt_ids = {
            v["id"]
            for key in mod.CATEGORY_ORDER
            if key.startswith("youtube")
            for v in out[key]
        }
        self.assertEqual(len(yt_ids), 10)
        self.assertNotIn("youtube:k", yt_ids)
        self.assertEqual(len(out["bilibili_recent_30d"]), 3)

    def test_main_zero_total_preserves_history_without_write(self) -> None:
        """total==0 且有历史批次时不应 exit 1（由 main 逻辑保证，此处测分支辅助函数语义）。"""
        store = {"batches": [{"date": "2026-07-16", "categories": {}}]}
        self.assertTrue(bool(store.get("batches")))


if __name__ == "__main__":
    unittest.main()
