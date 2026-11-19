"""Synthetic DEMO data that exercises the real clean -> cluster -> export stages.

Every record is fake: titles end with "(synthetic)", authors are "Demo Author N", DOIs use the
Crossref test prefix 10.5555, and the site shows a "Demo data" banner. Never publish this as results.

Run:  python -m pa_map demo        (writes to pipeline/demo/ and site/public/data/)
"""
from __future__ import annotations

import json
import math
import random

import numpy as np

THEMES = [
    ("performance", ["performance management", "accountability", "performance information", "targets", "league tables", "results-based management"]),
    ("motivation", ["public service motivation", "job satisfaction", "employee engagement", "red tape", "work motivation", "turnover intention"]),
    ("networks", ["collaborative governance", "policy networks", "network management", "partnerships", "co-production", "cross-sector collaboration"]),
    ("digital", ["digital government", "e-government", "algorithmic decision-making", "artificial intelligence", "open data", "platform services"]),
    ("bureaucracy", ["political control of bureaucracy", "civil service reform", "agency autonomy", "ministerial advisers", "politicization", "senior executives"]),
    ("finance", ["budgeting", "fiscal stress", "public debt", "participatory budgeting", "tax administration", "financial management"]),
    ("citizens", ["citizen satisfaction", "trust in government", "street-level bureaucrats", "administrative burden", "service encounters", "citizen participation"]),
    ("regulation", ["regulatory agencies", "regulatory governance", "inspection", "risk regulation", "independent regulators", "compliance"]),
    ("reform", ["new public management", "public sector reform", "contracting out", "privatization", "agencification", "post-NPM reform"]),
    ("diversity", ["representative bureaucracy", "gender equity", "diversity management", "social equity", "inclusion", "discrimination"]),
]
CONTEXTS = ["in local government", "in central agencies", "in European welfare states", "in China", "in the United States",
            "across OECD countries", "in public hospitals", "in schools", "in developing countries", "during crises",
            "in municipal services", "in federal systems", "in the Nordic countries", "in Latin America"]
FORMS = ["{a} and {b} {c}", "Explaining {a}: evidence {c}", "Does {a} improve {b}? A study {c}",
         "{a}, {b}, and public value {c}", "Rethinking {a} {c}", "The politics of {a} {c}",
         "A survey experiment on {a} {c}", "{a} under pressure: {b} {c}", "Measuring {a} {c}"]
# share of each theme over time: (peak year, width, base weight)
CURVES = [(1998, 14, 1.2), (2012, 14, 1.0), (2010, 10, 0.9), (2022, 7, 0.8), (1985, 16, 1.1),
          (1983, 18, 0.9), (2016, 12, 1.0), (2003, 10, 0.7), (1996, 8, 1.0), (2018, 12, 0.7)]
VOLUME = {"PAR": (55, 95), "PA": (25, 65), "JPART": (18, 60), "PMR": (35, 85), "GOV": (18, 40)}
JUNK = ["Book Reviews", "Erratum", "Editorial", "Issue Information", "Reviewers list 20{y:02d}", "In Memoriam"]


def theme_weights(year):
    w = np.array([b * math.exp(-((year - p) / s) ** 2 / 2) + 0.15 for p, s, b in CURVES])
    return w / w.sum()


def make_raw(cfg, rng: random.Random, nrng):
    from .common import RAW, append_jsonl, write_json
    latent = {}
    crossref = []
    n_id = 0
    for j in cfg["journals"]:
        code = j["code"]
        path = RAW / f"openalex_{code}.jsonl"
        path.unlink(missing_ok=True)
        rows = []
        lo, hi = VOLUME[code]
        for y in range(max(j["start"], cfg["project"]["window_start"]), cfg["project"]["window_end"] + 2):
            if code == "GOV" and y == 1990:
                continue                                    # a deliberate data gap
            n = int((lo + (hi - lo) * (y - 1980) / 45) * rng.uniform(0.85, 1.15))
            if y == cfg["project"]["window_end"] + 1:
                n = 6                                       # online-first items for next year
            w = theme_weights(y)
            for _ in range(n):
                n_id += 1
                t = int(nrng.choice(len(THEMES), p=w))
                sub = rng.randrange(6)
                terms = THEMES[t][1]
                a, b = terms[sub], terms[(sub + rng.randrange(1, 6)) % 6]
                title = rng.choice(FORMS).format(a=a.capitalize() if True else a, b=b, c=rng.choice(CONTEXTS)) + " (synthetic)"
                title = title[0].upper() + title[1:]
                has_abs = rng.random() < (0.35 + 0.6 * (y - 1980) / 45 if code == "PAR" else 0.75 + 0.25 * (y - 1980) / 45)
                abstract = (f"This synthetic abstract discusses {a} and {b} {rng.choice(CONTEXTS)}. "
                            f"It exists only to test the pipeline and contains no findings. " * 3) if has_abs else ""
                pid = f"D{n_id:06d}"
                doi = f"10.5555/demo.{n_id:06d}"
                online_first = rng.random() < 0.08 and y < cfg["project"]["window_end"] + 1
                oa_year = y - 1 if online_first else y
                fp = rng.randrange(1, 900)
                rows.append(_oa(pid, doi, title, oa_year, "article", fp, fp + rng.randrange(8, 30), abstract, n_id, code, rng))
                crossref.append({"doi": doi, "found": True, "type": "journal-article", "ji_print_year": y,
                                 "ji_online_year": None, "print_year": y, "online_year": oa_year, "issued_year": oa_year,
                                 "volume": str(y - 1960), "issue": "1", "page": None, "title": title, "container": code})
                latent[pid] = (t, sub)
            # non-research items that must be filtered out
            for k in range(rng.randrange(1, 4)):
                n_id += 1
                jt = rng.choice(JUNK).format(y=y % 100)
                typ = "erratum" if jt == "Erratum" else ("editorial" if jt == "Editorial" else "article")
                rows.append(_oa(f"D{n_id:06d}", f"10.5555/demo.{n_id:06d}", jt, y, typ, 1, 2, "", n_id, code, rng))
        # an exact DOI duplicate to exercise dedup
        if rows:
            dup = dict(rows[5]); dup["id"] = "https://openalex.org/D999" + code
            rows.append(dup)
        append_jsonl(path, rows)
    from .common import RAW as _R
    (_R / "crossref.jsonl").unlink(missing_ok=True)
    append_jsonl(_R / "crossref.jsonl", crossref)
    write_json(_R / "latent.json", latent)
    return latent


