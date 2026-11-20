"""Which records count as research articles with a usable abstract.

OpenAlex types nearly every journal item as "article", including editorials, symposium and
special-issue introductions, replies and rejoinders, and old PAR items whose "abstract" is
only the author-and-title citation line. These rules keep:

  * OpenAlex type == "article" (55 "review" records are left out), and
  * not an editorial, introduction, comment, reply, rejoinder, correction or obituary, and
  * an abstract that is an abstract: not a citation header, reference list or
    "Related Content" block, and at least 50 words long.

`reasons(paper)` returns the list of rules a record fails; an empty list means eligible.
Run `python -m pa_map eligibility` to write data/review/excluded_records.csv for audit.
"""
from __future__ import annotations

import csv
import re
from collections import Counter

MIN_ABSTRACT_WORDS = 50

TITLE = re.compile(r"""^\s*(?:
  introduction\b|editorial\b|editor'?s?\b|from\ the\ editors?|guest\ editor|(?:mini[-\ ]?)?symposium\b|special\ issue\b|
  book\ reviews?\b|review\ essay\b|books?\ received|a\ response\b|response\ to\b|reply\b|rejoinder\b|comment(?:ary)?\ on\b|
  \[?erratum|\[?corrigendum|\[?correction\b|in\ memoriam|obituary|foreword\b|preface\b|turning\ the\ page|an?\ \w+'s\ response)
  |:\s*(?:an?\ )?(?:introduction|response|reply|rejoinder|comment|commentary)\b
  |introduction\ to\ the\ (?:special\ issue|symposium)""", re.I | re.X)

ABSTRACT_START = re.compile(r"""^\W*(?:abstract\s+)?(?:in\ this\ (?:special\ issue|symposium)|this\ (?:special\ issue|symposium)
  |related\ content:|s\ of\ books\ received|wish\ to\ call)""", re.I | re.X)

ISSUE_INTRO = re.compile(r"""this\ special\ issue|special\ issue\ introduction|this\ symposium|this\ introduction
  |introduces\ the\ (?:themes|special\ issue|symposium)
  |(?:articles|papers|contributions|essays)\ (?:in|to)\ this\ (?:special\ )?(?:issue|symposium)|in\ this\ issue\ of""", re.I | re.X)

COMMENTARY = re.compile(r"""^\W*(?:abstract\s+)?(?:
  this\ (?:article|essay|paper|note)\ (?:comments|responds|replies|reacts)\ (?:on|to)\ (?:the\ preceding|an?\ (?:recent\ )?(?:article|essay|paper)|the\ (?:article|essay))
  |(?:in\ )?(?:a\ )?(?:recent\ )?(?:article|essay)\ in\ (?:this|a\ recent)\ (?:issue|journal)
  |in\ (?:their|his|her)\ (?:recent\ )?(?:article|essay)
  |in\ [“"‘'][^”"’']{10,200}[”"’'],?\ [A-Z])""", re.I | re.X)
REFERENCE_START = re.compile(r"^\W*[A-Z][A-Za-z'\-]+,\s+(?:[A-Z]\.\s*){1,3}(?:,|and\b|\(|\d{4})")

LABELS = {
    "type": "OpenAlex type is not 'article'",
    "title": "editorial, introduction, comment, reply, rejoinder or correction (title)",
    "issue_intro": "symposium / special-issue introduction or editorial (abstract)",
    "citation_header": "abstract is only the author-and-title citation line",
    "reference_list": "abstract is a reference list",
    "commentary": "commentary on another article (abstract)",
    "short_abstract": f"abstract shorter than {MIN_ABSTRACT_WORDS} words",
    "no_abstract": "no abstract",
}


def _citation_header(title: str, abstract: str) -> bool:
    key = re.escape(title[:30]).replace(r"\ ", r"\s+")
    m = re.search(key, abstract[:350], re.I)
    if not m or m.start() == 0:
        return False
    pre = abstract[:m.start()]
    return (pre.rstrip().endswith(",") and len(pre.replace(",", " ").split()) <= 14
            and not re.search(r"\b(this|the|article|study|we|is|of)\b", pre, re.I))


def reasons(p: dict) -> list[str]:
    t, a = p.get("title") or "", (p.get("abstract") or "").strip()
    out = []
    if p.get("type") != "article":
        out.append("type")
    if TITLE.search(t):
        out.append("title")
    if not a:
        out.append("no_abstract")
        return out
    if ABSTRACT_START.search(a) or ISSUE_INTRO.search(a[:300]):
        out.append("issue_intro")
    if _citation_header(t, a):
        out.append("citation_header")
    if COMMENTARY.search(a[:300]):
        out.append("commentary")
    if (len(re.findall(r"[A-Za-z],\s+(?:19|20)\d{2}[a-d]?\.", a[:600])) >= 3 or "Books Received" in a[:300]
            or REFERENCE_START.search(a)):
        out.append("reference_list")
    if len(a.split()) < MIN_ABSTRACT_WORDS:
        out.append("short_abstract")
    return out


def is_research_article(p: dict) -> bool:
    return not reasons(p)


def run(cfg=None):
    from .common import INTERIM, REVIEW, read_jsonl
    papers = list(read_jsonl(INTERIM / "papers.jsonl"))
    rows, c = [], Counter()
    for p in papers:
        r = reasons(p)
        for k in r:
            c[k] += 1
        if r:
            rows.append({"id": p["id"], "year": p["year"], "journal": p["journal"], "type": p["type"],
                         "reasons": ";".join(r), "title": p["title"], "abstract_start": (p.get("abstract") or "")[:200]})
    out = REVIEW / "excluded_records.csv"
    with open(out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]) if rows else ["id"])
        w.writeheader(); w.writerows(rows)
    with_abs = [p for p in papers if (p.get("abstract") or "").strip()]
    keep = sum(1 for p in with_abs if not reasons(p))
    print(f"{len(papers)} records; {len(with_abs)} with an abstract; {keep} eligible research articles with a usable abstract")
    for k, n in c.most_common():
        print(f"  {n:5d}  {LABELS[k]}")
    print(f"Excluded records listed in {out}")
