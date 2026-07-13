from __future__ import annotations

import math
import re
from typing import Any

from backend.services.data_store import load_search_index, runtime_path

TOKEN_RE = re.compile(r"[\w\u4e00-\u9fff]+", re.UNICODE)


def tokenize(text: str) -> list[str]:
    return [t.lower() for t in TOKEN_RE.findall(text or "") if len(t) > 1]


def build_doc_text(item: dict) -> str:
    parts = [
        item.get("label", ""),
        item.get("keywords", ""),
        item.get("type", ""),
        item.get("section", ""),
        item.get("url", ""),
    ]
    return " ".join(str(p) for p in parts if p)


class KnowledgeIndex:
    def __init__(self, items: list[dict] | None = None) -> None:
        self.items = items if items is not None else load_search_index()
        self._docs: list[dict[str, Any]] = []
        self._df: dict[str, int] = {}
        self._avg_dl = 1.0
        self._build()

    def _build(self) -> None:
        total_len = 0
        for item in self.items:
            text = build_doc_text(item)
            tokens = tokenize(text)
            tf: dict[str, int] = {}
            for tok in tokens:
                tf[tok] = tf.get(tok, 0) + 1
            self._docs.append({"item": item, "tf": tf, "len": len(tokens) or 1})
            total_len += len(tokens) or 1
            for tok in set(tokens):
                self._df[tok] = self._df.get(tok, 0) + 1
        n = len(self._docs) or 1
        self._avg_dl = total_len / n

    def _bm25(self, query_tokens: list[str], doc: dict[str, Any]) -> float:
        k1, b = 1.2, 0.75
        score = 0.0
        n = len(self._docs) or 1
        dl = doc["len"]
        for tok in query_tokens:
            if tok not in doc["tf"]:
                continue
            df = self._df.get(tok, 0)
            idf = math.log((n - df + 0.5) / (df + 0.5) + 1.0)
            tf = doc["tf"][tok]
            denom = tf + k1 * (1 - b + b * dl / self._avg_dl)
            score += idf * (tf * (k1 + 1)) / denom
        return score

    def search(self, query: str, limit: int = 5) -> list[dict]:
        q_tokens = tokenize(query)
        if not q_tokens:
            return []
        scored: list[tuple[float, dict]] = []
        for doc in self._docs:
            s = self._bm25(q_tokens, doc)
            if s > 0:
                scored.append((s, doc["item"]))
        scored.sort(key=lambda x: x[0], reverse=True)
        results = []
        for score, item in scored[:limit]:
            results.append(
                {
                    "label": item.get("label"),
                    "section": item.get("section"),
                    "url": item.get("url"),
                    "anchor": item.get("anchor"),
                    "type": item.get("type"),
                    "score": round(score, 4),
                }
            )
        return results

    def answer(self, query: str, limit: int = 5) -> dict:
        hits = self.search(query, limit=limit)
        if not hits:
            return {
                "query": query,
                "answer": "暂未找到相关内容。可尝试换用工具名（如 Cursor、ChatGPT）或关键词（Prompt、案例、视频）重新提问。",
                "sources": [],
            }
        lines = [f"根据站内知识库，为你找到 {len(hits)} 条相关内容："]
        for i, hit in enumerate(hits, start=1):
            label = hit.get("label") or "条目"
            kind = hit.get("type") or "页面"
            if hit.get("url"):
                ref = hit["url"]
            elif hit.get("section"):
                ref = f"#{hit['section']}"
                if hit.get("anchor"):
                    ref += f"（{hit['anchor']}）"
            else:
                ref = "站内"
            lines.append(f"{i}. [{kind}] {label} → {ref}")
        return {
            "query": query,
            "answer": "\n".join(lines),
            "sources": hits,
        }


_index: KnowledgeIndex | None = None
_index_mtime: float | None = None


def get_knowledge_index() -> KnowledgeIndex:
    """按 search-index.json mtime 失效重建，与 data_store 缓存对齐。"""
    global _index, _index_mtime
    path = runtime_path("search-index.json")
    mtime = path.stat().st_mtime if path.exists() else 0.0
    if _index is None or _index_mtime != mtime:
        _index = KnowledgeIndex(load_search_index())
        _index_mtime = mtime
    return _index