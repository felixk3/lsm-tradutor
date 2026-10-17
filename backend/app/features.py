"""
Extração de características a partir dos pontos das mãos (MediaPipe Hand Landmarker).

Cada amostra é uma sequência de frames. Cada frame tem 0, 1 ou 2 mãos, e cada mão
tem 21 pontos (x, y, z) normalizados à imagem.

O MESMO código é usado no servidor e no notebook do Google Colab, para que um modelo
treinado num lado funcione no outro.
"""
from __future__ import annotations

import numpy as np

N_POINTS = 21
T = 16                      # nº de frames para onde cada sinal é reamostrado
HAND_DIM = N_POINTS * 3 + 3 # pontos relativos + posição do pulso (x, y) + presença
FRAME_DIM = HAND_DIM * 2


FEATURE_VERSION = 2  # mude quando a extração mudar (obriga a retreinar)


def _hand_vector(hand: dict | None, mirror: bool = False) -> np.ndarray:
    if not hand:
        return np.zeros(HAND_DIM, dtype=np.float32)
    pts = np.asarray(hand["landmarks"], dtype=np.float32).reshape(N_POINTS, 3)
    wrist = pts[0].copy()
    rel = pts - wrist
    scale = float(np.max(np.linalg.norm(rel[:, :2], axis=1))) + 1e-6
    rel /= scale  # invariante ao tamanho da mão / distância à câmara
    wx = wrist[0] - 0.5
    if mirror:  # espelha: canhotos e destros produzem o mesmo vetor
        rel[:, 0] *= -1
        wx = -wx
    extra = np.array([wx, wrist[1] - 0.5, 1.0], dtype=np.float32)
    return np.concatenate([rel.ravel(), extra])


def frame_vector(frame: dict) -> np.ndarray:
    hands = frame.get("hands") or []
    if len(hands) == 1:
        h = hands[0]
        # uma mão: vai sempre para o 1º lugar, espelhada se for a esquerda
        return np.concatenate([
            _hand_vector(h, mirror=h.get("handedness") == "Left"),
            np.zeros(HAND_DIM, dtype=np.float32),
        ])
    if len(hands) >= 2:
        # duas mãos: ordena pela posição na imagem (mais fiável que o rótulo esquerda/direita)
        a, b = sorted(hands[:2], key=lambda h: h["landmarks"][0][0])
        return np.concatenate([_hand_vector(a), _hand_vector(b, mirror=True)])
    return np.zeros(FRAME_DIM, dtype=np.float32)


def has_hands(frame: dict) -> bool:
    return bool(frame.get("hands"))


def trim(frames: list[dict]) -> list[dict]:
    """Remove frames sem mãos no início e no fim."""
    idx = [i for i, f in enumerate(frames) if has_hands(f)]
    if not idx:
        return []
    return frames[idx[0]: idx[-1] + 1]


def resample(seq: np.ndarray, t: int = T) -> np.ndarray:
    n = len(seq)
    if n == 1:
        return np.repeat(seq, t, axis=0)
    src = np.linspace(0, n - 1, t)
    lo = np.floor(src).astype(int)
    hi = np.minimum(lo + 1, n - 1)
    w = (src - lo)[:, None]
    return seq[lo] * (1 - w) + seq[hi] * w


def sequence_features(frames: list[dict]) -> np.ndarray | None:
    frames = trim(frames)
    if sum(has_hands(f) for f in frames) < 3:
        return None
    seq = np.stack([frame_vector(f) for f in frames])
    return seq_to_features(seq)


def seq_to_features(seq: np.ndarray) -> np.ndarray:
    seq = resample(seq)
    motion = np.abs(np.diff(seq, axis=0)).mean(axis=0)  # quanto cada ponto se move
    return np.concatenate([seq.ravel(), motion * 10]).astype(np.float32)


def augment(seq: np.ndarray, rng: np.random.Generator, n: int = 6) -> list[np.ndarray]:
    """Gera variações de uma sequência (ruído, escala, velocidade) para treinar melhor
    com poucas amostras."""
    out = []
    for _ in range(n):
        s = seq.copy()
        s += rng.normal(0, 0.02, s.shape).astype(np.float32)
        s *= rng.uniform(0.92, 1.08)
        # deformação temporal: corta/estica ligeiramente
        k = len(s)
        if k > 4:
            a = rng.integers(0, max(1, k // 8))
            b = k - rng.integers(0, max(1, k // 8))
            s = s[a:b]
        out.append(seq_to_features(s))
    return out


def raw_sequence(frames: list[dict]) -> np.ndarray | None:
    frames = trim(frames)
    if sum(has_hands(f) for f in frames) < 3:
        return None
    return np.stack([frame_vector(f) for f in frames])
