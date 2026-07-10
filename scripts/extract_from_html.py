#!/usr/bin/env python3
"""一次性从 index.html 提取内容到 data/*.json（维护后通常只改 JSON + 运行 build）。"""

from __future__ import annotations

import json
import re
from pathlib import Path

from bs4 import BeautifulSoup, Tag

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
INDEX = ROOT / "index.html"


def inner_html(el: Tag) -> str:
    return "".join(str(c) for c in el.children).strip()


def parse_features(ul: Tag | None) -> list[dict]:
    if not ul:
        return []
    items = []
    for li in ul.select("li"):
        strong = li.find("strong")
        if strong:
            title = strong.get_text(strip=True)
            rest = li.get_text(" ", strip=True)
            desc = rest.replace(title, "", 1).lstrip(" —").strip()
            items.append({"title": title, "description": desc})
    return items


def parse_steps(ol: Tag | None) -> list[str]:
    if not ol:
        return []
    return [inner_html(li) for li in ol.select(":scope > li")]


def parse_resources(grid: Tag | None) -> list[dict]:
    if not grid:
        return []
    items = []
    for a in grid.select("a[href]"):
        rtype = a.select_one(".resource-type")
        h4 = a.select_one("h4")
        meta = a.select_one(".resource-meta")
        items.append(
            {
                "type": rtype.get_text(strip=True) if rtype else "article",
                "type_class": (rtype.get("class") or ["article"])[-1] if rtype else "article",
                "href": a["href"],
                "title": h4.get_text(strip=True) if h4 else "",
                "meta": meta.get_text(strip=True) if meta else "",
            }
        )
    return items


def parse_shortcuts(section: Tag) -> dict | None:
    for h3 in section.select("h3.resources-title"):
        if "快捷键" in h3.get_text():
            table = h3.find_next("table", class_="compare-table")
            if not table:
                continue
            rows = []
            for tr in table.select("tbody tr"):
                cells = [td.get_text(strip=True) for td in tr.select("td")]
                if len(cells) >= 2:
                    rows.append({"key": inner_html(tr.select("td")[0]), "action": cells[1]})
            return {"title": h3.get_text(strip=True), "rows": rows}
    return None


def extract_tool(section: Tag) -> dict:
    tool_id = section["id"].replace("section-", "")
    header = section.select_one(".tool-header")
    icon_el = header.select_one(".tool-icon") if header else None
    h2 = header.select_one("h2") if header else None
    desc = header.select_one(".desc") if header else None

    cards = section.select(".grid-2 .card")
    steps_ol = cards[0].select_one("ol.steps") if cards else None
    features_ul = cards[1].select_one("ul.features") if len(cards) > 1 else None

    video_resources: list[dict] = []
    text_resources: list[dict] = []
    for h3 in section.select("h3.resources-title"):
        grid = h3.find_next("div", class_="resource-grid")
        if not grid:
            continue
        if "视频" in h3.get_text():
            video_resources = parse_resources(grid)
        elif "文字" in h3.get_text():
            text_resources = parse_resources(grid)

    return {
        "id": tool_id,
        "section_id": section["id"],
        "icon": icon_el.get_text(strip=True) if icon_el else "",
        "name": h2.get_text(strip=True) if h2 else tool_id,
        "description": desc.get_text(strip=True) if desc else "",
        "getting_started_steps": parse_steps(steps_ol),
        "features": parse_features(features_ul),
        "video_resources": video_resources,
        "text_resources": text_resources,
        "shortcuts": parse_shortcuts(section),
    }


def extract_case_steps(body: Tag) -> list[dict]:
    steps = []
    for li in body.select("ol.case-steps > li"):
        step: dict = {"title": "", "blocks": []}
        title_el = li.select_one(".step-title")
        if title_el:
            step["title"] = title_el.get_text(strip=True)
        for child in li.children:
            if not isinstance(child, Tag):
                continue
            if child.get("class") and "step-title" in child.get("class", []):
                continue
            if child.name == "div" and "prompt-block" in (child.get("class") or []):
                step["blocks"].append({"type": "prompt", "content": child.get_text("\n", strip=True)})
            elif child.name == "p" and "step-tip" in (child.get("class") or []):
                step["blocks"].append({"type": "tip", "content": inner_html(child)})
            elif child.name == "p":
                step["blocks"].append({"type": "paragraph", "content": inner_html(child)})
            elif child.name == "ul" and "checklist" in (child.get("class") or []):
                step["blocks"].append(
                    {
                        "type": "checklist",
                        "content": [x.get_text(strip=True) for x in child.select("li")],
                    }
                )
        steps.append(step)
    return steps


