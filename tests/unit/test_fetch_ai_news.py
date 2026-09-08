"""fetch_ai_news 量子位热门解析（夹具 HTML，不打真实官网）。"""

from __future__ import annotations

import importlib.util
import sys
import unittest
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))
MODULE_PATH = SCRIPTS / "fetch_ai_news.py"

spec = importlib.util.spec_from_file_location("fetch_ai_news", MODULE_PATH)
mod = importlib.util.module_from_spec(spec)
assert spec.loader is not None
sys.modules["fetch_ai_news"] = mod
spec.loader.exec_module(mod)

NOW = datetime(2026, 9, 8, 12, 0, tzinfo=mod.TZ)
HOT_CFG = {
    "url": "https://www.qbitai.com/",
    "source": "量子位",
    "category": "中文资讯",
    "max_age_days": 30,
}
CFG = {
    "summary_max_length": 160,
    "category_keywords": {
        "新工具上线": r"(launch|release|introducing|available now|上线|发布)",
        "开源项目": r"(open[- ]source|github|hugging\s*face|repository|开源|arxiv|trending|openhands|autogpt)",
        "新模型发布": r"(model|gpt|claude|gemini|llm|推理|大模型)",
        "行业新闻": r"(partnership|acquisition|policy|regulation|融资|合作)",
        "学术论文": r"(arxiv|paper|preprint|论文)",
        "中文资讯": r"(人工智能|大模型|开源|发布)",
    },
}


def fixture_html(*, keep_date: str, drop_date: str) -> str:
    return f"""
<div class="picture_text">
  <a href="https://www.qbitai.com/2026/09/latest.html">
    <h4>首页最新稿不应入热门</h4>
    <div class="info">2026-09-08</div>
  </a>
</div>
<!--热门文章 start-->
<div class="yaowen">
  <h3>热门文章</h3>
  <div class="picture_text">
    <a href="https://www.qbitai.com/2026/08/keep-29.html">
      <h4>刚好二十九天</h4>
      <div class="info">{keep_date}</div>
    </a>
  </div>
  <div class="picture_text">
    <a href="https://www.qbitai.com/2026/08/drop-31.html">
      <h4>三十一天应丢弃</h4>
      <div class="info">{drop_date}</div>
    </a>
  </div>
  <div class="picture_text">
    <a href="/2026/09/url-only.html">
      <h4>仅 URL 月份</h4>
    </a>
  </div>
  <div class="picture_text">
    <a href="https://www.qbitai.com/no-date.html">
      <h4>无日期应丢弃</h4>
    </a>
  </div>
</div>
<!--热门文章 end-->
"""


class QbitaiHotParseTest(unittest.TestCase):
    def test_parses_comment_block_and_ignores_homepage_latest(self) -> None:
        html = fixture_html(keep_date="2026-08-10", drop_date="2026-08-08")
        parsed = mod.parse_qbitai_hot_html(html, HOT_CFG, CFG)
        titles = [item["title"] for item in parsed]
        self.assertIn("刚好二十九天", titles)
        self.assertIn("三十一天应丢弃", titles)
        self.assertIn("仅 URL 月份", titles)
        self.assertNotIn("首页最新稿不应入热门", titles)
        self.assertNotIn("无日期应丢弃", titles)
        url_only = next(item for item in parsed if item["title"] == "仅 URL 月份")
        self.assertEqual(url_only["url"], "https://www.qbitai.com/2026/09/url-only.html")
        self.assertEqual(url_only["published_at"], "2026-09-01T00:00:00+08:00")
        self.assertEqual(url_only["source"], "量子位")
        self.assertEqual(url_only["window_hours"], 720)
        self.assertEqual(url_only["category"], "中文资讯")

    def test_classifies_hot_with_existing_keywords(self) -> None:
        html = """
<!--热门文章 start-->
<a href="https://www.qbitai.com/2026/09/483898.html"><h4>刚刚，GPT-6正式发布！OpenAI：欢迎来到AGI时代</h4><div class="info">2026-09-04</div></a>
<a href="https://www.qbitai.com/2026/09/483101.html"><h4>阿里更新旗舰模型Qwen3.8-Max，前端编程能力跃居全球第一</h4><div class="info">2026-09-02</div></a>
<!--热门文章 end-->
"""
        parsed = {item["title"]: item["category"] for item in mod.parse_qbitai_hot_html(html, HOT_CFG, CFG)}
        self.assertEqual(parsed["刚刚，GPT-6正式发布！OpenAI：欢迎来到AGI时代"], "新工具上线")
        self.assertEqual(parsed["阿里更新旗舰模型Qwen3.8-Max，前端编程能力跃居全球第一"], "中文资讯")

    def test_keeps_29_days_drops_31_days(self) -> None:
        html = fixture_html(keep_date="2026-08-10", drop_date="2026-08-08")
        parsed = mod.parse_qbitai_hot_html(html, HOT_CFG, CFG)
        kept = mod.filter_max_age_days(parsed, 30, now=NOW)
        titles = [item["title"] for item in kept]
        self.assertIn("刚好二十九天", titles)
        self.assertNotIn("三十一天应丢弃", titles)
        self.assertIn("仅 URL 月份", titles)

    def test_empty_without_hot_block(self) -> None:
        html = '<div class="picture_text"><a href="/2026/09/1.html"><h4>x</h4><div class="info">2026-09-01</div></a></div>'
        self.assertEqual(mod.parse_qbitai_hot_html(html, HOT_CFG, CFG), [])
