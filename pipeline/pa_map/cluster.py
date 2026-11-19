"""Stage 2b: cluster, project, draft labels, review sheets, sensitivity.

Clustering runs on L2-normalised high-dimensional SPECTER2 vectors; UMAP is only for the 2-D picture.

Outputs: data/interim/assignments.jsonl      id, sub, macro, x, y, margin
         data/review/stability.csv           mean pairwise ARI per k (across seeds)
         data/review/topic_review.csv        central / random / boundary papers per subtopic
         data/review/sensitivity.json        title-only vs full; abstract-only subset trends
         labels/topics.csv                   label template (edit this by hand)
"""
from __future__ import annotations

import csv
import json
import random
from collections import Counter, defaultdict
from itertools import combinations

import numpy as np
from sklearn.cluster import AgglomerativeClustering, KMeans
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.metrics import adjusted_rand_score

from .common import INTERIM, LABELS, PRIVATE, REVIEW, load_config, read_jsonl, write_json
from .embed import _file_digest, read_embedding

STOP_EXTRA = {"public", "administration", "study", "analysis", "evidence", "research", "paper", "article",
              "case", "new", "role", "effects", "effect", "using", "based", "approach", "does",
              "abstract", "discusses", "contains", "exists", "test", "findings",
              "explaining", "rethinking", "measuring"}


def l2(X):
    return X / np.linalg.norm(X, axis=1, keepdims=True).clip(min=1e-12)


def stability(X, k_grid, seeds):
    rows = []
    for k in k_grid:
        labs = [KMeans(n_clusters=k, random_state=s, n_init=3).fit_predict(X) for s in seeds]
        aris = [adjusted_rand_score(a, b) for a, b in combinations(labs, 2)]
        rows.append({"k": k, "mean_ari": round(float(np.mean(aris)), 4), "min_ari": round(float(np.min(aris)), 4)})
        print(f"  k={k}: mean ARI={rows[-1]['mean_ari']}")
    return rows


def ctfidf_keywords(docs_by_cluster: dict, top=6):
    keys = sorted(docs_by_cluster)
    corpus = [" ".join(docs_by_cluster[k]) for k in keys]
    from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS
    cv = CountVectorizer(stop_words=list(ENGLISH_STOP_WORDS | STOP_EXTRA), ngram_range=(1, 2), min_df=2,
                         token_pattern=r"(?u)\b[a-zA-Z][a-zA-Z\-]{2,}\b")
    M = cv.fit_transform(corpus).toarray().astype(float)
    tf = M / M.sum(axis=1, keepdims=True).clip(min=1)
    idf = np.log(1 + M.shape[0] / (M > 0).sum(axis=0).clip(min=1))
    S = tf * idf
    vocab = np.array(cv.get_feature_names_out())
    out = {}
    for i, k in enumerate(keys):
        chosen = []
        for term in vocab[np.argsort(-S[i])[:60]]:
            # skip a term that overlaps one already chosen ("performance" vs "performance management")
            if any(term in c or c in term for c in chosen):
                continue
            chosen.append(term)
            if len(chosen) == top:
                break
        out[k] = chosen
    return out


def project(X, cfg, method="umap"):
    if method == "umap":
        import umap
        u = cfg["umap"]
        return umap.UMAP(n_neighbors=u["n_neighbors"], min_dist=u["min_dist"], metric=u["metric"],
                         random_state=u["random_state"], n_jobs=1).fit_transform(X)
    # Fallbacks for the demo / smoke tests only — NOT for the published map.
    if method == "tsne":
        from sklearn.manifold import TSNE
        return TSNE(n_components=2, metric="cosine", init="pca", random_state=0, perplexity=50).fit_transform(X)
    from sklearn.decomposition import PCA
    return PCA(n_components=2, random_state=0).fit_transform(X)


