"""Stage 1b: assign years, filter document types, deduplicate, and build the coverage table.

Inputs : data/raw/openalex_<CODE>.jsonl, data/raw/crossref.jsonl
Outputs: data/interim/papers.jsonl     eligible papers (LOCAL ONLY: contains abstracts)
         data/review/exclusions.csv    every excluded record with its reason
         data/review/manual_check.csv  kept records that a human should look at
         data/review/coverage.csv      journal x year reconciliation table
"""
from __future__ import annotations

import csv
import re
from collections import Counter, defaultdict
from difflib import SequenceMatcher

from .common import INTERIM, PIPELINE_DIR, RAW, REVIEW, clean_title, load_config, norm_doi, norm_title, read_jsonl


def abstract_from_index(inv: dict | None) -> str:
    if not inv:
        return ""
    pos = {}
    for word, idxs in inv.items():
        for i in idxs:
            pos[i] = word
    return " ".join(pos[i] for i in sorted(pos))


def page_count(first, last, crossref_page=None, *, start_page_only=False):
    def _num(x):
        m = re.match(r"^[A-Za-z]*(\d+)$", str(x or "").strip())
        return int(m.group(1)) if m else None
    f, l = _num(first), _num(last)
    range_parts = re.split(r"[-–—]", crossref_page or "", maxsplit=1)
    if len(range_parts) == 2:
        a, b = range_parts
        cf, cl = _num(a), _num(b)
        if cf is not None and cl is not None and cl >= cf:
            return cl - cf + 1
    if start_page_only and f == l:
        return None
    if f is not None and l is not None and l >= f:
        return l - f + 1
    return None


def assign_year(oa_year, cr: dict, volume, issue, journal: dict):
    """Prefer assigned issue chronology, with publication-date fallbacks."""
    archive_year = None
    if issue and str(volume).isdigit() and int(volume) > 0 and "volume_year_offset" in journal:
        archive_year = int(volume) + journal["volume_year_offset"]
    for key, src in (("ji_print_year", "crossref.journal-issue.published-print"),
                     ("print_year", "crossref.published-print")):
        if cr.get(key) and (archive_year is None or cr[key] == archive_year):
            return int(cr[key]), src
    if archive_year is not None:
        return archive_year, "publisher.volume_calendar"
    for key, src in (("ji_online_year", "crossref.journal-issue.published-online"),
                     ("issued_year", "crossref.issued")):
        if cr.get(key):
            return int(cr[key]), src
    return (int(oa_year), "openalex.publication_year") if oa_year else (None, "missing")


def publisher_decisions():
    path = PIPELINE_DIR / "audit" / "publisher-sample.csv"
    if not path.exists():
        return {}
    decisions = {}
    with path.open(encoding="utf-8", newline="") as stream:
        for row in csv.DictReader(stream):
            ident = norm_doi(row["doi"]) or row.get("openalex_id", "").strip()
            decision = row["decision"].strip()
            if ident and decision:
                if decision not in {"keep", "drop"} or (ident in decisions and decisions[ident]["decision"] != decision):
                    raise ValueError(f"Invalid or conflicting publisher decision for {ident}")
                decisions[ident] = row
    return decisions


