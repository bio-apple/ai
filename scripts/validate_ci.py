#!/usr/bin/env python3
"""CI 校验：JSON Schema、sitemap/robots、HTML 内部链接。"""

from __future__ import annotations

import os
import json
import re
import sys
from pathlib import Path

import jsonschema
from jsonschema import Draft202012Validator
import yaml
from bs4 import BeautifulSoup

REPO = Path(__file__).resolve().parents[1]
ROOT = Path(os.environ.get("DIST", REPO / "dist")).resolve()

from news_dedupe import assert_news_unique, find_news_duplicates  # noqa: E402  # same scripts/ package style


def iter_batch_videos(batch: dict):
    if batch.get("categories"):
        for cat in batch["categories"].values():
            for v in cat.get("videos", []):
                yield v
    else:
        for v in batch.get("videos", []):
            yield v


def validate_daily_videos() -> None:
    schema = json.loads((REPO / "schemas/daily-videos.schema.json").read_text())
    schema.pop("$schema", None)
    for candidate in (ROOT / "daily-videos.json", REPO / "daily-videos.json"):
        if candidate.exists():
            data = json.loads(candidate.read_text(encoding="utf-8"))
            break
    else:
        raise FileNotFoundError("daily-videos.json 缺失")
    Draft202012Validator(schema).validate(data)
    for batch in data.get("batches", []):
        for v in iter_batch_videos(batch):
            summary = v.get("summary", "")
            if re.search(r"https?://", summary, re.I):
                raise ValueError(f"摘要含 URL: {v.get('id')} -> {summary[:80]}")
            if re.search(r"(?i)get chatgpt|bit\.ly|use code", summary):
                raise ValueError(f"摘要含广告残留: {v.get('id')}")
    latest = (data.get("batches") or [None])[0]
    if latest and latest.get("categories"):
        cfg = yaml.safe_load((REPO / "config" / "video-fetch.yaml").read_text(encoding="utf-8"))
        expected = set(cfg.get("video_categories", {}).keys())
        got = set(latest["categories"].keys())
        if expected - got:
            raise ValueError(f"最新视频批次缺少分类: {sorted(expected - got)}")
        seen_ids: set[str] = set()
        dupes: list[str] = []
        for key in sorted(latest["categories"].keys()):
            for v in latest["categories"][key].get("videos") or []:
                vid = v.get("id")
                if not vid:
                    continue
                if vid in seen_ids:
                    dupes.append(vid)
                else:
                    seen_ids.add(vid)
        if dupes:
            raise ValueError(f"最新视频批次存在跨分类重复推荐: {dupes[:8]}")
    print("✓ daily-videos.json schema + summary")


def validate_sitemap_robots() -> None:
    robots_path = ROOT / "robots.txt"
    if not robots_path.exists():
        raise FileNotFoundError(f"robots.txt 缺失: {robots_path}")
    robots = robots_path.read_text(encoding="utf-8")
    sitemap_files = sorted(ROOT.glob("sitemap*.xml"))
    if not sitemap_files:
        raise FileNotFoundError("dist 中未找到 sitemap*.xml")
    # Prefer the urlset file (sitemap-0.xml) over the index
    urlset = next((p for p in sitemap_files if "<urlset" in p.read_text(encoding="utf-8")[:200] or p.name != "sitemap-index.xml"), sitemap_files[0])
    sitemap = urlset.read_text(encoding="utf-8")
    if urlset.name == "sitemap-index.xml":
        # fall back: read first child sitemap
        child = ROOT / "sitemap-0.xml"
        if child.exists():
            sitemap = child.read_text(encoding="utf-8")
            urlset = child
    if "Sitemap:" not in robots:
        raise ValueError("robots.txt 缺少 Sitemap 声明")
    if ("<urlset" not in sitemap and "<sitemapindex" not in sitemap) or "<loc>" not in sitemap:
        raise ValueError("sitemap 格式无效")
    locs = re.findall(r"<loc>([^<]+)</loc>", sitemap)
    if not any(u.rstrip("/").endswith("/ai") or u.endswith("/ai/") or u.endswith("/ai/index.html") for u in locs):
        raise ValueError("sitemap 缺少首页 URL")
    page_locs = [
        u for u in locs
        if not u.endswith("sitemap-0.xml")
        and not u.endswith("sitemap-index.xml")
        and not u.rstrip("/").endswith("/ai")
        and not u.endswith("/ai/")
    ]
    missing_html = [u for u in page_locs if "/ai/" in u and not u.endswith(".html")]
    if missing_html:
        raise ValueError("sitemap 页面 URL 缺少 .html 后缀: " + ", ".join(missing_html[:5]))
    if not any(u.endswith("tools/chatgpt.html") for u in locs):
        raise ValueError("sitemap 缺少 tools/chatgpt.html（format=file 应对齐 canonical）")
    print(f"✓ robots.txt + {urlset.name} ({len(locs)} loc)")


