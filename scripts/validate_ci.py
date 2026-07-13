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
    sitemap = sitemap_files[0].read_text(encoding="utf-8")
    if "Sitemap:" not in robots:
        raise ValueError("robots.txt 缺少 Sitemap 声明")
    if ("<urlset" not in sitemap and "<sitemapindex" not in sitemap) or "<loc>" not in sitemap:
        raise ValueError("sitemap 格式无效")
    if "https://bio-apple.github.io/ai/" not in sitemap:
        raise ValueError("sitemap 缺少首页 URL")
    print(f"✓ robots.txt + {sitemap_files[0].name}")


def validate_search_index() -> None:
    data = json.loads((ROOT / "search-index.json").read_text(encoding="utf-8"))
    if not isinstance(data, list) or len(data) < 10:
        raise ValueError("search-index.json 条目过少")
    for item in data:
        if not item.get("label") or not item.get("keywords"):
            raise ValueError(f"search-index 条目不完整: {item}")
        if not item.get("section") and not item.get("url"):
            raise ValueError(f"search-index 缺少 section/url: {item}")
    print(f"✓ search-index.json ({len(data)} 条)")


def validate_ai_news() -> None:
    path = ROOT / "ai-news.json"
    if not path.exists():
        path = REPO / "ai-news.json"
    if not path.exists():
        raise FileNotFoundError("ai-news.json 缺失，请先运行 scripts/fetch_ai_news.py")
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data.get("items"), list) or not data["items"]:
        raise ValueError("ai-news.json items 为空")
    for item in data["items"][:3]:
        if not item.get("title") or not item.get("url"):
            raise ValueError(f"ai-news 条目不完整: {item}")
    print(f"✓ ai-news.json ({len(data['items'])} 条)")


def validate_runtime_json() -> None:
    for name in ("prompts.json", "tutorials.json"):
        path = ROOT / name
        if not path.exists():
            raise FileNotFoundError(f"{name} 缺失，请先运行 npm run build")
        data = json.loads(path.read_text(encoding="utf-8"))
        if name == "prompts.json" and not data.get("prompts"):
            raise ValueError("prompts.json prompts 为空")
        if name == "tutorials.json" and not data.get("tutorials"):
            raise ValueError("tutorials.json tutorials 为空")
    print("✓ prompts.json + tutorials.json")


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
        # 非站点 base 的绝对路径不在本仓库校验范围
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
        *ROOT.glob("prompts/*.html"),
        *ROOT.glob("cases/**/*.html"),
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
    for asset in ("style.css", "app.js", "search-index.json"):
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
    for key in ("ga_measurement_id", "clarity_project_id", "track_engagement"):
        if key not in data:
            raise ValueError(f"analytics-config.json 缺少 {key}")
    print("✓ analytics-config.json")


def validate_oss_projects() -> None:
    path = REPO / "data" / "oss-projects.json"
    if not path.exists():
        raise FileNotFoundError("data/oss-projects.json 缺失")
    data = json.loads(path.read_text(encoding="utf-8"))
    domains = data.get("domains") or []
    if len(domains) < 6:
        raise ValueError("oss-projects.json 领域不足 6 个")
    for domain in domains:
        if not domain.get("projects"):
            raise ValueError(f"开源领域无项目: {domain.get('id')}")
    runtime = ROOT / "oss-projects.json"
    if not runtime.exists() and not (REPO / "oss-projects.json").exists():
        raise FileNotFoundError("oss-projects.json 运行时副本缺失")
    print(f"✓ oss-projects.json ({len(domains)} 领域)")


def validate_data_json() -> None:
    for name in ("site.json", "tools.json", "cases.json", "compares.json", "prompts.json", "tutorials.json", "videos.json", "analytics.json", "oss-projects.json"):
        path = REPO / "data" / name
        if not path.exists():
            raise FileNotFoundError(path)
        json.loads(path.read_text(encoding="utf-8"))
    print("✓ data/*.json 可解析")


STEPS = (
    ("data", validate_data_json),
    ("oss", validate_oss_projects),
    ("videos", validate_daily_videos),
    ("news", validate_ai_news),
    ("runtime", validate_runtime_json),
    ("sitemap", validate_sitemap_robots),
    ("search", validate_search_index),
    ("analytics", validate_analytics_config),
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
