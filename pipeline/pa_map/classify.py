"""Stage 4a (optional, local): LLM labels used by Chapters 2, 5 and 6.

For every paper with a usable abstract, one request returns
  orientation  "theory" | "phenomenon"   (Ch2 Theory vs. Phenomenon, Ch2 sub-area colours, Ch6)
  importance   1–10                      (Ch5 Question Importance)
  scope        1–10                      (Ch5 Question Scope)

Mirrors the reference site's design (GPT-4o-mini for orientation, GPT-4o for the two ratings);
by default one gpt-4o-mini call does all three to keep cost low (~US$1–2 for ~9,000 abstracts).

  export OPENAI_API_KEY=sk-...                 # never commit this
  python -m pa_map classify --limit 50         # trial run, check data/interim/llm_labels.jsonl
  python -m pa_map classify                    # all remaining papers (resumes where it stopped)
  python -m pa_map classify --model gpt-4o     # stronger model, ~15x the cost
  python -m pa_map evidence                    # rebuild the chapter files

Output (local only): data/interim/llm_labels.jsonl. Only aggregates reach the website.
"""
from __future__ import annotations

import concurrent.futures as cf
import json
import os
import sys
import time

import requests

from .common import INTERIM, read_jsonl

PROMPT = """You are coding research articles published in public administration journals.

Read the title and abstract and return a JSON object with three fields.

"orientation": "theory" if the paper is primarily theory-driven: it is organised around developing, extending or testing a general theoretical framework or concept (for example principal–agent theory, institutional theory, public service motivation theory), and the empirical setting mainly serves the theory.
"phenomenon" if the paper is primarily phenomenon-driven: it starts from a real-world problem, policy, reform, practice or setting (for example a budget crisis, a digital service, a hiring rule) and uses theory mainly as a tool to explain it.
Choose the better fit; do not answer "both".

"importance": 1–10. How important is the research question for public administration scholarship and practice (1 = trivial, 10 = of first-order importance)?
"scope": 1–10. How broadly do the question and its answer apply beyond the specific case, country or organisation studied (1 = very narrow, 10 = very general)?

Return only JSON, for example {"orientation": "phenomenon", "importance": 6, "scope": 5}."""

URL = "https://api.openai.com/v1/chat/completions"


def _call(session, model, paper, tries=6):
    body = {"model": model, "temperature": 0, "response_format": {"type": "json_object"},
            "messages": [{"role": "system", "content": PROMPT},
                         {"role": "user", "content": f"Title: {paper['title']}\n\nAbstract: {paper['abstract']}"}]}
    for i in range(tries):
        r = session.post(URL, json=body, timeout=60)
        if r.status_code == 200:
            out = json.loads(r.json()["choices"][0]["message"]["content"])
            o = str(out.get("orientation", "")).lower()
            return {"id": paper["id"], "model": model,
                    "orientation": o if o in ("theory", "phenomenon") else None,
                    "importance": _num(out.get("importance")), "scope": _num(out.get("scope"))}
        if r.status_code in (429, 500, 502, 503):
            time.sleep(2 ** i)
            continue
        raise SystemExit(f"OpenAI error {r.status_code}: {r.text[:300]}")
    return {"id": paper["id"], "model": model, "orientation": None, "importance": None, "scope": None, "error": "retries"}


def _num(v):
    try:
        v = float(v)
        return v if 1 <= v <= 10 else None
    except (TypeError, ValueError):
        return None


def run(cfg=None, model="gpt-4o-mini", limit=None, workers=12):
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        sys.exit("Set OPENAI_API_KEY in your shell first (it is never written to disk by this script).")
    out_path = INTERIM / "llm_labels.jsonl"
    done = {r["id"] for r in read_jsonl(out_path) if r.get("orientation")}
    todo = [p for p in read_jsonl(INTERIM / "papers.jsonl") if p["has_abstract"] and p["id"] not in done]
    if limit:
        todo = todo[:limit]
    est = len(todo) * 350 / 1e6 * (0.15 if "mini" in model else 2.5) + len(todo) * 30 / 1e6 * (0.6 if "mini" in model else 10)
    print(f"{len(done)} already labelled, {len(todo)} to go with {model} (≈ US${est:.2f})")
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    with open(out_path, "a", encoding="utf-8") as f, cf.ThreadPoolExecutor(workers) as ex:
        for k, res in enumerate(ex.map(lambda p: _call(s, model, p), todo), 1):
            f.write(json.dumps(res) + "\n")
            if k % 200 == 0:
                f.flush()
                print(f"  {k}/{len(todo)}")
    print(f"done -> {out_path}")
