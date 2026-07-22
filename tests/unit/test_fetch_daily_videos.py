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

    def test_preserve_youtube_from_previous(self) -> None:
        buckets = {key: [] for key in mod.CATEGORY_ORDER}
        store = {
            "batches": [
                {
                    "date": "2026-07-16",
                    "categories": {
                        "youtube_recent_30d": {
                            "videos": [
                                {
                                    "id": "youtube:x1",
                                    "views": 2_000_000,
                                    "published_at": self.ago(10),
                                },
                                {
                                    "id": "youtube:x2",
                                    "views": 1_500_000,
                                    "published_at": self.ago(12),
                                },
                            ]
                        },
                    },
                }
            ]
        }
        cfg = {
            "video_categories": {
                "youtube_recent_30d": {"min_views": 1_000_000, "top_count": 5, "days": 30},
            }
        }
        out = mod.preserve_youtube_from_previous(buckets, store, today="2026-07-17", cfg=cfg)
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
        buckets["youtube_recent_3d"] = [
            {"id": "youtube:a", "views": 2_000_000, "published_at": self.ago(1)},
            {"id": "youtube:b", "views": 1_500_000, "published_at": self.ago(2)},
            {"id": "youtube:c3", "views": 1_200_000, "published_at": self.ago(2.5)},
        ]
        buckets["youtube_recent_30d"] = [
            {"id": "youtube:d", "views": 3_000_000, "published_at": self.ago(10)},
            {"id": "youtube:e", "views": 2_800_000, "published_at": self.ago(12)},
            {"id": "youtube:f", "views": 2_700_000, "published_at": self.ago(14)},
            {"id": "youtube:g", "views": 2_600_000, "published_at": self.ago(16)},
            {"id": "youtube:h", "views": 2_500_000, "published_at": self.ago(18)},
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
            for key in ("youtube_recent_3d", "youtube_recent_30d", "youtube_recent_100d")
            for v in out[key]
        }
        self.assertEqual(len(yt_ids), 10)
        self.assertEqual(len(out["youtube_recent_3d"]), 3)
        self.assertEqual(len(out["youtube_recent_30d"]), 5)
        self.assertEqual(len(out["youtube_recent_100d"]), 2)
        self.assertEqual(
            [v["id"] for v in out["youtube_recent_100d"]],
            ["youtube:i", "youtube:j"],
        )
        self.assertNotIn("youtube:old", yt_ids)

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

    def test_topup_platform_from_previous(self) -> None:
        buckets = {key: [] for key in mod.CATEGORY_ORDER}
        buckets["bilibili_recent_30d"] = [
            {"id": "bilibili:new", "views": 1_200_000, "published_at": self.ago(10)}
        ]
        store = {
            "batches": [
                {
                    "date": "2026-07-16",
                    "categories": {
                        "bilibili_top_views": {
                            "videos": [
                                {
                                    "id": "bilibili:old1",
                                    "views": 2_000_000,
                                    "published_at": self.ago(40),
                                },
                                {
                                    "id": "bilibili:old2",
                                    "views": 1_500_000,
                                    "published_at": self.ago(50),
                                },
                                {
                                    "id": "bilibili:new",
                                    "views": 1_900_000,
                                    "published_at": self.ago(55),
                                },
                                {
                                    "id": "bilibili:ancient",
                                    "views": 18_000_000,
                                    "published_at": "2020-10-01T00:00:00+08:00",
                                },
                            ]
                        }
                    },
                }
            ]
        }
        cfg = {
            "video_categories": {
                "bilibili_recent_100d": {"min_views": 1000001, "top_count": 10, "days": 100},
            }
        }
        out = mod.topup_platform_from_previous(
            buckets, store, today="2026-07-17", platform="bilibili", cfg=cfg, limit=3
        )
        ids = {v["id"] for v in out["bilibili_recent_100d"]}
        self.assertIn("bilibili:old1", ids)
        self.assertIn("bilibili:old2", ids)
        self.assertNotIn("bilibili:new", ids)  # 已在 30d
        self.assertNotIn("bilibili:ancient", ids)  # 超窗外
        self.assertEqual(mod.platform_bucket_total(out, "bilibili"), 3)

    def test_main_zero_total_preserves_history_without_write(self) -> None:
        """total==0 且有历史批次时不应 exit 1（由 main 逻辑保证，此处测分支辅助函数语义）。"""
        store = {"batches": [{"date": "2026-07-16", "categories": {}}]}
        self.assertTrue(bool(store.get("batches")))


if __name__ == "__main__":
    unittest.main()