def run(cfg: dict, pilot: bool = False):
    p, fl = cfg["project"], cfg["filter"]
    start = p["pilot_start"] if pilot else p["window_start"]
    end = p["window_end"]
    crossref = {r["doi"]: r for r in read_jsonl(RAW / "crossref.jsonl")}
    decisions = publisher_decisions()
    excl_res = [(re.compile(x, re.I), x) for x in fl["exclude_title_patterns"]]
    prac_res = [re.compile(x, re.I) for x in fl["par_practitioner_patterns"]]
    min_words = cfg["embed"]["min_abstract_words"]

    kept, excluded, manual = [], [], []
    candidates = Counter()   # (journal, year) -> n candidates inside window
    for j in cfg["journals"]:
        code = j["code"]
        for w in read_jsonl(RAW / f"openalex_{code}.jsonl"):
            doi = norm_doi(w.get("doi"))
            cr = crossref.get(doi, {})
            ident = w["id"].rsplit("/", 1)[-1]
            title = clean_title(w.get("title") or w.get("display_name"))
            b = w.get("biblio") or {}
            issue = cr.get("issue") or b.get("issue")
            volume = cr.get("volume") or b.get("volume")
            year, ysrc = assign_year(w.get("publication_year"), cr, volume, issue, j)
            decision = decisions.get(doi) or decisions.get(ident)
            if decision and decision["decision"] == "keep" and decision.get("year"):
                year, ysrc = int(decision["year"]), "publisher.issue_year"
            rec = {
                "id": ident,
                "doi": doi,
                "title": title,
                "authors": [a["author"]["display_name"] for a in (w.get("authorships") or [])
                            if (a.get("author") or {}).get("display_name")],
                "journal": code,
                "year": year,
                "year_source": ysrc,
                "oa_year": w.get("publication_year"),
                "type": w.get("type"),
                "volume": volume,
                "issue": issue,
                "unassigned_issue": ysrc in {"crossref.issued", "openalex.publication_year"} and not (issue and volume),
                "pages": page_count(b.get("first_page"), b.get("last_page"), cr.get("page"),
                                    start_page_only=(code == "PAR" and (doi or "").startswith("10.2307/"))),
                "refs": w.get("referenced_works_count") or 0,
                "cited_by": w.get("cited_by_count") or 0,
                "abstract": abstract_from_index(w.get("abstract_inverted_index")),
                "predecessor": bool(j.get("predecessor_until") and year and year <= j["predecessor_until"]),
            }

            def drop(reason):
                excluded.append({**{k: rec[k] for k in ("id", "doi", "journal", "year", "type", "pages", "title")}, "reason": reason})

            if year is None:
                drop("no_year"); continue
            if year > end:
                drop(f"after_cutoff_{end}"); continue
            if year < max(start, j["start"]):
                drop("before_window_or_launch"); continue
            candidates[(code, year)] += 1
            if not title:
                drop("no_title"); continue
            if decision and decision["decision"] == "drop":
                drop(f"publisher_section:{decision['section']}"); continue
            confirmed = decision and decision["decision"] == "keep"
            if not confirmed and rec["type"] not in fl["keep_types"]:
                drop(f"type:{rec['type']}"); continue
            hit = next((pat for rx, pat in excl_res if rx.search(title)), None)
            if hit and not confirmed:
                drop(f"title_pattern:{hit}"); continue
            if not confirmed and code == "PAR" and any(rx.search(title) for rx in prac_res):
                mode = fl["par_practitioner_sections"]
                if mode == "exclude":
                    drop("par_practitioner_section"); continue
                if mode in {"review", "research_only"}:
                    manual.append({**rec, "check": "par_practitioner_section"})
            if not confirmed and rec["pages"] is not None and rec["pages"] < fl["min_pages"]:
                drop(f"pages<{fl['min_pages']}"); continue
            if rec["pages"] is None and rec["refs"] == 0:
                manual.append({**rec, "check": "no_pages_no_refs"})
            words = len(rec["abstract"].split())
            rec["has_abstract"] = words >= min_words
            rec["input_mode"] = "title_and_abstract" if rec["has_abstract"] else "title_only"
            if not rec["has_abstract"]:
                rec["abstract"] = ""
            kept.append(rec)

    # --- deduplication -------------------------------------------------------
    by_doi, final = {}, []
    for r in kept:
        if r["doi"]:
            if r["doi"] in by_doi:
                prev = by_doi[r["doi"]]
                better = r if (r["has_abstract"], r["refs"]) > (prev["has_abstract"], prev["refs"]) else prev
                worse = prev if better is r else r
                by_doi[r["doi"]] = better
                excluded.append({**{k: worse[k] for k in ("id", "doi", "journal", "year", "type", "pages", "title")}, "reason": "duplicate_doi"})
            else:
                by_doi[r["doi"]] = r
    final = list(by_doi.values())
    seen = {}
    for r in kept:
        if r["doi"]:
            continue
        key = (r["journal"], r["year"], norm_title(r["title"]))
        if key in seen:
            excluded.append({**{k: r[k] for k in ("id", "doi", "journal", "year", "type", "pages", "title")}, "reason": "duplicate_title_no_doi"})
        else:
            seen[key] = r
            final.append(r)
    # near-duplicates (same journal, |year diff| <= 1, title similarity >= .93): flag only
    groups = defaultdict(list)
    for r in final:
        groups[r["journal"]].append(r)
    for code, rows in groups.items():
        rows.sort(key=lambda r: norm_title(r["title"]))
        for a, b in zip(rows, rows[1:]):
            ta, tb = norm_title(a["title"]), norm_title(b["title"])
            if abs((a["year"] or 0) - (b["year"] or 0)) <= 1 and ta and SequenceMatcher(None, ta, tb).ratio() >= 0.93:
                manual.append({**b, "check": f"near_duplicate_of:{a['id']}"})

    final.sort(key=lambda r: (r["journal"], r["year"], r["title"]))
    with open(INTERIM / "papers.jsonl", "w", encoding="utf-8") as f:
        import json
        for r in final:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    _write_csv(REVIEW / "exclusions.csv", excluded, ["id", "doi", "journal", "year", "type", "pages", "title", "reason"])
    _write_csv(REVIEW / "manual_check.csv", manual, ["check", "id", "doi", "journal", "year", "type", "pages", "refs", "title"])

    # --- coverage table ---------------------------------------------------------
    elig, abst, unassigned = Counter(), Counter(), Counter()
    for r in final:
        elig[(r["journal"], r["year"])] += 1
        abst[(r["journal"], r["year"])] += r["has_abstract"]
        unassigned[(r["journal"], r["year"])] += r["unassigned_issue"]
    excl_by = Counter((e["journal"], e["year"]) for e in excluded if e.get("year"))
    cov = []
    for j in cfg["journals"]:
        for y in range(start, end + 1):
            k = (j["code"], y)
            if y < j["start"]:
                status = "not_launched"
            elif elig[k] == 0:
                status = "gap"          # launched but nothing eligible: check publisher TOC
            else:
                status = "ok"
            cov.append({
                "journal": j["code"], "year": y, "status": status,
                "predecessor": bool(j.get("predecessor_until") and y <= j["predecessor_until"]),
                "candidates": candidates[k], "excluded": excl_by[k],
                "eligible": elig[k], "with_abstract": abst[k], "mapped": elig[k],
                "unassigned_issue": unassigned[k],
            })
    _write_csv(REVIEW / "coverage.csv", cov, list(cov[0].keys()))
    reasons = Counter(e["reason"].split(":")[0] for e in excluded)
    print(f"eligible={len(final)}  excluded={len(excluded)}  manual_check={len(manual)}")
    print("exclusion reasons:", dict(reasons.most_common()))
    return final


def _write_csv(path, rows, fields):
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)


if __name__ == "__main__":
    import sys
    run(load_config(), pilot="--pilot" in sys.argv)
