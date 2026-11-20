"""Agreement between human review and LLM labels (published as aggregates only).

  python -m pa_map validate PATH/TO/reviewed.xlsx

Reads a review workbook made by `review-sample` and filled in by a human coder, compares the
coder's orientation and ratings with the current LLM labels (data/interim/llm_labels.jsonl,
current prompt version) and with the labels shown in the workbook (the version that was
reviewed), and writes labels/llm_validation.json. Only counts and statistics are written.
"""
from __future__ import annotations

import json
from datetime import date

from scipy.stats import spearmanr

from .classify import PROMPT_VERSION
from .common import INTERIM, LABELS, read_jsonl

ORI = ("theory", "phenomenon")


def _stats(human, llm):
    pairs = [(h["orientation"], l.get("orientation")) for h, l in zip(human, llm)
             if h["orientation"] in ORI and l.get("orientation") in ORI]
    n = len(pairs)
    po = sum(a == b for a, b in pairs) / n
    pe = sum((sum(a == c for a, _ in pairs) / n) * (sum(b == c for _, b in pairs) / n) for c in ORI)
    w = [h["w"] for h, l in zip(human, llm) if h["orientation"] in ORI and l.get("orientation") in ORI]
    po_w = sum(wi for wi, (a, b) in zip(w, pairs) if a == b) / sum(w)
    out = {"n": n, "agreement": round(po, 3), "agreement_weighted": round(po_w, 3), "kappa": round((po - pe) / (1 - pe), 3),
           "human_theory": sum(a == "theory" for a, _ in pairs), "llm_theory": sum(b == "theory" for _, b in pairs)}
    for k in ("importance", "scope"):
        pr = [(h[k], l.get(k)) for h, l in zip(human, llm) if h[k] is not None and isinstance(l.get(k), (int, float))]
        rho = spearmanr([a for a, _ in pr], [b for _, b in pr])[0]
        out[k] = {"n": len(pr), "spearman": round(float(rho), 3),
                  "mean_abs_diff": round(sum(abs(a - b) for a, b in pr) / len(pr), 2),
                  "human_mean": round(sum(a for a, _ in pr) / len(pr), 2), "llm_mean": round(sum(b for _, b in pr) / len(pr), 2)}
    return out


def run(cfg, path):
    from openpyxl import load_workbook
    wb = load_workbook(path, data_only=True)
    rv, lab = wb["复核"], wb["LLM 标签"]
    human, reviewed = [], []
    for r in range(3, rv.max_row + 1):
        pid = rv.cell(r, 2).value
        if not pid or not str(pid).startswith("W"):
            continue
        num = lambda c: float(c) if isinstance(c, (int, float)) else None
        human.append({"id": pid, "orientation": (rv.cell(r, 8).value or "").strip().lower(),
                      "importance": num(rv.cell(r, 9).value), "scope": num(rv.cell(r, 10).value), "w": float(rv.cell(r, 13).value or 1)})
        reviewed.append({"orientation": lab.cell(r - 1, 3).value, "importance": num(lab.cell(r - 1, 4).value), "scope": num(lab.cell(r - 1, 5).value)})
    cur = {r["id"]: r for r in read_jsonl(INTERIM / "llm_labels.jsonl") if r.get("prompt") == PROMPT_VERSION}
    current = [cur.get(h["id"], {}) for h in human]
    model = next((c.get("model") for c in current if c), None)
    out = {"date": date.today().isoformat(), "coders": 1, "sample": len(human),
           "design": "Stratified random sample of eligible research articles (LLM orientation x four periods); weights restore the corpus mix.",
           "reviewed": {"prompt": "v1", "model": "gpt-4o-mini", **_stats(human, reviewed)},
           "current": {"prompt": PROMPT_VERSION, "model": model, **_stats(human, current),
                       "note": "Prompt v2 was written after reading the v1 disagreements, so these figures are optimistic (same 100 articles)."},
           "unsure": sum(h["orientation"] == "unsure" for h in human)}
    dst = LABELS / "llm_validation.json"
    dst.write_text(json.dumps(out, ensure_ascii=False, indent=1))
    print(json.dumps(out, ensure_ascii=False, indent=1))
    print(f"-> {dst}")