def _load_schema(name: str) -> dict:
    schema = json.loads((REPO / "schemas" / name).read_text(encoding="utf-8"))
    schema.pop("$schema", None)
    return schema


def validate_ai_news() -> None:
    path = ROOT / "ai-news.json"
    if not path.exists():
        path = REPO / "ai-news.json"
    if not path.exists():
        raise FileNotFoundError("ai-news.json 缺失，请先运行 scripts/fetch_ai_news.py")
    data = json.loads(path.read_text(encoding="utf-8"))
    Draft202012Validator(_load_schema("ai-news.schema.json")).validate(data)
    items = data.get("items") or []
    problems = find_news_duplicates(items)
    if problems:
        raise ValueError("ai-news.json 存在重复条目：\n- " + "\n- ".join(problems))
    assert_news_unique(items)
    print(f"✓ ai-news.json schema + 去重 ({len(items)} 条)")


REQUIRED_COURSE_URLS = (
    "https://microsoft.github.io/generative-ai-for-beginners",
    "https://developers.google.com/machine-learning/crash-course",
    "https://www.coursera.org/learn/machine-learning",
    "https://www.coursera.org/specializations/deep-learning",
    "https://cs231n.stanford.edu",
    "https://web.stanford.edu/class/cs224n",
    "https://cs336.stanford.edu",
)


def validate_ai_courses() -> None:
    path = ROOT / "ai-courses.json"
    if not path.exists():
        path = REPO / "ai-courses.json"
    if not path.exists():
        raise FileNotFoundError("ai-courses.json 缺失，请先运行 scripts/fetch_ai_courses.py")
    data = json.loads(path.read_text(encoding="utf-8"))
    Draft202012Validator(_load_schema("ai-courses.schema.json")).validate(data)
    items = data.get("items") or []
    if not items:
        raise ValueError("ai-courses.json items 为空")
    if data.get("free_only") is not True:
        raise ValueError("ai-courses.json 必须 free_only=true（仅免费资源）")
    if not data.get("track_order"):
        raise ValueError("ai-courses.json 缺少 track_order")
    paid = [i.get("title") for i in items if i.get("is_free") is not True]
    if paid:
        raise ValueError("ai-courses.json 含非免费条目: " + ", ".join(str(t) for t in paid[:5]))
    urls = [str(i.get("url") or "").strip().rstrip("/") for i in items]
    if len(urls) != len(set(urls)):
        raise ValueError("ai-courses.json 存在重复 URL")
    present = set(urls)
    missing = [u for u in REQUIRED_COURSE_URLS if u not in present]
    if missing:
        raise ValueError("ai-courses.json 缺少必收录课程: " + ", ".join(missing))
    window = int(data.get("window_days") or 180)
    if window < 1:
        raise ValueError("window_days 无效")
    print(f"✓ ai-courses.json schema ({len(items)} 门免费 · 路线 {len(data.get('track_order') or [])})")


def validate_search_index() -> None:
    data = json.loads((ROOT / "search-index.json").read_text(encoding="utf-8"))
    Draft202012Validator(_load_schema("search-index.schema.json")).validate(data)
    print(f"✓ search-index.json schema ({len(data)} 条)")


def validate_recommend_rules() -> None:
    path = ROOT / "recommend-rules.json"
    if not path.exists():
        raise FileNotFoundError("recommend-rules.json 缺失，请先运行 npm run build")
    data = json.loads(path.read_text(encoding="utf-8"))
    Draft202012Validator(_load_schema("recommend-rules.schema.json")).validate(data)
    print(f"✓ recommend-rules.json schema ({len(data.get('options') or [])} 场景)")


