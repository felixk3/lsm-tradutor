"""Modelos prontos a usar (não precisam de treino).

* Gestos comuns — o reconhecedor de gestos do MediaPipe (Google) corre no navegador e envia
  o nome do gesto em cada frame; aqui só se agrega e traduz para português.
* Alfabeto A–Z e Números 0–9 — "ASL Landmark MLP" (Doruk Doğular, CC BY-NC 4.0), treinado com
  o dataset ASL-HG (Pranto et al., 2026). É o alfabeto manual AMERICANO, não o de Moçambique:
  serve para testar a app enquanto não há dados de LSM.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

import numpy as np

ASSETS = Path(os.environ.get("ASSETS_DIR", Path(__file__).resolve().parent.parent / "assets"))
ASL_ONNX = ASSETS / "mlp_asl.onnx"
ASL_CLASSES = ASSETS / "mlp_classes.json"

# gesto do MediaPipe -> (palavra em português, como fazer)
GESTURES_PT = {
    "Open_Palm": ("Olá", "Mão aberta, palma para a frente"),
    "Thumb_Up": ("Sim", "Polegar para cima"),
    "Thumb_Down": ("Não", "Polegar para baixo"),
    "Closed_Fist": ("Espera", "Punho fechado"),
    "Pointing_Up": ("Atenção", "Indicador para cima"),
    "Victory": ("Paz", "Indicador e médio em V"),
    "ILoveYou": ("Amo-te", "Polegar, indicador e mindinho esticados"),
}

LETTERS = [chr(c) for c in range(ord("A"), ord("Z") + 1)]
DIGITS = [str(d) for d in range(10)]
LAST_FRAMES = 8  # ~0,3 s — sinais estáticos


def _hand_frames(frames: list[dict]) -> list[dict]:
    return [f for f in frames if f.get("hands")][-LAST_FRAMES:]


def _top(scores: dict[str, float], k: int = 3) -> list[dict]:
    items = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)[:k]
    return [{"label": lab, "confidence": float(c)} for lab, c in items]


# ------------------------------------------------------------------ gestos
def predict_gestures(frames: list[dict]) -> dict:
    hf = _hand_frames(frames)
    if len(hf) < 3:
        return {"label": None, "confidence": 0.0, "top": [], "reason": "sem_maos"}
    totals = {pt: 0.0 for pt, _ in GESTURES_PT.values()}
    for f in hf:
        best = max(f["hands"], key=lambda h: h.get("gesture_score") or 0)
        name = best.get("gesture")
        if name in GESTURES_PT:
            totals[GESTURES_PT[name][0]] += float(best.get("gesture_score") or 0)
    scores = {k: v / len(hf) for k, v in totals.items()}
    top = _top(scores)
    if not top or top[0]["confidence"] <= 0:
        return {"label": None, "confidence": 0.0, "top": [], "reason": "sem_gesto"}
    return {"label": top[0]["label"], "confidence": top[0]["confidence"], "top": top}


# ------------------------------------------------------------- alfabeto ASL
class AslAlphabet:
    def __init__(self) -> None:
        self.session = None
        self.classes: list[str] = []
        self.error = ""
        try:
            import onnxruntime as ort

            raw = json.loads(ASL_CLASSES.read_text(encoding="utf-8"))
            if isinstance(raw, dict):
                self.classes = [str(raw[k]) for k in sorted(raw, key=lambda x: int(x))]
            else:
                self.classes = [str(c) for c in raw]
            self.session = ort.InferenceSession(str(ASL_ONNX), providers=["CPUExecutionProvider"])
            self.input_name = self.session.get_inputs()[0].name
        except Exception as e:  # ficheiros não descarregados, etc.
            self.session = None
            self.error = str(e)

    @property
    def available(self) -> bool:
        return self.session is not None

    def _proba(self, pts: np.ndarray) -> np.ndarray:
        rel = pts - pts[0]
        rel /= float(np.linalg.norm(rel[9])) + 1e-6
        logits = self.session.run(None, {self.input_name: rel.reshape(1, 63).astype(np.float32)})[0][0]
        e = np.exp(logits - logits.max())
        return e / e.sum()

    def predict(self, frames: list[dict], subset: list[str], aspect: float = 1.0) -> dict:
        if not self.available:
            return {"label": None, "confidence": 0.0, "top": [], "reason": "modelo_indisponivel"}
        hf = _hand_frames(frames)
        if len(hf) < 3:
            return {"label": None, "confidence": 0.0, "top": [], "reason": "sem_maos"}
        mask = np.array([c in subset for c in self.classes])
        sums = {False: np.zeros(len(self.classes)), True: np.zeros(len(self.classes))}
        for f in hf:
            # mão maior (mais perto da câmara)
            hand = max(f["hands"], key=lambda h: np.ptp(np.asarray(h["landmarks"])[:, 1]))
            pts = np.asarray(hand["landmarks"], dtype=np.float32).copy()
            pts[:, 0] *= aspect  # corrige a deformação de vídeos 16:9
            for mirrored in (False, True):  # funciona com a mão direita ou esquerda
                p = pts.copy()
                if mirrored:
                    p[:, 0] *= -1
                sums[mirrored] += self._proba(p)
        best = None
        for mirrored, s in sums.items():
            p = np.where(mask, s, 0)
            p = p / (p.sum() + 1e-9)
            if best is None or p.max() > best.max():
                best = p
        scores = {self.classes[i]: best[i] for i in range(len(self.classes)) if mask[i]}
        top = _top(scores)
        return {"label": top[0]["label"], "confidence": top[0]["confidence"], "top": top}


asl = AslAlphabet()


def catalog(lsm_ready: bool, lsm_classes: list[str], rest_label: str, lsm_outdated: bool = False) -> list[dict]:
    asl_note = "" if asl.available else "Modelo não descarregado (sem Internet no build?)."
    lsm_signs = [c for c in lsm_classes if c != rest_label]
    return [
        {
            "id": "gestos", "name": "Gestos comuns", "kind": "pronto", "available": True,
            "summary": "7 gestos universais, traduzidos para português",
            "origin": "Reconhecedor de gestos do MediaPipe (Google). Não é LSM — serve para ver a app a funcionar.",
            "signs": [{"label": pt, "hint": how} for pt, how in GESTURES_PT.values()],
        },
        {
            "id": "letras", "name": "Alfabeto A–Z", "kind": "pronto", "available": asl.available,
            "summary": "Soletrar nomes e palavras, letra a letra",
            "origin": "Alfabeto manual americano (ASL) — modelo “ASL Landmark MLP”, licença CC BY-NC 4.0. "
                      "Muitas letras coincidem com outros alfabetos manuais, mas não é o de Moçambique. " + asl_note,
            "signs": [{"label": c} for c in LETTERS],
        },
        {
            "id": "numeros", "name": "Números 0–9", "kind": "pronto", "available": asl.available,
            "summary": "Algarismos com uma mão",
            "origin": "Números do alfabeto manual americano (ASL) — mesmo modelo. " + asl_note,
            "signs": [{"label": d} for d in DIGITS],
        },
        {
            "id": "lsm", "name": "LSM — sinais treinados", "kind": "treinado", "available": lsm_ready,
            "summary": (f"{len(lsm_signs)} sina{'l' if len(lsm_signs) == 1 else 'is'} da LSM treinado{'' if len(lsm_signs) == 1 else 's'} nesta app") if lsm_ready
            else ("Modelo antigo: clique em Treinar modelo de novo" if lsm_outdated
                  else "Grave e treine na aba Treinar sinais"),
            "origin": "Língua de Sinais de Moçambique, gravada e treinada nesta app.",
            "signs": [{"label": c} for c in lsm_signs],
        },
    ]
