"""Shared paths, config loading and small IO helpers."""
from __future__ import annotations

import json
import os
import re
import tomllib
import unicodedata
from pathlib import Path

PIPELINE_DIR = Path(__file__).resolve().parents[1]
PROJECT_DIR = PIPELINE_DIR.parent
# The demo build points these at pipeline/demo/ so it never touches real data or labels.
DATA = Path(os.environ.get("PA_MAP_DATA_DIR", PIPELINE_DIR / "data"))
RAW = Path(os.environ.get("PA_MAP_RAW_DIR", DATA / "raw"))  # share a frozen snapshot with a pilot
INTERIM = DATA / "interim"    # cleaned tables (local only; contain abstracts)
PRIVATE = DATA / "private"    # embeddings, vectors (local only)
REVIEW = DATA / "review"      # human review sheets, logs, reports
LABELS = Path(os.environ.get("PA_MAP_LABELS_DIR", PIPELINE_DIR / "labels"))
SITE_DATA = PROJECT_DIR / "site" / "public" / "data"

for _d in (RAW, INTERIM, PRIVATE, REVIEW, LABELS):
    _d.mkdir(parents=True, exist_ok=True)


def load_config(path: Path | None = None) -> dict:
    path = path or PIPELINE_DIR / "config.toml"
    with open(path, "rb") as f:
        cfg = tomllib.load(f)
    cfg["project"]["mailto"] = os.environ.get("PA_MAP_CONTACT_EMAIL", cfg["project"].get("mailto", ""))
    cfg["journal_by_code"] = {j["code"]: j for j in cfg["journals"]}
    return cfg


def read_jsonl(path: Path):
    if not path.exists():
        return []
    with open(path, encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def append_jsonl(path: Path, rows):
    with open(path, "a", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")


def write_json(path: Path, obj, compact: bool = True):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        if compact:
            json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
        else:
            json.dump(obj, f, ensure_ascii=False, indent=2)


def norm_doi(doi: str | None) -> str | None:
    if not doi:
        return None
    d = doi.strip().lower()
    d = re.sub(r"^https?://(dx\.)?doi\.org/", "", d)
    return d or None


def norm_title(t: str | None) -> str:
    if not t:
        return ""
    t = unicodedata.normalize("NFKD", t)
    t = "".join(c for c in t if not unicodedata.combining(c))
    t = re.sub(r"<[^>]+>", " ", t)          # strip tags such as <i>
    t = re.sub(r"[^a-z0-9 ]+", " ", t.lower())
    return re.sub(r"\s+", " ", t).strip()


def clean_title(t: str | None) -> str:
    if not t:
        return ""
    t = re.sub(r"<[^>]+>", "", t)
    return re.sub(r"\s+", " ", t).strip()
