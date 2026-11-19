"""Stage 4: chapter evidence for the six reference-style chapters and the Explore tools.

Reads the local analysis data (abstracts, SPECTER2 vectors, topic assignments), the Crossref
reference lists (`python -m pa_map refs`), optional LLM labels (`python -m pa_map classify`)
and the published papers/topics, then writes aggregate-only JSON to site/public/data/chapters/.

Nothing here publishes abstracts or vectors: only yearly shares, counts, test statistics and
per-paper method / data-source codes aligned to papers.json.

  python -m pa_map evidence                 build every chapter file
  python -m pa_map evidence --sample KEY    print 20 random abstracts matched by a coding rule
"""
from __future__ import annotations

import json
import math
import random
import re
import tomllib
from collections import Counter, defaultdict

import numpy as np

from .common import INTERIM, PIPELINE_DIR, PRIVATE, RAW, SITE_DATA, read_jsonl, write_json

OUT = SITE_DATA / "chapters"
Y0, Y1 = 1980, 2025
YEARS = list(range(Y0, Y1 + 1))
BINS = [(1980, 1984), (1985, 1989), (1990, 1994), (1995, 1999), (2000, 2004), (2005, 2009),
        (2010, 2014), (2015, 2019), (2020, 2025)]


# ---------------------------------------------------------------------------- helpers
def rules():
    with open(PIPELINE_DIR / "coding_rules.toml", "rb") as f:
        r = tomllib.load(f)
    comp = lambda d: {k: (v["label"], re.compile(v["pattern"], re.I)) for k, v in d.items() if isinstance(v, dict)}
    return {"theories": comp(r["theories"]), "featured": r["theories"]["featured"],
            "methods": comp(r["methods"]), "sources": comp(r["sources"]), "source_order": r["sources"]["order"]}


def roll(values, w):
    """Centered rolling mean over available values; shorter window at the edges (as in the reference)."""
    out, h = [], w // 2
    for i in range(len(values)):
        win = [v for v in values[max(0, i - h): i + h + 1] if v is not None]
        out.append(round(sum(win) / len(win), 4) if win else None)
    return out


def r4(x):
    return None if x is None or (isinstance(x, float) and math.isnan(x)) else round(float(x), 4)


def linear_trend(values):
    xs = [i for i, v in enumerate(values) if v is not None]
    if len(xs) < 3:
        return None
    ys = [values[i] for i in xs]
    b, a = np.polyfit(xs, ys, 1)
    return [r4(a), r4(b)]          # value = a + b * index


def endpoint_change(values, k=5):
    v = [x for x in values if x is not None]
    if len(v) < 2 * k:
        return None
    a, b = np.mean(v[:k]), np.mean(v[-k:])
    return r4((b - a) / a) if a else None


def welch(a, b):
    from scipy import stats
    t, p = stats.ttest_ind(a, b, equal_var=False)
    sd = math.sqrt((np.var(a, ddof=1) + np.var(b, ddof=1)) / 2)
    return {"t": r4(t), "p": r4(p), "cohens_d": r4((np.mean(a) - np.mean(b)) / sd) if sd else None}


# ---------------------------------------------------------------------------- loading
def load():
    papers = {p["id"]: p for p in read_jsonl(INTERIM / "papers.jsonl")}
    assign = {a["id"]: a for a in read_jsonl(INTERIM / "assignments.jsonl")}
    pub = json.load(open(SITE_DATA / "papers.json"))
    f = {k: i for i, k in enumerate(pub["fields"])}
    order = [r[f["id"]] for r in pub["rows"]]
    topics = json.load(open(SITE_DATA / "topics.json"))
    missing = [i for i in order if i not in papers or i not in assign]
    if missing:
        raise SystemExit(f"{len(missing)} published papers missing from interim data — rerun the pipeline first")
    P = []
    for i in order:
        p, a = papers[i], assign[i]
        P.append({"id": i, "doi": (p.get("doi") or "").lower(), "year": p["year"], "journal": p["journal"],
                  "text": (p["title"] + ". " + (p.get("abstract") or "")) if p["has_abstract"] else "",
                  "title": p["title"], "has_abstract": p["has_abstract"], "macro": a["macro"], "sub": a["sub"],
                  "x": a["x"], "y": a["y"]})
    return P, topics