def validate_runtime_json() -> None:
    path = ROOT / "recommend-rules.json"
    if not path.exists():
        raise FileNotFoundError("recommend-rules.json 缺失，请先运行 npm run build")
    data = json.loads(path.read_text(encoding="utf-8"))
    if not data.get("options"):
        raise ValueError("recommend-rules.json options 为空")
    print("✓ recommend-rules.json")


SITE_BASE = "/ai/"


def _normalize_local_href(href: str) -> str | None:
    href = href.strip()
    if not href or href.startswith(("#", "http://", "https://", "mailto:", "data:", "javascript:")):
        return None
    if "#" in href:
        href = href.split("#", 1)[0]
    if "?" in href:
        href = href.split("?", 1)[0]
    return href or None


def _resolve_dist_target(fp: Path, href: str) -> Path | None:
    """相对路径或 `/ai/...` 绝对路径 → dist 内目标文件。"""
    if href.startswith(SITE_BASE):
        return (ROOT / href[len(SITE_BASE) :]).resolve()
    if href.startswith("/"):
        return None
    return (fp.parent / href).resolve()


def validate_html_links() -> None:
    html_files = [
        ROOT / "index.html",
        ROOT / "ai-tools-ranking.html",
        ROOT / "ai-learning-roadmap.html",
        *ROOT.glob("tools/*.html"),
        *ROOT.glob("compare/*.html"),
        *ROOT.glob("news/*.html"),
        *ROOT.glob("guides/*.html"),
    ]
    missing = []
    checked = 0
    for fp in html_files:
        if not fp.exists():
            continue
        soup = BeautifulSoup(fp.read_text(encoding="utf-8"), "html.parser")
        refs = [a.get("href", "") for a in soup.select("[href]")]
        refs += [t.get("src", "") for t in soup.select("[src]")]
        for raw in refs:
            href = _normalize_local_href(raw)
            if href is None:
                continue
            target = _resolve_dist_target(fp, href)
            if target is None:
                continue
            checked += 1
            try:
                target.relative_to(ROOT)
            except ValueError:
                missing.append(f"{fp.relative_to(ROOT)} -> {href} (越界)")
                continue
            if not target.exists():
                missing.append(f"{fp.relative_to(ROOT)} -> {href}")
    for asset in ("style.css", "app.js", "search-index.json", "recommend-rules.json", "recommend.js"):
        if not (ROOT / asset).exists():
            missing.append(f"(dist root) -> {asset}")
    if missing:
        raise ValueError("死链:\n" + "\n".join(missing[:30]))
    print(f"✓ HTML 链接检查 ({len(html_files)} 个文件, {checked} 条本地引用)")


def validate_analytics_config() -> None:
    path = ROOT / "analytics-config.json"
    if not path.exists():
        raise FileNotFoundError("analytics-config.json 缺失，请先运行 npm run build")
    data = json.loads(path.read_text(encoding="utf-8"))
    for key in (
        "ga_measurement_id",
        "clarity_project_id",
        "umami_script_url",
        "umami_website_id",
        "cloudflare_beacon_token",
        "track_engagement",
    ):
        if key not in data:
            raise ValueError(f"analytics-config.json 缺少 {key}")
    ga = str(data.get("ga_measurement_id") or "").strip()
    clarity = str(data.get("clarity_project_id") or "").strip()
    umami_script = str(data.get("umami_script_url") or "").strip()
    umami_id = str(data.get("umami_website_id") or "").strip()
    cf_beacon = str(data.get("cloudflare_beacon_token") or "").strip()
    if ga and not ga.startswith("G-"):
        raise ValueError(f"ga_measurement_id 格式应为 G-xxxxxxxxxx，当前：{ga!r}")
    if (umami_script and not umami_id) or (umami_id and not umami_script):
        raise ValueError("Umami 需同时配置 umami_script_url 与 umami_website_id")
    if umami_script and not (
        umami_script.startswith("https://") or umami_script.startswith("http://")
    ):
        raise ValueError(f"umami_script_url 应为 http(s) URL，当前：{umami_script!r}")
    privacy_on = bool((umami_script and umami_id) or cf_beacon)
    if not ga and not clarity and not privacy_on:
        print(
            "⚠ analytics：Umami/CF/GA/Clarity 未配置（允许；Secrets 或 data/analytics.json 可启用）"
        )
    print(
        "✓ analytics-config.json（"
        f"Umami={'on' if umami_script and umami_id else 'off'} "
        f"CF={'on' if cf_beacon else 'off'} "
        f"GA={'on' if ga else 'off'} "
        f"Clarity={'on' if clarity else 'off'}）"
    )


