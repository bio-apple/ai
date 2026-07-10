#!/usr/bin/env python3
"""从 data/*.json 生成 index.html、tools/、compare/、SEO 页、search-index.json、sitemap.xml。"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
TEMPLATES = ROOT / "templates"
BRAND = "Bio AI Lab"


def load_json(name: str):
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def tool_lookup(site: dict) -> dict[str, dict]:
    found: dict[str, dict] = {}
    for cat in site.get("home_tool_categories", []):
        for tool in cat.get("tools", []):
            found[tool["id"]] = tool
    return found


def build_hot_tool_cards(site: dict) -> list[dict]:
    lookup = tool_lookup(site)
    return [lookup[tid] for tid in site.get("hot_tools", []) if tid in lookup]


def build_create_tool_cards(site: dict) -> list[dict]:
    lookup = tool_lookup(site)
    return [lookup[tid] for tid in site.get("create_tools", []) if tid in lookup]


def flatten_nav_labels(menu: list) -> dict[str, str]:
    labels: dict[str, str] = {}
    for item in menu:
        if item.get("type") == "tab":
            labels[item["id"]] = item["label"]
        elif item.get("type") == "dropdown":
            for sub in item.get("children", []):
                labels[sub["id"]] = sub["label"]
    return labels


def build_schema(site: dict, tools: list) -> str:
    meta = site["meta"]
    graph = [
        {
            "@type": "WebSite",
            "name": BRAND,
            "url": meta["canonical"],
            "description": meta["description"],
            "inLanguage": "zh-CN",
            "potentialAction": {
                "@type": "SearchAction",
                "target": f"{meta['canonical']}?q={{search_term_string}}",
                "query-input": "required name=search_term_string",
            },
        },
        {
            "@type": "FAQPage",
            "mainEntity": [
                {
                    "@type": "Question",
                    "name": q["question"],
                    "acceptedAnswer": {"@type": "Answer", "text": q["answer"]},
                }
                for q in site.get("faq", [])
            ],
        },
        {
            "@type": "ItemList",
            "name": "2026 AI 工具排行榜",
            "itemListElement": [
                {
                    "@type": "ListItem",
                    "position": i + 1,
                    "name": row["name"],
                    "description": row["dimension"],
                }
                for i, row in enumerate(site.get("rankings", []))
            ],
        },
    ]
    return json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False)


def build_tool_schema(tool: dict, base_url: str) -> str:
    data = {
        "@context": "https://schema.org",
        "@type": "TechArticle",
        "headline": f"{tool['name']} 教程 2026",
        "description": tool["description"],
        "author": {"@type": "Organization", "name": BRAND},
        "mainEntityOfPage": f"{base_url}tools/{tool['id']}.html",
    }
    return json.dumps(data, ensure_ascii=False)


def build_compare_schema(compare: dict, base_url: str) -> str:
    data = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": compare["title"],
        "description": compare["meta_description"],
        "author": {"@type": "Organization", "name": BRAND},
        "mainEntityOfPage": f"{base_url}compare/{compare['slug']}.html",
    }
    return json.dumps(data, ensure_ascii=False)


def build_page_schema(title: str, description: str, url: str) -> str:
    data = {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "name": title,
        "description": description,
        "url": url,
        "author": {"@type": "Organization", "name": BRAND},
    }
    return json.dumps(data, ensure_ascii=False)


def build_search_index(site: dict, tools: list, cases: dict, compares: list) -> list:
    items = []
    for t in tools:
        kw = " ".join(
            filter(
                None,
                [
                    t["id"],
                    t["name"],
                    t["description"],
                    " ".join(f["title"] for f in t.get("features", [])),
                ],
            )
        )
        items.append({"label": f"{t['name']} 教程", "section": t["section_id"], "keywords": kw})
        items.append(
            {
                "label": f"{t['name']} 独立页",
                "url": f"tools/{t['id']}.html",
                "keywords": kw,
            }
        )
    for c in cases.get("cases", []):
        kw = " ".join([c.get("tool", ""), c.get("title", ""), c.get("summary", ""), *c.get("scenarios", [])])
        items.append({"label": c["title"], "section": "section-cases", "keywords": kw})
    items.append({"label": "实战案例", "section": "section-cases", "keywords": "实战 案例 提示词 prompt"})
    items.append({"label": "每日视频", "section": "section-videos", "keywords": "视频 youtube bilibili 教程 每日"})
    items.append({"label": "AI 新闻", "section": "section-news", "keywords": "AI新闻 OpenAI Anthropic DeepMind"})
    items.append({"label": "AI 创作", "section": "section-create", "keywords": "创作 绘图 视频 写作"})
    items.append(
        {
            "label": "AI 工具排行榜",
            "url": "ai-tools-ranking.html",
            "keywords": "排行榜 ranking ChatGPT Claude Cursor DeepSeek",
        }
    )
    items.append(
        {
            "label": "AI 学习路线",
            "url": "ai-learning-roadmap.html",
            "keywords": "学习路线 roadmap 入门 进阶",
        }
    )
    items.append(
        {
            "label": "今日 AI 热点",
            "url": "news/daily-ai-news.html",
            "keywords": "AI新闻 热点 OpenAI Anthropic",
        }
    )
    for slug in ("beginner", "advanced"):
        guide = site.get("guides", {}).get(slug, {})
        if guide:
            items.append(
                {
                    "label": guide.get("h1", slug),
                    "url": f"guides/{slug}.html",
                    "keywords": guide.get("lead", slug),
                }
            )
    for cmp in compares:
        items.append(
            {
                "label": cmp.get("h1") or cmp["title"],
                "url": f"compare/{cmp['slug']}.html",
                "keywords": cmp.get("search_keywords", cmp["title"]),
            }
        )
    for g in site.get("compare_guides", []):
        if not any(x.get("url") == g["href"] for x in items):
            items.append({"label": g["title"], "url": g["href"], "keywords": g["title"]})
    return items


def build_sitemap(base_url: str, tools: list, compares: list) -> str:
    urls = [f"  <url><loc>{base_url}</loc><changefreq>daily</changefreq><priority>1.0</priority></url>"]
    for page in ("ai-tools-ranking.html", "ai-learning-roadmap.html", "news/daily-ai-news.html"):
        urls.append(
            f"  <url><loc>{base_url}{page}</loc><changefreq>daily</changefreq><priority>0.9</priority></url>"
        )
    for slug in ("beginner", "advanced"):
        urls.append(
            f"  <url><loc>{base_url}guides/{slug}.html</loc><changefreq>monthly</changefreq><priority>0.85</priority></url>"
        )
    for t in tools:
        urls.append(
            f"  <url><loc>{base_url}tools/{t['id']}.html</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>"
        )
    for c in compares:
        urls.append(
            f"  <url><loc>{base_url}compare/{c['slug']}.html</loc><changefreq>monthly</changefreq><priority>0.9</priority></url>"
        )
    body = "\n".join(urls)
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f"{body}\n</urlset>\n"
    )


def main() -> int:
    site = load_json("site.json")
    tools = load_json("tools.json")
    cases = load_json("cases.json")
    compares = load_json("compares.json")
    meta = site["meta"]
    tool_names = {t["id"]: t["name"] for t in tools}
    nav_labels = flatten_nav_labels(site["nav"]["menu"])

    env = Environment(
        loader=FileSystemLoader(str(TEMPLATES)),
        autoescape=select_autoescape(["html", "j2"]),
    )

    schema_json = build_schema(site, tools)
    index_html = env.get_template("index.html.j2").render(
        meta=meta,
        nav=site["nav"],
        hero=site["hero"],
        hot_tool_cards=build_hot_tool_cards(site),
        create_tool_cards=build_create_tool_cards(site),
        home_tool_categories=site["home_tool_categories"],
        rankings=site["rankings"],
        ai_picker=site["ai_picker"],
        scenarios=site["scenarios"],
        compare_guides=site["compare_guides"],
        learning_paths=site["learning_paths"],
        footer=site["footer"],
        tools=tools,
        cases=cases,
        tool_names=tool_names,
        nav_labels=nav_labels,
        schema_json=schema_json,
    )
    (ROOT / "index.html").write_text(index_html, encoding="utf-8")

    tools_dir = ROOT / "tools"
    tools_dir.mkdir(exist_ok=True)
    tool_tpl = env.get_template("tool_page.html.j2")
    for tool in tools:
        html = tool_tpl.render(
            tool=tool,
            meta=meta,
            nav=site["nav"],
            footer=site["footer"],
            schema_json=build_tool_schema(tool, meta["base_url"]),
        )
        (tools_dir / f"{tool['id']}.html").write_text(html, encoding="utf-8")

    compare_dir = ROOT / "compare"
    compare_dir.mkdir(exist_ok=True)
    cmp_tpl = env.get_template("compare_page.html.j2")
    for compare in compares:
        html = cmp_tpl.render(
            compare=compare,
            meta=meta,
            nav=site["nav"],
            footer=site["footer"],
            schema_json=build_compare_schema(compare, meta["base_url"]),
        )
        (compare_dir / f"{compare['slug']}.html").write_text(html, encoding="utf-8")

    ranking_tpl = env.get_template("ranking_page.html.j2")
    ranking_page = site["ranking_page"]
    (ROOT / "ai-tools-ranking.html").write_text(
        ranking_tpl.render(
            page=ranking_page,
            meta=meta,
            nav=site["nav"],
            footer=site["footer"],
            rankings=site["rankings"],
            compare_table=site["compare_table"],
            schema_json=build_page_schema(
                ranking_page["title"],
                ranking_page["lead"],
                f"{meta['base_url']}ai-tools-ranking.html",
            ),
        ),
        encoding="utf-8",
    )

    roadmap_tpl = env.get_template("roadmap_page.html.j2")
    roadmap_page = site["roadmap_page"]
    (ROOT / "ai-learning-roadmap.html").write_text(
        roadmap_tpl.render(
            page=roadmap_page,
            meta=meta,
            nav=site["nav"],
            footer=site["footer"],
            learning_paths=site["learning_paths"],
            tool_names=tool_names,
            schema_json=build_page_schema(
                roadmap_page["title"],
                roadmap_page["lead"],
                f"{meta['base_url']}ai-learning-roadmap.html",
            ),
        ),
        encoding="utf-8",
    )

    news_dir = ROOT / "news"
    news_dir.mkdir(exist_ok=True)
    news_tpl = env.get_template("news_page.html.j2")
    news_page = site["news_page"]
    (news_dir / "daily-ai-news.html").write_text(
        news_tpl.render(
            page=news_page,
            meta=meta,
            nav=site["nav"],
            footer=site["footer"],
            schema_json=build_page_schema(
                news_page["title"],
                news_page["lead"],
                f"{meta['base_url']}news/daily-ai-news.html",
            ),
        ),
        encoding="utf-8",
    )

    guides_dir = ROOT / "guides"
    guides_dir.mkdir(exist_ok=True)
    guide_tpl = env.get_template("guide_page.html.j2")
    paths = site.get("learning_paths", [])
    for slug, guide in site.get("guides", {}).items():
        path = paths[0] if slug == "beginner" and paths else (paths[1] if len(paths) > 1 else paths[0])
        if slug == "advanced" and len(paths) > 1:
            path = paths[1]
        (guides_dir / f"{guide['slug']}.html").write_text(
            guide_tpl.render(
                guide=guide,
                path=path,
                meta=meta,
                nav=site["nav"],
                footer=site["footer"],
                schema_json=build_page_schema(
                    guide["title"],
                    guide["lead"],
                    f"{meta['base_url']}guides/{guide['slug']}.html",
                ),
            ),
            encoding="utf-8",
        )

    search_index = build_search_index(site, tools, cases, compares)
    (ROOT / "search-index.json").write_text(
        json.dumps(search_index, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    (ROOT / "sitemap.xml").write_text(build_sitemap(meta["base_url"], tools, compares), encoding="utf-8")

    print(f"✓ index.html")
    print(f"✓ tools/ ({len(tools)} 页)")
    print(f"✓ compare/ ({len(compares)} 页)")
    print(f"✓ news/daily-ai-news.html + guides/ (2 页)")
    print(f"✓ ai-tools-ranking.html + ai-learning-roadmap.html")
    print(f"✓ search-index.json ({len(search_index)} 条)")
    print(f"✓ sitemap.xml")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
