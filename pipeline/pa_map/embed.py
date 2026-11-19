"""Stage 2a: SPECTER2 embeddings (base + proximity adapter), computed locally.

  main input      : title [SEP] abstract   (title only when no usable abstract)
  sensitivity run : title only, for every paper (--title-only)

Outputs (LOCAL ONLY): data/private/emb_full.npy | emb_title.npy, with paired input manifests.
"""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path

import numpy as np

from .common import INTERIM, PRIVATE, load_config, read_jsonl


MODEL_REVISIONS = {
    "allenai/specter2_base": "3447645e1def9117997203454fa4495937bfbd83",
    "allenai/specter2": "2081559630a80fc5851d8f798a05ba81e9468089",
}
WEIGHTS_SHA256 = {
    "pytorch_model.bin": "801eda968fad1752fe846a8e572bfdc25202be85544680dda4c99f4589646ebc",
    "pytorch_adapter.bin": "5b6105714f78b294daa7e2d181134df12f0acb7a4ec7c1e3c13e512c908db94a",
}
EMBEDDING_DIMENSIONS = 768


def _model_path(name, files):
    from huggingface_hub import snapshot_download

    local_models = os.environ.get("PA_MAP_MODEL_DIR")
    if local_models:
        path = Path(local_models) / name.rsplit("/", 1)[-1]
        missing = [file for file in files if not (path / file).is_file()]
        if missing:
            raise ValueError(f"Model snapshot {path} is missing {', '.join(missing)}")
        for file in files:
            if file in WEIGHTS_SHA256 and _file_digest(path / file) != WEIGHTS_SHA256[file]:
                raise ValueError(f"{path / file} does not match the pinned model weights.")
        return str(path)
    return snapshot_download(name, revision=MODEL_REVISIONS[name], allow_patterns=files)


def load_model(cfg):
    import torch
    from adapters import AutoAdapterModel
    from transformers import AutoTokenizer

    e = cfg["embed"]
    base = _model_path(e["base_model"], [
        "config.json", "pytorch_model.bin", "special_tokens_map.json",
        "tokenizer.json", "tokenizer_config.json", "vocab.txt",
    ])
    adapter = _model_path(e["adapter"], ["adapter_config.json", "pytorch_adapter.bin"])
    tok = AutoTokenizer.from_pretrained(base)
    model = AutoAdapterModel.from_pretrained(base)
    model.load_adapter(adapter, load_as="proximity", set_active=True)
    if model.active_adapters is None:
        raise RuntimeError("SPECTER2 proximity adapter failed to activate.")
    device = "mps" if torch.backends.mps.is_available() else ("cuda" if torch.cuda.is_available() else "cpu")
    model.to(device).eval()
    return tok, model, device


