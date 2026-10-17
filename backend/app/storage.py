"""Armazenamento em ficheiros (sem base de dados).

/data
  vocabulary.json        lista de sinais
  samples/<id>/*.json    amostras gravadas (uma pasta por sinal)
  model.joblib           modelo treinado
"""
from __future__ import annotations

import hashlib
import json
import os
import shutil
import threading
import uuid
from pathlib import Path

from .vocabulary import DEFAULT_VOCABULARY

DATA_DIR = Path(os.environ.get("DATA_DIR", "/data"))
SAMPLES_DIR = DATA_DIR / "samples"
VOCAB_FILE = DATA_DIR / "vocabulary.json"
MODEL_FILE = DATA_DIR / "model.joblib"

_lock = threading.Lock()


def init() -> None:
    SAMPLES_DIR.mkdir(parents=True, exist_ok=True)
    if not VOCAB_FILE.exists():
        save_vocabulary(DEFAULT_VOCABULARY)


def label_id(label: str) -> str:
    return hashlib.sha1(label.encode("utf-8")).hexdigest()[:12]


def load_vocabulary() -> list[dict]:
    with _lock:
        return json.loads(VOCAB_FILE.read_text(encoding="utf-8"))


def save_vocabulary(vocab: list[dict]) -> None:
    with _lock:
        tmp = VOCAB_FILE.with_suffix(".tmp")
        tmp.write_text(json.dumps(vocab, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp.replace(VOCAB_FILE)


def sample_dir(label: str) -> Path:
    return SAMPLES_DIR / label_id(label)


def count_samples(label: str) -> int:
    d = sample_dir(label)
    return len(list(d.glob("*.json"))) if d.exists() else 0


def add_sample(label: str, frames: list[dict]) -> str:
    d = sample_dir(label)
    d.mkdir(parents=True, exist_ok=True)
    sid = uuid.uuid4().hex[:10]
    (d / f"{sid}.json").write_text(
        json.dumps({"label": label, "frames": frames}, ensure_ascii=False), encoding="utf-8"
    )
    return sid


def delete_last_sample(label: str) -> bool:
    d = sample_dir(label)
    files = sorted(d.glob("*.json"), key=lambda p: p.stat().st_mtime) if d.exists() else []
    if not files:
        return False
    files[-1].unlink()
    return True


def clear_samples(label: str) -> None:
    shutil.rmtree(sample_dir(label), ignore_errors=True)


def iter_samples():
    for f in SAMPLES_DIR.glob("*/*.json"):
        try:
            yield json.loads(f.read_text(encoding="utf-8"))
        except Exception:
            continue