def load_vectors(P):
    ids = json.load(open(PRIVATE / "emb_full.json"))["ids"]
    X = np.load(PRIVATE / "emb_full.npy").astype(np.float32)
    pos = {k: i for i, k in enumerate(ids)}
    X = X[[pos[p["id"]] for p in P]]
    return X / np.linalg.norm(X, axis=1, keepdims=True).clip(min=1e-12)


def load_llm():
    path = INTERIM / "llm_labels.jsonl"
    return {r["id"]: r for r in read_jsonl(path)} if path.exists() else {}


# ---------------------------------------------------------------------------- chapter 2
def orientation(P, llm):
    rows = [(p["year"], llm[p["id"]]["orientation"]) for p in P if p["id"] in llm and llm[p["id"]].get("orientation") in ("theory", "phenomenon")]
    if len(rows) < 0.8 * sum(p["has_abstract"] for p in P):
        return {"status": "awaiting_llm", "classified": len(rows),
                "note": "Run `python -m pa_map classify` locally (needs OPENAI_API_KEY), then `python -m pa_map evidence`."}
    c = Counter(rows)
    tot = Counter(y for y, _ in rows)
    th = [100 * c[(y, "theory")] / tot[y] if tot[y] else None for y in YEARS]
    ph = [100 * c[(y, "phenomenon")] / tot[y] if tot[y] else None for y in YEARS]
    ths, phs = roll(th, 3), roll(ph, 3)
    pk = max((v, y) for y, v in zip(YEARS, ths) if v is not None)
    model = next(iter(llm.values())).get("model")
    return {"status": "ready", "model": model, "n": len(rows), "years": YEARS,
            "theory": ths, "phenomenon": phs, "totals": [tot[y] for y in YEARS],
            "peak": {"year": pk[1], "theory": r4(pk[0])},
            "recent_phenomenon": r4(np.mean([v for y, v in zip(YEARS, phs) if y >= 2020 and v is not None]))}


def theories(P, R):
    coded = [p for p in P if p["has_abstract"]]
    n = Counter(p["year"] for p in coded)
    series = []
    for key, (label, rx) in R["theories"].items():
        hits = Counter(p["year"] for p in coded if rx.search(p["text"]))
        raw = [100 * hits[y] / n[y] if n[y] else None for y in YEARS]
        series.append({"key": key, "label": label, "featured": key in R["featured"],
                       "rate": roll(raw, 5), "count": [hits[y] for y in YEARS], "total": sum(hits.values())})
    feat = [s for s in series if s["featured"]]
    comb = [sum((s["rate"][i] or 0) for s in feat) for i in range(len(YEARS))]
    pk = max(range(len(YEARS)), key=lambda i: comb[i])
    return {"years": YEARS, "n_abstract": [n[y] for y in YEARS], "series": series,
            "featured_peak": {"year": YEARS[pk], "rate": r4(comb[pk])},
            "featured_latest": r4(comb[-1]), "window": 5}


def shifts(P, topics, llm):
    early, late = (2008, 2013), (2020, 2025)
    in_ = lambda p, w: w[0] <= p["year"] <= w[1]
    ne = sum(in_(p, early) for p in P)
    nl = sum(in_(p, late) for p in P)
    ce = Counter(p["sub"] for p in P if in_(p, early))
    cl = Counter(p["sub"] for p in P if in_(p, late))
    orient = {}
    if llm:
        by = defaultdict(Counter)
        for p in P:
            o = llm.get(p["id"], {}).get("orientation")
            if o:
                by[p["sub"]][o] += 1
        for s, c in by.items():
            tot = c["theory"] + c["phenomenon"]
            ratio = c["theory"] / tot if tot else None
            orient[s] = (ratio, None if ratio is None else ("theory" if ratio >= 0.5 else "phenomenon" if ratio <= 0.35 else "mixed"))
    out = []
    for s in topics["sub"]:
        e, l = 100 * ce[s["id"]] / ne, 100 * cl[s["id"]] / nl
        ratio, o = orient.get(s["id"], (None, None))
        out.append({"id": s["id"], "label": s["label"], "macro": s["macro"], "early": r4(e), "late": r4(l),
                    "change": r4(l - e), "orientation": o, "theory_ratio": r4(ratio)})
    out.sort(key=lambda d: d["change"])
    return {"early": list(early), "late": list(late), "n_early": ne, "n_late": nl,
            "orientation_status": "ready" if orient else "awaiting_llm", "topics": out,
            "threshold_pp": 0.5}


