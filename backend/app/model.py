from __future__ import annotations

import threading
import time

import joblib
import numpy as np
from sklearn.ensemble import ExtraTreesClassifier
from sklearn.model_selection import StratifiedKFold

from . import storage
from .features import FEATURE_VERSION, augment, raw_sequence, seq_to_features, sequence_features

MIN_SAMPLES_PER_SIGN = 3


class SignModel:
    def __init__(self) -> None:
        self.clf = None
        self.meta: dict = {}
        self._lock = threading.Lock()
        self.load()

    # ------------------------------------------------------------------ io
    def load(self) -> None:
        if storage.MODEL_FILE.exists():
            try:
                bundle = joblib.load(storage.MODEL_FILE)
                if bundle["meta"].get("feature_version") != FEATURE_VERSION:
                    # modelo de uma versão antiga da app: precisa de ser retreinado
                    self.clf, self.meta = None, {"outdated": True}
                    return
                self.clf, self.meta = bundle["clf"], bundle["meta"]
            except Exception:
                self.clf, self.meta = None, {}

    @property
    def ready(self) -> bool:
        return self.clf is not None

    # --------------------------------------------------------------- treino
    def _dataset(self):
        seqs, labels = [], []
        for s in storage.iter_samples():
            seq = raw_sequence(s["frames"])
            if seq is not None:
                seqs.append(seq)
                labels.append(s["label"])
        return seqs, labels

    @staticmethod
    def _build_xy(seqs, labels, rng):
        X, y = [], []
        for seq, lab in zip(seqs, labels):
            X.append(seq_to_features(seq))
            y.append(lab)
            for f in augment(seq, rng):
                X.append(f)
                y.append(lab)
        return np.stack(X), np.array(y)

    @staticmethod
    def _new_clf():
        return ExtraTreesClassifier(
            n_estimators=300, max_features="sqrt", n_jobs=-1, random_state=42,
            class_weight="balanced",
        )

    def train(self) -> dict:
        t0 = time.time()
        seqs, labels = self._dataset()
        counts: dict[str, int] = {}
        for lab in labels:
            counts[lab] = counts.get(lab, 0) + 1
        keep = {lab for lab, c in counts.items() if c >= MIN_SAMPLES_PER_SIGN}
        skipped = sorted(lab for lab in counts if lab not in keep)
        pairs = [(s, l) for s, l in zip(seqs, labels) if l in keep]
        if len(keep) < 2:
            raise ValueError(
                f"São precisos pelo menos 2 sinais com {MIN_SAMPLES_PER_SIGN}+ amostras cada."
            )
        seqs, labels = [p[0] for p in pairs], [p[1] for p in pairs]
        rng = np.random.default_rng(0)

        # validação cruzada (sobre amostras originais, sem aumento no teste)
        folds = min(3, min(counts[l] for l in keep))
        correct = total = 0
        if folds >= 2:
            skf = StratifiedKFold(n_splits=folds, shuffle=True, random_state=0)
            y_all = np.array(labels)
            for tr, te in skf.split(np.zeros(len(labels)), y_all):
                Xtr, ytr = self._build_xy([seqs[i] for i in tr], [labels[i] for i in tr], rng)
                clf = self._new_clf().fit(Xtr, ytr)
                Xte = np.stack([seq_to_features(seqs[i]) for i in te])
                correct += int((clf.predict(Xte) == y_all[te]).sum())
                total += len(te)
        accuracy = correct / total if total else None

        X, y = self._build_xy(seqs, labels, rng)
        clf = self._new_clf().fit(X, y)
        meta = {
            "classes": sorted(keep),
            "n_samples": len(labels),
            "accuracy": accuracy,
            "skipped": skipped,
            "trained_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            "seconds": round(time.time() - t0, 1),
            "feature_version": FEATURE_VERSION,
        }
        with self._lock:
            self.clf, self.meta = clf, meta
            joblib.dump({"clf": clf, "meta": meta}, storage.MODEL_FILE)
        return meta

    # ------------------------------------------------------------- predição
    def predict(self, frames: list[dict], top_k: int = 3) -> dict:
        if not self.ready:
            return {"label": None, "confidence": 0.0, "top": [], "reason": "sem_modelo"}
        feats = sequence_features(frames)
        if feats is None:
            return {"label": None, "confidence": 0.0, "top": [], "reason": "sem_maos"}
        with self._lock:
            proba = self.clf.predict_proba(feats[None])[0]
            classes = self.clf.classes_
        order = np.argsort(proba)[::-1][:top_k]
        top = [{"label": str(classes[i]), "confidence": float(proba[i])} for i in order]
        return {"label": top[0]["label"], "confidence": top[0]["confidence"], "top": top}