def extract_case(article: Tag) -> dict:
    header = article.select_one(".case-header")
    meta = header.select_one(".case-meta") if header else None
    badge = meta.select_one(".case-badge") if meta else None
    level = meta.select_one(".case-level") if meta else None
    time_el = meta.select_one(".case-time") if meta else None
    tags = [t.get_text(strip=True) for t in (meta.select(".case-tag") if meta else [])]
    body = article.select_one(".case-body")
    goal_el = body.select_one(".case-goal") if body else None
    prereq_el = body.select_one(".case-prereq") if body else None

    title_el = header.select_one("h3") if header else None
    summary_el = header.select_one(".case-summary") if header else None

    return {
        "id": f"{article.get('data-tool', 'case')}-{title_el.get_text(strip=True)[:20] if title_el else 'untitled'}",
        "tool": article.get("data-tool", ""),
        "scenarios": (article.get("data-scenario") or "").split(),
        "level": level.get_text(strip=True) if level else "",
        "duration": time_el.get_text(strip=True) if time_el else "",
        "tags": tags,
        "title": title_el.get_text(strip=True) if title_el else "",
        "summary": summary_el.get_text(strip=True) if summary_el else "",
        "goal": goal_el.get_text(strip=True).replace("目标：", "") if goal_el else "",
        "prereq": prereq_el.get_text(strip=True).replace("准备：", "") if prereq_el else "",
        "steps": extract_case_steps(body) if body else [],
    }


def extract_site(soup: BeautifulSoup) -> dict:
    home = soup.select_one("#section-home")
    hero = home.select_one(".hero") if home else None
    main = home.select_one("main") if home else None

    quick_find = []
    for btn in hero.select(".quick-find-card") if hero else []:
        spans = btn.select("span")
        quick_find.append(
            {
                "icon": spans[0].get_text(strip=True) if spans else "",
                "title": btn.select_one("strong").get_text(strip=True) if btn.select_one("strong") else "",
                "subtitle": spans[-1].get_text(strip=True) if len(spans) > 1 else "",
                "goto": btn.get("data-goto", ""),
                "track": btn.get("data-track", ""),
            }
        )

    categories = []
    if hero:
        labels = hero.select(".category-label")
        card_groups = hero.select(".tool-cards")
        for label, group in zip(labels, card_groups):
            tools = []
            for card in group.select(".tool-card"):
                tools.append(
                    {
                        "id": card.get("data-tool", ""),
                        "badge": card.select_one(".badge").get_text(strip=True) if card.select_one(".badge") else "",
                        "name": card.select_one("h3").get_text(strip=True) if card.select_one("h3") else "",
                        "summary": card.select_one("p").get_text(strip=True) if card.select_one("p") else "",
                    }
                )
            categories.append({"label": label.get_text(strip=True), "tools": tools})

    scenarios = []
    for card in main.select(".scenario-card") if main else []:
        scenarios.append(
            {
                "icon": card.select_one(".icon").get_text(strip=True) if card.select_one(".icon") else "",
                "title": card.select_one("h4").get_text(strip=True) if card.select_one("h4") else "",
                "description": card.select_one("p").get_text(strip=True) if card.select_one("p") else "",
            }
        )

    compare_guides = []
    for a in main.select(".compare-guide-card") if main else []:
        compare_guides.append(
            {
                "tag": a.select_one(".compare-guide-tag").get_text(strip=True) if a.select_one(".compare-guide-tag") else "",
                "title": a.select_one("h4").get_text(strip=True) if a.select_one("h4") else "",
                "description": a.select_one("p").get_text(strip=True) if a.select_one("p") else "",
                "href": a.get("href", ""),
                "track": a.get("data-track", ""),
            }
        )

    compare_rows = []
    table = main.select_one(".compare-table") if main else None
    if table:
        for tr in table.select("tbody tr"):
            tds = tr.select("td")
            if len(tds) >= 5:
                compare_rows.append(
                    {
                        "tool": tds[0].get_text(strip=True),
                        "type": tds[1].get_text(strip=True),
                        "strength": tds[2].get_text(strip=True),
                        "scenario": tds[3].get_text(strip=True),
                        "pricing": tds[4].get_text(strip=True),
                    }
                )

    learning_paths = []
    for card in main.select(".grid-2 .card") if main else []:
        h3 = card.select_one("h3")
        dot = card.select_one(".dot")
        dot_style = dot.get("style", "") if dot else ""
        m = re.search(r"background:\s*([^;]+)", dot_style)
        steps = [li.get_text(" ", strip=True) for li in card.select("ol.steps li")]
        learning_paths.append(
            {
                "title": h3.get_text(strip=True) if h3 else "",
                "dot_color": m.group(1).strip() if m else "var(--accent)",
                "steps": steps,
            }
        )

    faq_script = soup.find("script", type="application/ld+json")
    faq = []
    if faq_script and faq_script.string:
        ld = json.loads(faq_script.string)
        for node in ld.get("@graph", []):
            if node.get("@type") == "FAQPage":
                for q in node.get("mainEntity", []):
                    faq.append(
                        {
                            "question": q.get("name", ""),
                            "answer": q.get("acceptedAnswer", {}).get("text", ""),
                        }
                    )

    nav_tabs = []
    for btn in soup.select(".nav-tab"):
        nav_tabs.append({"id": btn.get("data-tool", ""), "label": btn.get_text(strip=True)})

    title = soup.title.get_text(strip=True) if soup.title else ""
    desc = soup.find("meta", attrs={"name": "description"})
    keywords = soup.find("meta", attrs={"name": "keywords"})
    canonical = soup.find("link", rel="canonical")

    cases_section = soup.select_one("#section-cases")
    tips = cases_section.select_one(".case-tips-card") if cases_section else None
    general_tips = None
    if tips:
        cols = []
        for ul in tips.select("ul.features"):
            cols.append([li.get_text(" ", strip=True) for li in ul.select("li")])
        general_tips = {"title": tips.select_one("h3").get_text(strip=True) if tips.select_one("h3") else "", "columns": cols}

    return {
        "meta": {
            "title": title,
            "description": desc["content"] if desc else "",
            "keywords": keywords["content"] if keywords else "",
            "canonical": canonical["href"] if canonical else "",
            "og_image": "https://bio-apple.github.io/ai/og-image.png",
            "base_url": "https://bio-apple.github.io/ai/",
        },
        "nav": {"logo": {"icon": "AI", "text": "AI 应用指南"}, "tabs": nav_tabs},
        "hero": {
            "title": hero.select_one("h1").get_text(strip=True) if hero and hero.select_one("h1") else "",
            "subtitle": hero.select_one("p").get_text(strip=True) if hero and hero.select_one("p") else "",
            "search_placeholder": soup.select_one("#site-search").get("placeholder", "") if soup.select_one("#site-search") else "",
        },
        "quick_find": quick_find,
        "home_tool_categories": categories,
        "scenarios": scenarios,
        "compare_guides": compare_guides,
        "compare_table": {"rows": compare_rows},
        "learning_paths": learning_paths,
        "faq": faq,
        "general_tips": general_tips,
        "footer": {
            "text": "AI 应用指南 · 学习如何使用与应用人工智能",
            "github": "https://github.com/bio-apple/ai",
        },
    }