# ---------------------------------------------------------------------------- chapter 3
def fragmentation(P, X, topics, rng):
    n_sub = len(topics["sub"])
    by_year = defaultdict(list)
    for i, p in enumerate(P):
        by_year[p["year"]].append(i)
    eff, hhi, coh, disp, ns, top1 = [], [], [], [], [], []
    for y in YEARS:
        idx = by_year.get(y, [])
        ns.append(len(idx))
        if len(idx) < 10:
            eff.append(None); hhi.append(None); coh.append(None); disp.append(None); top1.append(None)
            continue
        c = Counter(P[i]["sub"] for i in idx)
        sh = np.array([c[s] for s in range(n_sub)], float) / len(idx)
        h = float((sh ** 2).sum())
        hhi.append(r4(h)); eff.append(r4(1 / h)); top1.append(r4(sh.max()))
        V = X[idx]
        s = V.sum(axis=0)
        coh.append(r4((float(s @ s) - len(idx)) / (len(idx) * (len(idx) - 1))))   # mean pairwise cosine
        cen = V.mean(axis=0)
        disp.append(r4(float(np.linalg.norm(V - cen, axis=1).mean())))
    def top5(lo, hi):
        sel = [p for p in P if lo <= p["year"] <= hi]
        c = Counter(p["sub"] for p in sel)
        return r4(sum(v for _, v in c.most_common(5)) / len(sel))
    m = lambda vals, label, desc: {"label": label, "description": desc, "values": vals,
                                   "trend": linear_trend(vals), "change": endpoint_change(vals)}
    return {"years": YEARS, "n": ns, "n_subtopics": n_sub,
            "metrics": {
                "effective": m(eff, "Effective Paradigms", f"Equivalent number of equal-sized subtopics (1/HHI, {n_sub} subtopics)"),
                "coherence": m(coh, "Semantic Coherence", "Mean pairwise cosine similarity of SPECTER2 vectors"),
                "hhi": m(hhi, "Concentration (HHI)", "Sum of squared subtopic shares"),
                "dispersion": m(disp, "Semantic Dispersion", "Mean distance from each year's centroid (SPECTER2 space)")},
            "top5": {"early": {"years": [1980, 1989], "share": top5(1980, 1989)},
                     "late": {"years": [2020, 2025], "share": top5(2020, 2025)}},
            "largest_share": top1}


def citations(P, topics):
    path = RAW / "crossref_refs.jsonl"
    if not path.exists():
        return {"status": "awaiting_refs", "note": "Run `python -m pa_map refs` first."}
    refs = {r["doi"]: r for r in read_jsonl(path)}
    by_doi = {p["doi"]: p for p in P if p["doi"]}
    nm, ns = len(topics["macro"]), len(topics["sub"])
    M = np.zeros((nm, nm), int)
    S = np.zeros((ns, ns), int)
    with_refs = total_refs = matched = 0
    decade_pairs = Counter()
    for p in P:
        r = refs.get(p["doi"])
        if not r or not r.get("ok"):
            continue
        if r["n_ref"]:
            with_refs += 1
        total_refs += r["n_ref"]
        for d in set(r["ref_dois"]):
            q = by_doi.get(d)
            if q is None or q is p:
                continue
            matched += 1
            M[p["macro"], q["macro"]] += 1
            S[p["sub"], q["sub"]] += 1
    tot = int(M.sum())
    within = int(np.trace(M))
    per = []
    for m in range(nm):
        out_t, in_t = int(M[m].sum()), int(M[:, m].sum())
        per.append({"id": m, "out": out_t, "in": in_t, "within": int(M[m, m]),
                    "out_cross": out_t - int(M[m, m]), "in_cross": in_t - int(M[m, m]),
                    "self_share": r4(M[m, m] / out_t) if out_t else None})
    shares = [d["self_share"] for d in per if d["self_share"] is not None]
    return {"status": "ready", "source": "Crossref reference lists matched by DOI to the corpus",
            "papers": len(P), "papers_with_refs": with_refs, "refs_total": total_refs, "edges": tot,
            "cross_share": r4((tot - within) / tot) if tot else None, "within_share": r4(within / tot) if tot else None,
            "self_share_range": [min(shares), max(shares)] if shares else None,
            "macro": M.tolist(), "sub": S.tolist(), "per_macro": per}