def _oa(pid, doi, title, year, typ, fp, lp, abstract, n, code, rng):
    inv = {}
    for i, wd in enumerate(abstract.split()):
        inv.setdefault(wd, []).append(i)
    return {"id": f"https://openalex.org/{pid}", "doi": f"https://doi.org/{doi}", "title": title, "display_name": title,
            "publication_year": year, "type": typ, "biblio": {"first_page": str(fp), "last_page": str(lp)},
            "authorships": [{"author": {"display_name": f"Demo Author {rng.randrange(1, 2500)}"}} for _ in range(rng.randrange(1, 5))],
            "abstract_inverted_index": inv or None, "referenced_works_count": rng.randrange(10, 80),
            "cited_by_count": int(rng.paretovariate(1.3) * 5), "_journal": code}


def make_embeddings(latent, nrng, dim=64):
    from .common import INTERIM, PRIVATE, read_jsonl
    papers = read_jsonl(INTERIM / "papers.jsonl")
    T = nrng.normal(size=(len(THEMES), dim)) * 2.0
    S = T[:, None, :] + nrng.normal(size=(len(THEMES), 6, dim)) * 1.1
    full, title = [], []
    for p in papers:
        t, s = latent[p["id"]]
        base = S[t, s]
        full.append(base + nrng.normal(size=dim) * (1.9 if p["has_abstract"] else 2.3))
        title.append(base + nrng.normal(size=dim) * 2.6)
    np.save(PRIVATE / "emb_full.npy", np.array(full, dtype=np.float32))
    np.save(PRIVATE / "emb_title.npy", np.array(title, dtype=np.float32))
    with open(PRIVATE / "ids.json", "w") as f:
        json.dump([p["id"] for p in papers], f)


PRETTY = ["Performance & Accountability", "Public Service Motivation", "Collaborative Governance & Networks",
          "Digital Government", "Bureaucracy & Political Control", "Public Finance & Budgeting",
          "Citizen–State Interactions", "Regulation & Agencies", "NPM & Public Sector Reform",
          "Representation & Social Equity"]


def _simulate_review(latent):
    """Stand-in for the human review step: name each macro theme after its majority latent theme."""
    import csv
    from collections import Counter, defaultdict
    from .common import INTERIM, LABELS, read_jsonl
    votes = defaultdict(Counter)
    for a in read_jsonl(INTERIM / "assignments.jsonl"):
        votes[a["macro"]][latent[a["id"]][0]] += 1
    path = LABELS / "topics.csv"
    rows = list(csv.DictReader(open(path, encoding="utf-8")))
    for r in rows:
        if r["level"] == "macro":
            t = votes[int(r["id"])].most_common(1)[0][0]
            r["label"] = PRETTY[t]
            r["description"] = f"Demo theme built from synthetic titles about {THEMES[t][1][0]} and {THEMES[t][1][1]}."
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)


def run(cfg):
    from . import clean, cluster, export
    from .common import LABELS
    rng, nrng = random.Random(7), np.random.default_rng(7)
    cfg["project"]["data_version"] = "demo"
    (LABELS / "topics.csv").unlink(missing_ok=True)
    latent = make_raw(cfg, rng, nrng)
    clean.run(cfg)
    make_embeddings(latent, nrng)
    cfg["cluster"]["k_grid"] = [40, 50]
    cfg["cluster"]["seeds"] = [0, 1, 2]
    cluster.run(cfg, projection="tsne")
    _simulate_review(latent)
    export.run(cfg, status="demo")
    print("DEMO data written. Replace it by running the real pipeline before publishing.")