def run(cfg, projection="umap"):
    source = INTERIM / "papers.jsonl"
    source_digest = _file_digest(source)
    papers = read_jsonl(source)
    ids = [p["id"] for p in papers]
    legacy_demo = projection == "tsne" and not (PRIVATE / "emb_full.json").exists()
    if legacy_demo:
        if json.loads((PRIVATE / "ids.json").read_text(encoding="utf-8")) != ids:
            raise ValueError("Demo embedding IDs do not match the synthetic corpus.")
        full = np.load(PRIVATE / "emb_full.npy")
        title = np.load(PRIVATE / "emb_title.npy")
    else:
        full = read_embedding(PRIVATE / "emb_full.npy", source, ids, cfg)
        title = read_embedding(PRIVATE / "emb_title.npy", source, ids, cfg)
    X = l2(full)
    c = cfg["cluster"]

    print("Stability check …")
    stab = stability(X, c["k_grid"], c["seeds"])
    _write_csv(REVIEW / "stability.csv", stab)
    k = c["k_sub"] or max(stab, key=lambda r: (r["mean_ari"], -r["k"]))["k"]
    print(f"Using k_sub={k}")
    km = KMeans(n_clusters=k, random_state=c["seeds"][0], n_init=10).fit(X)
    sub = km.labels_
    C = l2(km.cluster_centers_)
    distances = km.transform(X)
    closest = np.partition(distances, kth=1, axis=1)[:, :2]
    margin = closest[:, 1] - closest[:, 0]

    # macro themes from subtopic centroids; renumber macros by size (largest = 0)
    agg = AgglomerativeClustering(n_clusters=c["n_macro"], linkage="ward").fit(C)
    sizes = Counter(agg.labels_[s] for s in sub)
    order = {m: i for i, (m, _) in enumerate(sizes.most_common())}
    sub2macro = {s: order[agg.labels_[s]] for s in range(k)}
    macro = np.array([sub2macro[s] for s in sub])

    print("Projecting …")
    XY = project(X, cfg, projection)
    XY = (XY - XY.min(axis=0)) / (XY.max(axis=0) - XY.min(axis=0))   # 0..1 for the site

    assignments = INTERIM / "assignments.jsonl"
    draft_assignments = assignments.with_suffix(".part")
    with draft_assignments.open("w", encoding="utf-8") as f:
        for i, p in enumerate(papers):
            f.write(json.dumps({"id": p["id"], "sub": int(sub[i]), "macro": int(macro[i]),
                                "x": round(float(XY[i, 0]), 4), "y": round(float(XY[i, 1]), 4),
                                "margin": round(float(margin[i]), 4)}) + "\n")

    # draft labels + review sheet
    docs_sub, docs_mac = defaultdict(list), defaultdict(list)
    for i, p in enumerate(papers):
        text = p["title"] + " " + (p.get("abstract") or "")
        docs_sub[int(sub[i])].append(text)
        docs_mac[int(macro[i])].append(text)
    kw_sub, kw_mac = ctfidf_keywords(docs_sub), ctfidf_keywords(docs_mac)
    rng = random.Random(0)
    review = []
    for s in range(k):
        idx = np.where(sub == s)[0]
        central = idx[np.argsort(distances[idx, s])[:5]]
        boundary = idx[np.argsort(margin[idx])[:5]]
        rand = rng.sample(list(idx), min(5, len(idx)))
        for kind, sel in (("central", central), ("random", rand), ("boundary", boundary)):
            for i in sel:
                p = papers[i]
                review.append({"sub": s, "macro": sub2macro[s], "n": len(idx), "draft_keywords": "; ".join(kw_sub[s]),
                               "kind": kind, "year": p["year"], "journal": p["journal"], "id": p["id"],
                               "doi": p["doi"], "title": p["title"]})
    _write_csv(REVIEW / "topic_review.csv", review)

    template = []
    for m in range(c["n_macro"]):
        template.append({"level": "macro", "id": m, "macro": m, "n": int((macro == m).sum()),
                         "draft_label": " / ".join(kw_mac[m][:3]), "label": "", "description": "", "reviewed": "no"})
    for s in range(k):
        template.append({"level": "sub", "id": s, "macro": sub2macro[s], "n": int((sub == s).sum()),
                         "draft_label": " / ".join(kw_sub[s][:3]), "label": "", "description": "", "reviewed": "no"})
    target = LABELS / "topics.csv"
    if target.exists():
        target = LABELS / "topics.draft.csv"
        print("labels/topics.csv already exists — wrote labels/topics.draft.csv instead. "
              "Cluster ids change when clustering is rerun: re-check your labels.")
    _write_csv(target, template)

    sensitivity(papers, km, title, sub, macro, sub2macro)
    if _file_digest(source) != source_digest:
        raise ValueError("The cleaned corpus changed during clustering. Rerun this stage.")
    draft_assignments.replace(assignments)
    write_json(INTERIM / "cluster_provenance.json", {
        "papers_sha256": source_digest,
        "assignments_sha256": _file_digest(assignments),
        "sensitivity_sha256": _file_digest(REVIEW / "sensitivity.json"),
        "projection": projection,
    })
    print("cluster stage done.")