# ---------------------------------------------------------------------------- chapter 4
def code_methods(P, R):
    mkeys = list(R["methods"])
    skeys = R["source_order"]
    codes = []
    for p in P:
        if not p["has_abstract"]:
            codes.append((0, -1, 0)); continue
        mask = 0
        for b, k in enumerate(mkeys):
            if R["methods"][k][1].search(p["text"]):
                mask |= 1 << b
        src = next((i for i, k in enumerate(skeys) if R["sources"][k][1].search(p["text"])), -1)
        codes.append((mask, src, 1))
    return mkeys, skeys, codes


def methods_series(P, R, mkeys, codes):
    n = Counter(p["year"] for p, c in zip(P, codes) if c[2])
    series = []
    for b, k in enumerate(mkeys):
        hits = Counter(p["year"] for p, c in zip(P, codes) if c[2] and c[0] >> b & 1)
        series.append({"key": k, "label": R["methods"][k][0],
                       "share": [r4(100 * hits[y] / n[y]) if n[y] else None for y in YEARS],
                       "total": sum(hits.values())})
    anyc = Counter(p["year"] for p, c in zip(P, codes) if c[2] and c[0])
    any_share = [r4(100 * anyc[y] / n[y]) if n[y] else None for y in YEARS]
    first5 = np.mean([v for v in any_share[:5] if v is not None])
    last5 = np.mean([v for v in any_share[-5:] if v is not None])
    return {"years": YEARS, "n": [n[y] for y in YEARS], "methods": series, "any_causal": any_share,
            "any_causal_smooth": roll(any_share, 5),
            "endpoints": {"first5": r4(first5), "last5": r4(last5), "first": any_share[0], "last": any_share[-1]},
            "n_causal": sum(1 for c in codes if c[2] and c[0]), "n_coded": sum(1 for c in codes if c[2])}


def heatmap(P, topics, codes):
    themes = []
    for t in topics["macro"]:
        cells = []
        for lo, hi in BINS:
            sel = [c for p, c in zip(P, codes) if c[2] and p["macro"] == t["id"] and lo <= p["year"] <= hi]
            k = sum(1 for c in sel if c[0])
            cells.append({"n": len(sel), "k": k, "share": r4(100 * k / len(sel)) if len(sel) >= 5 else None})
        themes.append({"id": t["id"], "label": t["label"], "cells": cells})
    return {"bins": [f"{lo}–{str(hi)[2:]}" for lo, hi in BINS], "min_n": 5, "themes": themes}


def sources_series(P, R, skeys, codes):
    n = Counter(p["year"] for p, c in zip(P, codes) if c[2])
    out = []
    for i, k in enumerate(skeys):
        hits = Counter(p["year"] for p, c in zip(P, codes) if c[2] and c[1] == i)
        out.append({"key": k, "label": R["sources"][k][0], "share": [r4(100 * hits[y] / n[y]) if n[y] else None for y in YEARS],
                    "total": sum(hits.values())})
    none = Counter(p["year"] for p, c in zip(P, codes) if c[2] and c[1] == -1)
    return {"years": YEARS, "n": [n[y] for y in YEARS], "sources": out,
            "unclassified": [r4(100 * none[y] / n[y]) if n[y] else None for y in YEARS]}


# ---------------------------------------------------------------------------- chapter 5
def periphery(P, codes):
    pts = [(p, c) for p, c in zip(P, codes) if c[2]]
    cx = float(np.mean([p["x"] for p, _ in pts])); cy = float(np.mean([p["y"] for p, _ in pts]))
    d = lambda p: math.hypot(p["x"] - cx, p["y"] - cy)
    dc = [d(p) for p, c in pts if c[0]]
    dn = [d(p) for p, c in pts if not c[0]]
    allr = sorted(dc + dn)
    rings = [r4(allr[int(q * (len(allr) - 1))]) for q in (0.25, 0.5, 0.75, 0.95)]
    return {"centroid": {"x": r4(cx), "y": r4(cy)}, "rings": rings,
            "n_causal": len(dc), "n_noncausal": len(dn),
            "mean_causal": r4(np.mean(dc)), "mean_noncausal": r4(np.mean(dn)),
            "test": welch(dc, dn), "units": "map units (0–1 normalised UMAP coordinates)"}


