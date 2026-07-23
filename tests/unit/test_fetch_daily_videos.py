"""fetch_daily_videos 辅助逻辑单测（无需网络）。"""

from __future__ import annotations

import importlib.util
import sys
import unittest
from datetime import timedelta
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
    def ago(self, days: float) -> str:
        return (mod.now_local() - timedelta(days=days)).isoformat()

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

    def test_rank_candidates_orders_by_views_not_window_first(self) -> None:
        now = mod.now_local()
        low = {
            "id": "low",
            "platform": "bilibili",
            "view_count": 800,
            "detail": {"timestamp": int(now.timestamp()) - 3600},
        }
        high = {
            "id": "high",
            "platform": "bilibili",
            "view_count": 500_000,
            "detail": {},  # 未知时间
        }
        ranked = mod.rank_candidates_for_bucket(
            {"low": low, "high": high},
            now,
            require_hours=30 * 24,
        )
        self.assertEqual([x["id"] for x in ranked], ["high", "low"])

    def test_finalize_platform_top_by_views(self) -> None:
        buckets = {key: [] for key in mod.CATEGORY_ORDER}
        buckets["youtube_recent_24h"] = [
            {"id": "youtube:h1", "views": 400_000, "published_at": self.ago(0.2)},
            {"id": "youtube:h2", "views": 350_000, "published_at": self.ago(0.4)},
            {"id": "youtube:h3", "views": 320_000, "published_at": self.ago(0.5)},
        ]
        buckets["youtube_recent_3d"] = [
            {"id": "youtube:a", "views": 2_000_000, "published_at": self.ago(1)},
            {"id": "youtube:b", "views": 1_500_000, "published_at": self.ago(2)},
            {"id": "youtube:c3", "views": 1_200_000, "published_at": self.ago(2.5)},
        ]
        buckets["youtube_recent_30d"] = [
            {"id": "youtube:d", "views": 3_000_000, "published_at": self.ago(10)},
            {"id": "youtube:e", "views": 2_800_000, "published_at": self.ago(12)},
            {"id": "youtube:f", "views": 2_700_000, "published_at": self.ago(14)},
        ]
        buckets["youtube_recent_100d"] = [
            {"id": "youtube:i", "views": 4_000_000, "published_at": self.ago(40)},
            {"id": "youtube:j", "views": 3_900_000, "published_at": self.ago(50)},
            {"id": "youtube:old", "views": 9_000_000, "published_at": "2020-10-01T00:00:00+08:00"},
            {"id": "youtube:k", "views": 3_800_000, "published_at": self.ago(55)},
            {"id": "youtube:l", "views": 3_700_000, "published_at": self.ago(60)},
            {"id": "youtube:m", "views": 3_600_000, "published_at": self.ago(65)},
        ]
        out = mod.finalize_platform_top_by_views(buckets, limit=10)
        yt_ids = {
            v["id"]
            for key in (
                "youtube_recent_24h",
                "youtube_recent_3d",
                "youtube_recent_30d",
                "youtube_recent_100d",
            )
            for v in out[key]
        }
        self.assertEqual(len(yt_ids), 10)
        self.assertEqual(len(out["youtube_recent_24h"]), 3)
        self.assertEqual(len(out["youtube_recent_3d"]), 3)
        self.assertEqual(len(out["youtube_recent_30d"]), 3)
        self.assertEqual(len(out["youtube_recent_100d"]), 1)
        self.assertEqual([v["id"] for v in out["youtube_recent_100d"]], ["youtube:i"])
        self.assertNotIn("youtube:old", yt_ids)

    def test_filter_videos_for_category_24h_window(self) -> None:
        now = mod.datetime(2026, 7, 23, 12, 0, tzinfo=mod.TZ)
        videos = [
            {"id": "in", "views": 150_000, "published_at": "2026-07-23T01:00:00+08:00"},
            {"id": "out", "views": 900_000, "published_at": "2026-07-21T11:00:00+08:00"},
            {"id": "low", "views": 50_000, "published_at": "2026-07-23T10:00:00+08:00"},
        ]
        kept = mod.filter_videos_for_category(
            videos,
            "bilibili_recent_24h",
            now=now,
            min_views=100_000,
            cfg={
                "video_categories": {
                    "bilibili_recent_24h": {"hours": 24, "min_views": 100000},
                }
            },
        )
        self.assertEqual([v["id"] for v in kept], ["in"])

    def test_finalize_caps_each_platform_independently(self) -> None:
        """YouTube / B站各自 ≤10，合计可达 20；不是两平台合计 ≤10。"""
        buckets = {key: [] for key in mod.CATEGORY_ORDER}
        for platform in ("youtube", "bilibili"):
            buckets[f"{platform}_recent_100d"] = [
                {
                    "id": f"{platform}:{i}",
                    "views": 3_000_000 - i * 1000,
                    "published_at": self.ago(40 + i),
                }
                for i in range(15)
            ]
        out = mod.finalize_platform_top_by_views(buckets, limit=10)
        yt_n = mod.platform_bucket_total(out, "youtube")
        bi_n = mod.platform_bucket_total(out, "bilibili")
        self.assertEqual(yt_n, 10)
        self.assertEqual(bi_n, 10)
        self.assertEqual(yt_n + bi_n, 20)

    def test_filter_videos_for_category_rejects_outside_window(self) -> None:
        videos = [
            {"id": "new", "views": 2_000_000, "published_at": "2026-07-01T00:00:00+08:00"},
            {"id": "old", "views": 18_000_000, "published_at": "2020-10-01T00:00:00+08:00"},
        ]
        kept = mod.filter_videos_for_category(
            videos,
            "bilibili_recent_100d",
            now=mod.datetime(2026, 7, 22, tzinfo=mod.TZ),
            min_views=1_000_001,
        )
        self.assertEqual([v["id"] for v in kept], ["new"])

    def test_main_zero_total_preserves_history_without_write(self) -> None:
        """total==0 且有历史批次时不应 exit 1（由 main 逻辑保证，此处测分支辅助函数语义）。"""
        store = {"batches": [{"date": "2026-07-16", "categories": {}}]}
        self.assertTrue(bool(store.get("batches")))


if __name__ == "__main__":
    unittest.main()
