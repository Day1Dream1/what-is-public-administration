"""Stage 4a (optional, local): LLM labels used by Chapters 2, 5 and 6.

For every paper with a usable abstract, one request returns
  orientation  "theory" | "phenomenon"   (Ch2 Theory vs. Phenomenon, Ch2 sub-area colours, Ch6)
  importance   1–10                      (Ch5 Question Importance)
  scope        1–10                      (Ch5 Question Scope)

Only research articles with a usable abstract are labelled (see eligibility.py).
Prompt v2 (2026-11-20) replaced v1 after a human review of 100 articles: v1 with gpt-4o-mini
reached kappa 0.31 on orientation and no rank agreement on the ratings (rho ~0.0); v2 with
gpt-4.1-mini reached kappa 0.44, importance rho 0.28, scope rho 0.42. One call does all three
(~US$2 for ~8,500 abstracts).

  export OPENAI_API_KEY=sk-...                 # never commit this
  python -m pa_map classify --limit 50         # trial run, check data/interim/llm_labels.jsonl
  python -m pa_map classify                    # all remaining papers (resumes where it stopped)
  python -m pa_map classify --model gpt-4o     # similar agreement in the review, ~5x the cost
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
from .eligibility import is_research_article

PROMPT_V1 = """You are coding research articles published in public administration journals.

Read the title and abstract and return a JSON object with three fields.

"orientation": "theory" if the paper is primarily theory-driven: it is organised around developing, extending or testing a general theoretical framework or concept (for example principal–agent theory, institutional theory, public service motivation theory), and the empirical setting mainly serves the theory.
"phenomenon" if the paper is primarily phenomenon-driven: it starts from a real-world problem, policy, reform, practice or setting (for example a budget crisis, a digital service, a hiring rule) and uses theory mainly as a tool to explain it.
Choose the better fit; do not answer "both".

"importance": 1–10. How important is the research question for public administration scholarship and practice (1 = trivial, 10 = of first-order importance)?
"scope": 1–10. How broadly do the question and its answer apply beyond the specific case, country or organisation studied (1 = very narrow, 10 = very general)?

Return only JSON, for example {"orientation": "phenomenon", "importance": 6, "scope": 5}."""

PROMPT = """You are an expert reviewer coding research articles published in public administration journals. Read the title and abstract and return a JSON object with three fields.

"orientation": what is the paper's PRIMARY contribution?
- "theory": the paper's main contribution is to a general theory, concept or framework. Signs: it proposes, develops, tests or refines a named theory or a general concept (e.g. principal-agent theory, representative bureaucracy, policy entrepreneurship, public value, hybridity), or makes a conceptual argument meant to apply across settings. Cases, policies or data serve mainly as a vehicle for that general claim.
- "phenomenon": the paper's main contribution is to understanding a specific real-world problem, policy, reform, programme, organisation or practice (e.g. a hospital reform, a PFI project, a state's budgeting system, AmeriCorps). Theory, if used, is a lens for explaining that specific thing, and the findings are mainly about it.
Ask: if the case were swapped for another, would the paper's main claim still stand? If yes, "theory"; if the main claim is about the case or policy itself, "phenomenon". Choose one.

"importance": 1–10, how important is the research question for public administration scholarship and practice? Use the whole scale. Anchors: 2 = narrow technical or descriptive question of little consequence; 4 = useful but routine contribution; 5 = typical article in a good journal; 7 = clearly important question many scholars or practitioners care about; 9 = first-order question for the field. Most articles should fall between 3 and 7.

"scope": 1–10, how broadly do the question and its answer apply beyond the specific case, country or organisation studied? Use the whole scale. Anchors: 2 = only this one case, place or period; 4 = similar organisations in the same country; 5 = one policy area across countries or one country across policy areas; 7 = most public organisations in comparable democracies; 9 = public organisations and governance in general. Most articles should fall between 3 and 7.

Return only JSON, for example {"orientation": "phenomenon", "importance": 5, "scope": 4}."""
PROMPT_VERSION = "v2"

URL = "https://api.openai.com/v1/chat/completions"


def _call(session, model, paper, tries=6):
    body = {"model": model, "temperature": 0, "response_format": {"type": "json_object"},
            "messages": [{"role": "system", "content": PROMPT},
                         {"role": "user", "content": f"Title: {paper['title']}\n\nAbstract: {paper['abstract']}"}]}
    for i in range(tries):
        try:
            r = session.post(URL, json=body, timeout=60)
        except requests.exceptions.RequestException:
            time.sleep(2 ** i)  # dropped connection or proxy reset: back off and retry
            continue
        if r.status_code == 200:
            out = json.loads(r.json()["choices"][0]["message"]["content"])
            o = str(out.get("orientation", "")).lower()
            return {"id": paper["id"], "model": model, "prompt": PROMPT_VERSION,
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


def run(cfg=None, model="gpt-4.1-mini", limit=None, workers=12):
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        sys.exit("Set OPENAI_API_KEY in your shell first (it is never written to disk by this script).")
    out_path = INTERIM / "llm_labels.jsonl"
    done = {r["id"] for r in read_jsonl(out_path) if r.get("orientation") and r.get("prompt") == PROMPT_VERSION and r.get("model") == model}
    todo = [p for p in read_jsonl(INTERIM / "papers.jsonl") if is_research_article(p) and p["id"] not in done]
    if limit:
        todo = todo[:limit]
    price = {"gpt-4o-mini": (0.15, 0.6), "gpt-4.1-mini": (0.4, 1.6), "gpt-4o": (2.5, 10), "gpt-4.1": (2.0, 8.0)}.get(model, (2.5, 10))
    est = len(todo) * 700 / 1e6 * price[0] + len(todo) * 30 / 1e6 * price[1]
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