def sensitivity(papers, km, title, sub, macro, sub2macro):
    t_sub = km.predict(l2(title))
    t_mac = np.array([sub2macro[s] for s in t_sub])
    has_abs = np.array([p["has_abstract"] for p in papers])
    out = {
        "title_only_agreement_sub": round(float((t_sub == sub).mean()), 4),
        "title_only_agreement_macro": round(float((t_mac == macro).mean()), 4),
        "title_only_macro_share_by_decade": _shares(papers, t_mac),
        "full_macro_share_by_decade": _shares(papers, macro),
        "abstract_subset_macro_share_by_decade": _shares(
            [p for p, has in zip(papers, has_abs, strict=True) if has], macro[has_abs]
        ),
    }
    if has_abs.any():
        out["title_only_agreement_sub_abstract_rows"] = round(float((t_sub[has_abs] == sub[has_abs]).mean()), 4)
        out["title_only_agreement_macro_abstract_rows"] = round(float((t_mac[has_abs] == macro[has_abs]).mean()), 4)
    with open(REVIEW / "sensitivity.json", "w") as f:
        json.dump(out, f, indent=2)
    _write_csv(REVIEW / "sensitivity_cohorts.csv", _sensitivity_cohorts(papers, macro, t_mac, sub2macro))


def _sensitivity_cohorts(papers, macro, title_macro, sub2macro):
    counts, full, title, with_abstract = defaultdict(Counter), Counter(), Counter(), Counter()
    for p, standard, title_only in zip(papers, macro, title_macro, strict=True):
        for key in ((p["journal"], p["year"]), ("ALL", p["year"])):
            counts[key]["papers"] += 1
            full[key, standard] += 1
            title[key, title_only] += 1
            if p["has_abstract"]:
                counts[key]["has_abstract"] += 1
                with_abstract[key, standard] += 1
    return [
        {"journal": journal, "year": year, "macro": theme, "n": counts[journal, year]["papers"],
         "with_abstract": counts[journal, year]["has_abstract"], "full": full[(journal, year), theme],
         "title_only": title[(journal, year), theme], "abstract_subset": with_abstract[(journal, year), theme]}
        for journal, year in sorted(counts) for theme in sorted(set(sub2macro.values()))
    ]


def _shares(papers, labels):
    cnt, tot = Counter(), Counter()
    for p, m in zip(papers, labels):
        d = (p["year"] // 10) * 10
        cnt[(d, int(m))] += 1
        tot[d] += 1
    return {f"{d}s": {str(m): round(cnt[(d, m)] / tot[d], 4) for (dd, m) in sorted(cnt) if dd == d} for d in sorted(tot)}


def _write_csv(path, rows):
    if not rows:
        return
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)


if __name__ == "__main__":
    import sys
    run(load_config(), projection="pca" if "--pca" in sys.argv else "umap")
