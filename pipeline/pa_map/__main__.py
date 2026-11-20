"""Command line entry point.

  python -m pa_map fetch    [--pilot]       OpenAlex candidates + Crossref dates
  python -m pa_map clean    [--pilot]       years, filters, dedup, coverage table
  python -m pa_map embed    [--title-only]  SPECTER2 vectors (run both variants)
  python -m pa_map cluster                  stability, k-means, macro themes, UMAP, review sheets
  python -m pa_map export   [--release]     public JSON for the website (+ field check)
  python -m pa_map all      [--pilot]       fetch -> clean -> embed (both) -> cluster -> export
  python -m pa_map refs                     Crossref reference lists (citation network)
  python -m pa_map classify [--limit N] [--model M]   LLM orientation + question ratings (needs OPENAI_API_KEY)
  python -m pa_map evidence [--sample KEY]  chapter evidence files (site/public/data/chapters/)
  python -m pa_map eligibility              research-article rules; writes data/review/excluded_records.csv
  python -m pa_map review-sample [--seed N] ~100 eligible articles for human review of LLM labels (xlsx)
  python -m pa_map validate PATH.xlsx       agreement between the filled-in review and the LLM labels
  python -m pa_map demo                     synthetic demo data (never publish as results)
"""
import os
import sys
from pathlib import Path


def main():
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help"):
        print(__doc__)
        return
    cmd, flags = sys.argv[1], set(sys.argv[2:])
    if cmd == "demo":
        demo_dir = Path(__file__).resolve().parents[1] / "demo"
        os.environ["PA_MAP_DATA_DIR"] = str(demo_dir / "data")
        os.environ["PA_MAP_LABELS_DIR"] = str(demo_dir / "labels")

    from .common import load_config
    cfg = load_config()
    pilot = "--pilot" in flags

    if cmd == "demo":
        from . import demo
        demo.run(cfg)
        return
    if cmd in ("fetch", "all"):
        from . import fetch
        fetch.fetch_openalex(cfg, pilot=pilot)
        fetch.fetch_crossref(cfg, pilot=pilot)
    if cmd in ("clean", "all"):
        from . import clean
        clean.run(cfg, pilot=pilot)
    if cmd in ("embed", "all"):
        from . import embed
        if cmd == "all":
            embed.run(cfg, title_only=False)
            embed.run(cfg, title_only=True)
        else:
            embed.run(cfg, title_only="--title-only" in flags)
    if cmd in ("cluster", "all"):
        from . import cluster
        cluster.run(cfg, projection="pca" if "--pca" in flags else "umap")
    if cmd in ("export", "all"):
        from . import export
        export.run(cfg, status="release" if "--release" in flags else "pilot")
    if cmd == "refs":
        from . import refs
        refs.run(cfg)
    if cmd == "classify":
        from . import classify
        args = sys.argv[2:]
        opt = lambda k, d=None: args[args.index(k) + 1] if k in args else d
        classify.run(cfg, model=opt("--model", "gpt-4.1-mini"), limit=int(opt("--limit", 0)) or None)
    if cmd == "eligibility":
        from . import eligibility
        eligibility.run(cfg)
    if cmd == "review-sample":
        from . import review_sample
        args = sys.argv[2:]
        review_sample.run(cfg, seed=int(args[args.index("--seed") + 1]) if "--seed" in args else 20261119)
    if cmd == "validate":
        from . import validate
        validate.run(cfg, sys.argv[2])
    if cmd in ("evidence", "all"):
        from . import evidence
        args = sys.argv[2:]
        evidence.run(cfg, sample=args[args.index("--sample") + 1] if "--sample" in args else None)


if __name__ == "__main__":
    main()
