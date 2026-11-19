"""Stage 3: write the public, versioned static data used by the website.

Only bibliographic fields, DOI, topic labels, 2-D coordinates and aggregates are published.
A whitelist check makes the build fail if anything else (abstracts, vectors …) slips in.

Outputs: site/public/data/{manifest,papers,topics,coverage,trends}.json
         site/public/data/downloads/{papers,coverage}.csv
"""
from __future__ import annotations

import csv
import datetime as dt
import hashlib
import json
import math
from collections import Counter, defaultdict

from .common import INTERIM, LABELS, REVIEW, SITE_DATA, load_config, read_jsonl, write_json

PALETTE = ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4",
           "#f97316", "#6366f1", "#84cc16", "#6b7280", "#14b8a6", "#e11d48"]
PAPER_FIELDS = ["id", "doi", "title", "authors", "year", "j", "m", "s", "x", "y", "a", "c"]
FORBIDDEN = {"abstract", "abstract_inverted_index", "embedding", "embeddings", "vector", "vectors", "emb", "fulltext", "full_text", "mailto", "api_key"}


def short_authors(names, n=3):
    if not names:
        return ""
    return ", ".join(names[:n]) + (" et al." if len(names) > n else "")


def read_csv(path):
    if not path.exists():
        return []
    with open(path, encoding="utf-8") as f:
        return list(csv.DictReader(f))


def check_fields(obj, where="root"):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k.lower() in FORBIDDEN:
                raise SystemExit(f"Field check failed: forbidden key '{k}' in {where}")
            check_fields(v, f"{where}.{k}")
    elif isinstance(obj, list):
        for v in obj:
            check_fields(v, where)


