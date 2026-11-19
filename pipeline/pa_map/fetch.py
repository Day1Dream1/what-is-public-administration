"""Stage 1a: build the candidate list from OpenAlex and enrich it with Crossref dates.

Outputs (local only, never published):
  data/raw/openalex_<CODE>.jsonl   one OpenAlex work per line
  data/raw/sources.json            resolved OpenAlex source ids per journal
  data/raw/crossref.jsonl          Crossref journal metadata keyed by DOI (date and issue fields only)
"""
from __future__ import annotations

import json
import os
import time
from concurrent.futures import ThreadPoolExecutor

import requests

from .common import RAW, append_jsonl, load_config, norm_doi, read_jsonl, write_json

OPENALEX = "https://api.openalex.org"
CROSSREF = "https://api.crossref.org"
SELECT = ",".join([
    "id", "doi", "title", "display_name", "publication_year", "publication_date", "type",
    "biblio", "authorships", "abstract_inverted_index", "referenced_works_count",
    "cited_by_count", "primary_location", "language",
])


def _get(session: requests.Session, url: str, params=None, tries: int = 5):
    for i in range(tries):
        try:
            r = session.get(url, params=params, timeout=45)
        except (requests.ConnectionError, requests.Timeout):
            if i == tries - 1:
                raise
            time.sleep(2 ** i)
            continue
        if r.status_code == 200:
            return r.json()
        if r.status_code == 404:
            return None
        if (r.status_code != 429 and r.status_code < 500) or i == tries - 1:
            raise RuntimeError(f"HTTP {r.status_code} on {url}")
        retry_after = r.headers.get("Retry-After", "")
        wait = min(60, int(retry_after)) if retry_after.isdigit() else 2 ** i
        print(f"  HTTP {r.status_code} on {url} — retrying in {wait}s")
        time.sleep(wait)


def _session(cfg, *, openalex=False):
    session = requests.Session()
    contact = cfg["project"].get("mailto")
    session.headers["User-Agent"] = "what-is-public-administration/0.1"
    if contact:
        session.headers["User-Agent"] += f" (mailto:{contact})"
        session.params["mailto"] = contact
    if openalex and os.environ.get("OPENALEX_API_KEY"):
        session.params["api_key"] = os.environ["OPENALEX_API_KEY"]
    return session


def resolve_sources(cfg: dict, session: requests.Session) -> dict:
    """Map each journal code to the OpenAlex source ids found for its ISSNs."""
    out = {}
    for j in cfg["journals"]:
        ids = {}
        for issn in j["issn"][:1] + j.get("predecessor_issn", [])[:1]:
            src = _get(session, f"{OPENALEX}/sources/issn:{issn}")
            if src:
                ids[src["id"].rsplit("/", 1)[-1]] = src.get("display_name")
        if not ids:
            raise SystemExit(f"No OpenAlex source found for {j['code']} ISSNs {j['issn']} — check config.toml")
        out[j["code"]] = ids
        print(f"{j['code']}: {ids}")
    write_json(RAW / "sources.json", out, compact=False)
    return out


def fetch_openalex(cfg: dict, pilot: bool = False):
    p = cfg["project"]
    start = p["pilot_start"] if pilot else p["window_start"]
    # fetch one extra year at the end so online-first items can be re-dated from Crossref
    end = p["window_end"] + 1
    with _session(cfg, openalex=True) as session:
        sources = resolve_sources(cfg, session)

    def fetch_journal(item):
        code, ids = item
        path = RAW / f"openalex_{code}.jsonl"
        temp = path.with_suffix(".jsonl.part")
        temp.write_text("", encoding="utf-8")
        journal_start = max(start - 1, cfg["journal_by_code"][code]["start"] - 1)
        flt = f"primary_location.source.id:{'|'.join(ids)},publication_year:{journal_start}-{end}"
        page, ids_seen = 1, set()
        page_size = 200
        with _session(cfg, openalex=True) as session:
            while True:
                data = _get(session, f"{OPENALEX}/works", {
                    "filter": flt, "per_page": page_size, "page": page, "select": SELECT,
                })
                count = data["meta"]["count"]
                if count > 10_000:
                    raise RuntimeError(f"OpenAlex returned {count} results for {code}; split the query by year")
                rows = data["results"]
                for r in rows:
                    r["_journal"] = code
                    ids_seen.add(r["id"])
                append_jsonl(temp, rows)
                if page * page_size >= count or not rows:
                    break
                page += 1
        if len(ids_seen) != count:
            raise RuntimeError(f"OpenAlex pagination returned {len(ids_seen)} unique {code} records; expected {count}")
        temp.replace(path)
        print(f"{code}: {count} OpenAlex records -> {path.name}")

    with ThreadPoolExecutor(max_workers=3) as executor:
        list(executor.map(fetch_journal, sources.items()))


def _date_year(obj):
    try:
        return int(obj["date-parts"][0][0])
    except (KeyError, IndexError, TypeError, ValueError):
        return None


def fetch_crossref(cfg: dict, pilot: bool = False):
    """Bulk page each Crossref journal, preserving issue dates absent in selective responses."""
    p = cfg["project"]
    cache_path = RAW / "crossref.jsonl"
    start = p["pilot_start"] if pilot else p["window_start"]
    end = p["window_end"] + 1
    temp = cache_path.with_suffix(".jsonl.part")
    temp.write_text("", encoding="utf-8")
    seen = set()
    with _session(cfg) as session:
        for journal in cfg["journals"]:
            issns = list(journal.get("crossref_issn", [journal["issn"][-1]]))
            if not pilot and journal.get("predecessor_issn"):
                issns.append(journal["predecessor_issn"][0])
            for issn in issns:
                cursor, n = "*", 0
                page_size = 500
                earliest = max(start - 2, journal["start"] - 2)
                while True:
                    data = _get(session, f"{CROSSREF}/journals/{issn}/works", {
                        "filter": f"from-pub-date:{earliest}-01-01,until-pub-date:{end}-12-31",
                        "cursor": cursor, "rows": page_size,
                    })
                    if not data:
                        raise RuntimeError(f"Crossref journal not found for ISSN {issn}")
                    message = data["message"]
                    items = message["items"]
                    rows = []
                    for item in items:
                        doi = norm_doi(item.get("DOI"))
                        if not doi or doi in seen:
                            continue
                        seen.add(doi)
                        issue = item.get("journal-issue") or {}
                        rows.append({
                            "doi": doi,
                            "type": item.get("type"),
                            "ji_print_year": _date_year(issue.get("published-print")),
                            "ji_online_year": _date_year(issue.get("published-online")),
                            "print_year": _date_year(item.get("published-print")),
                            "online_year": _date_year(item.get("published-online")),
                            "issued_year": _date_year(item.get("issued")),
                            "volume": item.get("volume"),
                            "issue": item.get("issue") or issue.get("issue"),
                            "page": item.get("page"),
                            "title": (item.get("title") or [None])[0],
                            "container": (item.get("container-title") or [None])[0],
                        })
                    append_jsonl(temp, rows)
                    n += len(items)
                    if len(items) < page_size or n >= message["total-results"]:
                        break
                    cursor = message["next-cursor"]
                print(f"Crossref {journal['code']} ({issn}): {n} records")
    temp.replace(cache_path)
    print(f"Crossref cache: {len(seen)} unique DOIs")


if __name__ == "__main__":
    import sys
    c = load_config()
    fetch_openalex(c, pilot="--pilot" in sys.argv)
    fetch_crossref(c)
    print(json.dumps({"ok": True}))
