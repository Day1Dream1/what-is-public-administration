"""Stage 4b: reference lists from Crossref, for the citation network (Ch3, Explore › Citation Flows).

OpenAlex now asks for an API key, so references come from Crossref, where publishers deposit
open reference lists. A reference counts only if it carries a DOI that matches a corpus paper.

  python -m pa_map refs       resumes; ~1 hour for 10,600 DOIs at polite speed

Output (local only): data/raw/crossref_refs.jsonl  {doi, n_ref, ref_dois, ok}
"""
from __future__ import annotations

import concurrent.futures as cf
import json
import time
import urllib.parse

import requests

from .common import INTERIM, RAW, read_jsonl


def run(cfg, workers=8):
    out = RAW / "crossref_refs.jsonl"
    done = {r["doi"] for r in read_jsonl(out)}
    todo = [p["doi"] for p in read_jsonl(INTERIM / "papers.jsonl") if p.get("doi") and p["doi"] not in done]
    mail = cfg["project"].get("mailto") or ""
    s = requests.Session()
    s.headers["User-Agent"] = "what-is-public-administration" + (f" (mailto:{mail})" if mail else "")
    print(f"{len(done)} cached, {len(todo)} to fetch")

    def get(doi):
        url = "https://api.crossref.org/works/" + urllib.parse.quote(doi, safe="/")
        for i in range(5):
            try:
                r = s.get(url, params={"mailto": mail} if mail else None, timeout=40)
                if r.status_code == 404:
                    return {"doi": doi, "ok": False, "err": 404}
                if r.status_code == 200:
                    m = r.json()["message"]
                    refs = [x["DOI"].lower() for x in m.get("reference", []) if x.get("DOI")]
                    return {"doi": doi, "ok": True, "n_ref": len(m.get("reference", [])), "ref_dois": refs}
            except requests.RequestException:
                pass
            time.sleep(2 ** i)
        return {"doi": doi, "ok": False, "err": "retry"}

    with open(out, "a", encoding="utf-8") as f, cf.ThreadPoolExecutor(workers) as ex:
        for k, res in enumerate(ex.map(get, todo), 1):
            f.write(json.dumps(res) + "\n")
            if k % 500 == 0:
                f.flush()
                print(f"  {k}/{len(todo)}")
