#!/usr/bin/env python3
"""从 data/*.json 生成 index.html、tools/、compare/、search-index.json、sitemap.xml。"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
TEMPLATES = ROOT / "templates"


def load_json(name: str):
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def build_schema(site: dict, tools: list) -> str:
    meta = site["meta"]
    graph = [
        {
            "@type": "WebSite",
            "name": "AI 应用指南",
            "url": meta["canonical"],
            "description": "中文用户的一站式 AI 工具实战指南",
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
            "name": "AI 工具选型速查",
            "itemListElement": [
                {
                    "@type": "ListItem",
                    "position": i + 1,
                    "name": row["tool"],
                    "description": row["strength"],
                }
                for i, row in enumerate(site.get("compare_table", {}).get("rows", [])[:5])
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
        "author": {"@type": "Organization", "name": "AI 应用指南"},
        "mainEntityOfPage": f"{base_url}tools/{tool['id']}.html",
    }
    return json.dumps(data, ensure_ascii=False)


def build_compare_schema(compare: dict, base_url: str) -> str:
    data = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": compare["title"],
        "description": compare["meta_description"],
        "author": {"@type": "Organization", "name": "AI 应用指南"},
        "mainEntityOfPage": f"{base_url}compare/{compare['slug']}.html",
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
    items.append({"label": "每日视频", "section": "section-videos", "keywords": "视频 youtube 教程 每日"})
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

    env = Environment(
        loader=FileSystemLoader(str(TEMPLATES)),
        autoescape=select_autoescape(["html", "j2"]),
    )

    schema_json = build_schema(site, tools)
    index_html = env.get_template("index.html.j2").render(
        meta=meta,
        nav=site["nav"],
        hero=site["hero"],
        quick_find=site["quick_find"],
        home_tool_categories=site["home_tool_categories"],
        scenarios=site["scenarios"],
        compare_guides=site["compare_guides"],
        compare_table=site["compare_table"],
        learning_paths=site["learning_paths"],
        footer=site["footer"],
        tools=tools,
        cases=cases,
        tool_names={t["id"]: t["name"] for t in tools},
        nav_labels={t["id"]: t["label"] for t in site["nav"]["tabs"]},
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
            schema_json=build_compare_schema(compare, meta["base_url"]),
        )
        (compare_dir / f"{compare['slug']}.html").write_text(html, encoding="utf-8")

    search_index = build_search_index(site, tools, cases, compares)
    (ROOT / "search-index.json").write_text(
        json.dumps(search_index, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    (ROOT / "sitemap.xml").write_text(build_sitemap(meta["base_url"], tools, compares), encoding="utf-8")

    print(f"✓ index.html")
    print(f"✓ tools/ ({len(tools)} 页)")
    print(f"✓ compare/ ({len(compares)} 页)")
    print(f"✓ search-index.json ({len(search_index)} 条)")
    print(f"✓ sitemap.xml")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