def importance(P, codes, llm):
    rows = [(llm[p["id"]], c) for p, c in zip(P, codes) if c[2] and p["id"] in llm
            and llm[p["id"]].get("importance") is not None]
    if len(rows) < 0.8 * sum(1 for c in codes if c[2]):
        return {"status": "awaiting_llm", "scored": len(rows),
                "note": "Run `python -m pa_map classify` locally, then `python -m pa_map evidence`."}
    out = {"status": "ready", "model": rows[0][0].get("model")}
    for key in ("importance", "scope"):
        a = [r[key] for r, c in rows if c[0]]
        b = [r[key] for r, c in rows if not c[0]]
        q = lambda v: [r4(np.percentile(v, x)) for x in (5, 25, 50, 75, 95)]
        out[key] = {"causal_mean": r4(np.mean(a)), "causal_sd": r4(np.std(a, ddof=1)), "causal_q": q(a), "n_causal": len(a),
                    "noncausal_mean": r4(np.mean(b)), "noncausal_sd": r4(np.std(b, ddof=1)), "noncausal_q": q(b), "n_noncausal": len(b),
                    **welch(a, b)}
    return out


# ---------------------------------------------------------------------------- chapter 6
def synthesis(orient, meth, frag):
    ready = orient.get("status") == "ready"
    coh = frag["metrics"]["coherence"]["values"]
    return {"years": YEARS,
            "theory": roll(orient["theory"], 5) if ready else None,
            "phenomenon": roll(orient["phenomenon"], 5) if ready else None,
            "causal": roll(meth["any_causal"], 5),
            "coherence": roll([None if v is None else 100 * v for v in coh], 5),
            "orientation_status": orient.get("status")}


# ---------------------------------------------------------------------------- run
def run(cfg=None, sample: str | None = None):
    R = rules()
    P, topics = load()
    if sample:
        rx = {**{k: v[1] for k, v in R["methods"].items()}, **{k: v[1] for k, v in R["sources"].items()},
              **{k: v[1] for k, v in R["theories"].items()}}[sample]
        hits = [p for p in P if p["has_abstract"] and rx.search(p["text"])]
        print(f"{sample}: {len(hits)} matches")
        for p in random.Random(0).sample(hits, min(20, len(hits))):
            m = rx.search(p["text"])
            print(f"- {p['year']} {p['journal']}: …{p['text'][max(0, m.start() - 80): m.end() + 80]}…")
        return
    X = load_vectors(P)
    llm = load_llm()
    rng = random.Random(0)
    OUT.mkdir(parents=True, exist_ok=True)

    orient = orientation(P, llm)
    th = theories(P, R)
    sh = shifts(P, topics, llm)
    frag = fragmentation(P, X, topics, rng)
    cit = citations(P, topics)
    mkeys, skeys, codes = code_methods(P, R)
    meth = methods_series(P, R, mkeys, codes)
    heat = heatmap(P, topics, codes)
    src = sources_series(P, R, skeys, codes)
    peri = periphery(P, codes)
    imp = importance(P, codes, llm)
    syn = synthesis(orient, meth, frag)
    paper_codes = {"methods": [{"key": k, "label": R["methods"][k][0]} for k in mkeys],
                   "sources": [{"key": k, "label": R["sources"][k][0]} for k in skeys],
                   "note": "Aligned with papers.json rows. m = bitmask of methods; s = data-source index (-1 none); c = 1 if coded (has abstract).",
                   "m": [c[0] for c in codes], "s": [c[1] for c in codes], "c": [c[2] for c in codes]}
    for name, obj in (("ch2_orientation", orient), ("ch2_theories", th), ("ch2_shifts", sh),
                      ("ch3_fragmentation", frag), ("ch3_citations", cit), ("ch4_methods", meth),
                      ("ch4_heatmap", heat), ("ch4_sources", src), ("ch5_periphery", peri),
                      ("ch5_importance", imp), ("ch6_synthesis", syn), ("paper_codes", paper_codes)):
        write_json(OUT / f"{name}.json", obj)
    print(json.dumps({
        "orientation": orient["status"], "theory_totals": {s["key"]: s["total"] for s in th["series"]},
        "featured_peak": th["featured_peak"], "effective_change": frag["metrics"]["effective"]["change"],
        "coherence_change": frag["metrics"]["coherence"]["change"], "top5": frag["top5"],
        "citations": {k: cit.get(k) for k in ("status", "edges", "cross_share", "self_share_range", "papers_with_refs")},
        "causal": meth["endpoints"], "n_causal": meth["n_causal"], "n_coded": meth["n_coded"],
        "method_totals": {s["key"]: s["total"] for s in meth["methods"]},
        "source_totals": {s["key"]: s["total"] for s in src["sources"]},
        "periphery": {k: peri[k] for k in ("n_causal", "n_noncausal", "mean_causal", "mean_noncausal", "test")},
    }, indent=1))