def validate_oss_projects() -> None:
    path = REPO / "data" / "oss-projects.json"
    if not path.exists():
        raise FileNotFoundError("data/oss-projects.json 缺失")
    data = json.loads(path.read_text(encoding="utf-8"))
    Draft202012Validator(_load_schema("oss-projects.schema.json")).validate(data)
    runtime = ROOT / "oss-projects.json"
    if not runtime.exists() and not (REPO / "oss-projects.json").exists():
        raise FileNotFoundError("oss-projects.json 运行时副本缺失")
    print(f"✓ oss-projects.json schema ({len(data.get('domains') or [])} 领域)")


def validate_data_json() -> None:
    for name in (
        "site.json",
        "tools.json",
        "compares.json",
        "analytics.json",
        "oss-projects.json",
        "rankings.json",
        "tool-relations.json",
        "engagement.json",
    ):
        path = REPO / "data" / name
        if not path.exists():
            raise FileNotFoundError(path)
        json.loads(path.read_text(encoding="utf-8"))
    print("✓ data/*.json 可解析")


def validate_engagement() -> None:
    path = REPO / "data" / "engagement.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    Draft202012Validator(_load_schema("engagement.schema.json")).validate(data)
    runtime = ROOT / "engagement.json"
    if not runtime.exists():
        raise FileNotFoundError("engagement.json 缺失，请先运行 npm run build")
    ids = [t.get("id") for t in data.get("tools") or []]
    if len(ids) != len(set(ids)):
        raise ValueError("engagement.json tools.id 重复")
    print(f"✓ engagement.json schema ({len(ids)} 工具热度)")


def validate_tool_relations() -> None:
    data = json.loads((REPO / "data/tool-relations.json").read_text(encoding="utf-8"))
    Draft202012Validator(_load_schema("tool-relations.schema.json")).validate(data)
    tools = json.loads((REPO / "data/tools.json").read_text(encoding="utf-8"))
    known = {t["id"] for t in tools}
    unknown: list[str] = []
    for source_id, rel in data.items():
        if source_id not in known:
            unknown.append(f"source:{source_id}")
        for kind in ("alternatives", "complements"):
            for edge in rel.get(kind) or []:
                target = edge.get("id")
                if target not in known:
                    unknown.append(f"{source_id}.{kind}:{target}")
                if target == source_id:
                    raise AssertionError(f"self-relation forbidden: {source_id}.{kind}")
    if unknown:
        raise AssertionError(f"tool-relations unknown ids: {', '.join(unknown)}")
    print(f"✓ tool-relations.json schema + ids ({len(data)} 工具)")


STEPS = (
    ("data", validate_data_json),
    ("tool-relations", validate_tool_relations),
    ("oss", validate_oss_projects),
    ("videos", validate_daily_videos),
    ("news", validate_ai_news),
    ("courses", validate_ai_courses),
    ("runtime", validate_runtime_json),
    ("recommend", validate_recommend_rules),
    ("sitemap", validate_sitemap_robots),
    ("search", validate_search_index),
    ("analytics", validate_analytics_config),
    ("engagement", validate_engagement),
    ("links", validate_html_links),
)


def main() -> int:
    only = sys.argv[1] if len(sys.argv) > 1 else None
    for label, fn in STEPS:
        if only and label != only:
            continue
        print(f"→ 检查 {label}…", flush=True)
        fn()
    if only:
        print(f"✓ {only} 校验通过")
    else:
        print("全部 CI 校验通过")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        import traceback
        print(f"CI 校验失败: {exc}", file=sys.stderr)
        traceback.print_exc()
        summary = os.environ.get("GITHUB_STEP_SUMMARY")
        if summary:
            with open(summary, "a", encoding="utf-8") as fh:
                fh.write(f"### CI 校验失败\n\n```\n{exc}\n```\n")
        raise SystemExit(1)