def _sha256(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def run(cfg, status="pilot"):
    paper_path = INTERIM / "papers.jsonl"
    assignment_path = INTERIM / "assignments.jsonl"
    papers = read_jsonl(paper_path)
    assignments = read_jsonl(assignment_path)
    assign = {a["id"]: a for a in assignments}
    labels = read_csv(LABELS / "topics.csv")
    coverage = read_csv(REVIEW / "coverage.csv")
    stab = read_csv(REVIEW / "stability.csv")
    sens_path = REVIEW / "sensitivity.json"
    sens = json.loads(sens_path.read_text(encoding="utf-8")) if sens_path.exists() else {}
    jcodes = [j["code"] for j in cfg["journals"]]
    if not papers or not coverage:
        raise SystemExit("The eligible corpus or its coverage table is empty; run clean first.")
    if len(assign) != len(assignments) or len({p["id"] for p in papers}) != len(papers):
        raise SystemExit("The release contains duplicate OpenAlex IDs.")
    if {p["id"] for p in papers} != set(assign):
        raise SystemExit("Map assignments do not exactly match the current corpus; rerun cluster.")
    if any(not math.isfinite(a[k]) or not 0 <= a[k] <= 1 for a in assignments for k in ("x", "y")):
        raise SystemExit("The map contains coordinates outside the finite [0, 1] range.")
    if status == "release":
        run_path = INTERIM / "cluster_provenance.json"
        state = json.loads(run_path.read_text(encoding="utf-8")) if run_path.exists() else {}
        if (state.get("projection") != "umap" or state.get("papers_sha256") != _sha256(paper_path)
                or state.get("assignments_sha256") != _sha256(assignment_path)
                or not sens_path.exists() or state.get("sensitivity_sha256") != _sha256(sens_path)):
            raise SystemExit("A release requires UMAP assignments produced from this exact corpus; rerun cluster.")
        if not stab or any(sens.get(key) is None for key in ("title_only_agreement_sub", "title_only_agreement_macro")):
            raise SystemExit("A release requires clustering stability and title-only sensitivity outputs.")

    rows, missing = [], 0
    for p in papers:
        a = assign.get(p["id"])
        if not a:
            missing += 1
            continue
        rows.append([p["id"], p["doi"], p["title"], short_authors(p["authors"]), p["year"],
                     jcodes.index(p["journal"]), a["macro"], a["sub"], a["x"], a["y"],
                     1 if p["has_abstract"] else 0, p.get("cited_by", 0)])
    if missing:
        raise SystemExit(f"{missing} eligible papers have no map assignment — rerun `cluster`")

    # topics
    m_n, s_n, s_xy, sub_parent = Counter(), Counter(), defaultdict(list), {}
    for r in rows:
        m_n[r[6]] += 1
        s_n[r[7]] += 1
        s_xy[r[7]].append((r[8], r[9]))
        if sub_parent.setdefault(r[7], r[6]) != r[6]:
            raise SystemExit(f"Subtopic {r[7]} has inconsistent parent themes.")
    lab = {(l["level"], int(l["id"])): l for l in labels}
    if status == "release":
        keys = set(("macro", m) for m in m_n) | set(("sub", s) for s in s_n)
        if set(lab) != keys or len(lab) != len(labels):
            raise SystemExit("The label sheet does not match the release assignments.")
        if any(not l["label"].strip() or l["reviewed"] != "yes" for l in lab.values()):
            raise SystemExit("All release theme labels require a name and a completed review.")
        if any(int(lab["sub", s]["macro"]) != parent for s, parent in sub_parent.items()):
            raise SystemExit("The label sheet has stale subtopic parent IDs.")
    macro = []
    for m in sorted(m_n):
        l = lab.get(("macro", m), {})
        macro.append({"id": m, "label": l.get("label") or l.get("draft_label") or f"Theme {m + 1}",
                      "description": l.get("description", ""), "reviewed": l.get("reviewed", "no") == "yes",
                      "color": PALETTE[m % len(PALETTE)], "n": m_n[m]})
    sub = []
    for s in sorted(s_n):
        l = lab.get(("sub", s), {})
        xs, ys = zip(*s_xy[s])
        sub.append({"id": s, "macro": sub_parent[s],
                    "label": l.get("label") or l.get("draft_label") or f"Subtopic {s + 1}",
                    "reviewed": l.get("reviewed", "no") == "yes", "n": s_n[s],
                    "cx": round(sorted(xs)[len(xs) // 2], 4), "cy": round(sorted(ys)[len(ys) // 2], 4)})

    # trends (journal x year x macro counts) — denominators come from coverage
    tr = Counter((r[5], r[4], r[6]) for r in rows)
    trends = {"journals": jcodes, "macros": [m["id"] for m in macro],
              "rows": [[j, y, m, n] for (j, y, m), n in sorted(tr.items())]}

    cov = [{k: (int(v) if v.isdigit() else (v == "True" if v in ("True", "False") else v)) for k, v in c.items()} for c in coverage]
    # reconciliation: per journal-year, mapped papers must equal coverage.mapped
    per = Counter((jcodes[r[5]], r[4]) for r in rows)
    with_abstract = Counter((jcodes[r[5]], r[4]) for r in rows if r[10])
    keys = {(c["journal"], c["year"]) for c in cov}
    if len(cov) != len(keys) or set(per) - keys:
        raise SystemExit("The coverage table is missing journal-years or contains duplicate rows.")
    if status == "release":
        p = cfg["project"]
        expected = {(j, y) for j in jcodes for y in range(p["window_start"], p["window_end"] + 1)}
        if keys != expected:
            raise SystemExit("A release requires the full configured window for all journals.")
    bad = [c for c in cov if (
        per[c["journal"], c["year"]] != c["mapped"] or c["mapped"] != c["eligible"]
        or with_abstract[c["journal"], c["year"]] != c["with_abstract"]
        or c["candidates"] != c["excluded"] + c["eligible"]
    )]
    if bad:
        raise SystemExit(f"Reconciliation failed for {len(bad)} journal-years, e.g. {bad[:3]}")

    k_used = len(sub)
    manifest = {
        "status": status,
        "data_version": cfg["project"]["data_version"],
        "generated_at": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d"),
        "window": [min(c["year"] for c in cov), max(c["year"] for c in cov)],
        "comparison_start": cfg["project"]["comparison_start"],
        "journals": [{"code": j["code"], "name": j["name"], "start": j["start"],
                      "predecessor_until": j.get("predecessor_until")} for j in cfg["journals"]],
        "counts": {"papers": len(rows), "with_abstract": sum(r[10] for r in rows),
                   "macro": len(macro), "sub": k_used,
                   "excluded": sum(c["excluded"] for c in cov)},
        "params": {"embed": {k: cfg["embed"][k] for k in ("base_model", "adapter", "max_length", "min_abstract_words")},
                   "cluster": {"k_sub": k_used, "n_macro": len(macro), "k_grid": cfg["cluster"]["k_grid"],
                               "seeds": cfg["cluster"]["seeds"],
                               "stability": [{"k": int(s["k"]), "mean_ari": float(s["mean_ari"])} for s in stab]},
                   "umap": cfg["umap"]},
        "thresholds": cfg["trends"],
        "sensitivity": {k: v for k, v in sens.items() if k.startswith("title_only_agreement")},
        "filter": {"keep_types": cfg["filter"]["keep_types"], "min_pages": cfg["filter"]["min_pages"],
                   "par_practitioner_sections": cfg["filter"]["par_practitioner_sections"]},
    }
    papers_obj = {"fields": PAPER_FIELDS, "rows": rows}
    payloads = (("papers", papers_obj), ("topics", {"macro": macro, "sub": sub}),
                ("coverage", cov), ("trends", trends), ("manifest", manifest))
    for name, obj in payloads:
        check_fields(obj, name)
    for name, obj in payloads:
        destination = SITE_DATA / f"{name}.json"
        temporary = destination.with_suffix(".json.tmp")
        write_json(temporary, obj, compact=(name != "manifest"))
        temporary.replace(destination)

    dl = SITE_DATA / "downloads"
    dl.mkdir(parents=True, exist_ok=True)
    with open(dl / "papers.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["openalex_id", "doi", "title", "authors", "year", "journal", "theme_id", "subtopic_id", "x", "y", "has_abstract", "cited_by"])
        for r in rows:
            w.writerow([r[0], r[1], r[2], r[3], r[4], jcodes[r[5]], r[6], r[7], r[8], r[9], r[10], r[11]])
    with open(dl / "coverage.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(cov[0].keys()))
        w.writeheader()
        w.writerows(cov)
    print(f"exported {len(rows)} papers, {len(macro)} themes, {len(sub)} subtopics -> {SITE_DATA}")


if __name__ == "__main__":
    import sys
    run(load_config(), status="release" if "--release" in sys.argv else "pilot")