def main() -> int:
    if not INDEX.exists():
        print(f"缺少 {INDEX}")
        return 1

    soup = BeautifulSoup(INDEX.read_text(encoding="utf-8"), "html.parser")
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    site = extract_site(soup)
    (DATA_DIR / "site.json").write_text(json.dumps(site, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    tools = []
    for section in soup.select("section.section[id^=section-]"):
        sid = section["id"]
        if sid in ("section-home", "section-cases", "section-videos"):
            continue
        tools.append(extract_tool(section))
    (DATA_DIR / "tools.json").write_text(json.dumps(tools, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    cases_section = soup.select_one("#section-cases")
    cases = {
        "header": {
            "title": cases_section.select_one("h2").get_text(strip=True) if cases_section and cases_section.select_one("h2") else "实战案例",
            "description": cases_section.select_one(".desc").get_text(strip=True) if cases_section and cases_section.select_one(".desc") else "",
        },
        "tool_filters": [b.get("data-filter", "") for b in cases_section.select(".case-filter")] if cases_section else [],
        "scenario_filters": [
            {"id": b.get("data-scenario", ""), "label": b.get_text(strip=True)}
            for b in (cases_section.select(".case-scenario") if cases_section else [])
        ],
        "cases": [extract_case(a) for a in cases_section.select("article.case-card")] if cases_section else [],
        "general_tips": site.get("general_tips"),
    }
    (DATA_DIR / "cases.json").write_text(json.dumps(cases, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"已写入 {DATA_DIR}/site.json, tools.json ({len(tools)}), cases.json ({len(cases['cases'])})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