def embed_texts(texts, cfg):
    import torch

    tok, model, device = load_model(cfg)
    e = cfg["embed"]
    order = sorted(range(len(texts)), key=lambda i: len(texts[i]))
    out = np.empty((len(texts), EMBEDDING_DIMENSIONS), dtype=np.float32)
    print(f"  inference on {device}")
    with torch.inference_mode():
        for offset in range(0, len(order), e["batch_size"]):
            ids = order[offset:offset + e["batch_size"]]
            batch = [texts[i] for i in ids]
            enc = tok(batch, padding=True, truncation=True, return_tensors="pt",
                      return_token_type_ids=False, max_length=e["max_length"]).to(device)
            vec = model(**enc).last_hidden_state[:, 0, :]   # [CLS], as in the SPECTER2 model card
            out[ids] = vec.float().cpu().numpy()
            done = offset + len(ids)
            if (offset // e["batch_size"]) % 50 == 0 or done == len(order):
                print(f"  {done}/{len(order)}")
    if not np.isfinite(out).all():
        raise ValueError("SPECTER2 produced non-finite embeddings")
    return out


def _model_info(cfg):
    e = cfg["embed"]
    return {
        "base": [e["base_model"], MODEL_REVISIONS[e["base_model"]]],
        "adapter": [e["adapter"], MODEL_REVISIONS[e["adapter"]]],
        "max_length": e["max_length"],
    }


def _input_digest(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _file_digest(path):
    with path.open("rb") as f:
        return hashlib.file_digest(f, "sha256").hexdigest()


def _cache(path, model):
    metadata_path = path.with_suffix(".json")
    if not path.is_file() or not metadata_path.is_file():
        return {}
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    if metadata["model"] != model or metadata["output_sha256"] != _file_digest(path):
        return {}
    matrix = np.load(path)
    keys = zip(metadata["ids"], metadata["input_sha256"], strict=True)
    return dict(zip(keys, matrix, strict=True))


def _write_embedding(path, vectors, metadata):
    temporary_matrix = path.with_suffix(".part.npy")
    np.save(temporary_matrix, vectors)
    metadata["output_sha256"] = _file_digest(temporary_matrix)
    temporary_metadata = path.with_suffix(".part.json")
    temporary_metadata.write_text(json.dumps(metadata), encoding="utf-8")
    temporary_matrix.replace(path)
    temporary_metadata.replace(path.with_suffix(".json"))


def read_embedding(path, source, ids, cfg):
    metadata_path = path.with_suffix(".json")
    if not path.is_file() or not metadata_path.is_file():
        raise ValueError(f"{path.name} or its input manifest is missing. Run the matching embed stage.")
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    if (metadata["ids"] != ids or metadata["source_sha256"] != _file_digest(source)
            or metadata["model"] != _model_info(cfg)
            or metadata["output_sha256"] != _file_digest(path)):
        raise ValueError(f"{path.name} does not match the current corpus or model. Rerun embedding.")
    matrix = np.load(path)
    if matrix.shape != (len(ids), EMBEDDING_DIMENSIONS) or not np.isfinite(matrix).all():
        raise ValueError(f"{path.name} contains invalid embeddings.")
    return matrix


def run(cfg, title_only: bool = False):
    source = INTERIM / "papers.jsonl"
    if not source.is_file():
        raise ValueError("The cleaned corpus is missing. Run the clean stage first.")
    source_digest = _file_digest(source)
    papers = read_jsonl(source)
    if not papers:
        raise ValueError("No eligible papers to embed. Run the clean stage first.")
    texts = []
    for p in papers:
        if title_only or not p["has_abstract"]:
            texts.append(p["title"])
        else:
            texts.append(p["title"] + "[SEP]" + p["abstract"])
    print(f"Embedding {len(texts)} papers ({'title-only' if title_only else 'title+abstract where available'})")
    name = "emb_title.npy" if title_only else "emb_full.npy"
    path = PRIVATE / name
    model = _model_info(cfg)
    cache = _cache(path, model)
    if title_only:
        cache.update(_cache(PRIVATE / "emb_full.npy", model))
    reusable = os.environ.get("PA_MAP_REUSE_EMBEDDINGS")
    if reusable:
        cache.update(_cache(Path(reusable) / name, model))

    ids = [p["id"] for p in papers]
    digests = [_input_digest(s) for s in texts]
    vectors = np.empty((len(texts), EMBEDDING_DIMENSIONS), dtype=np.float32)
    pending = []
    for i, key in enumerate(zip(ids, digests, strict=True)):
        cached = cache.get(key)
        if cached is None:
            pending.append(i)
        else:
            vectors[i] = cached
    print(f"  reused {len(texts) - len(pending)}/{len(texts)} embeddings with matching input and model")
    if pending:
        vectors[pending] = embed_texts([texts[i] for i in pending], cfg)
    if _file_digest(source) != source_digest:
        raise ValueError("The cleaned corpus changed during embedding. Rerun this stage.")
    _write_embedding(path, vectors, {
        "ids": ids, "model": model, "input_sha256": digests, "source_sha256": source_digest,
    })
    print(f"saved {name} {vectors.shape}")


if __name__ == "__main__":
    import sys
    run(load_config(), title_only="--title-only" in sys.argv)
