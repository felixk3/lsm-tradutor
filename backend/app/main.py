from __future__ import annotations

import io
import json
import zipfile

from typing import Literal

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from . import storage
from .model import MIN_SAMPLES_PER_SIGN, SignModel
from .ready_models import DIGITS, LETTERS, asl, catalog, predict_gestures
from .vocabulary import REST_LABEL

storage.init()
model = SignModel()

app = FastAPI(
    title="LSM Tradutor API", version="1.0.0",
    docs_url="/api/docs", redoc_url=None, openapi_url="/api/openapi.json",
)
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)


# ------------------------------------------------------------------ esquemas
class Hand(BaseModel):
    handedness: str
    landmarks: list[list[float]] = Field(..., min_length=21, max_length=21)
    gesture: str | None = None          # do reconhecedor de gestos do MediaPipe
    gesture_score: float | None = None


class Frame(BaseModel):
    t: float | None = None
    hands: list[Hand] = []


class SampleIn(BaseModel):
    label: str
    frames: list[Frame] = Field(..., min_length=3, max_length=300)


class PredictIn(BaseModel):
    frames: list[Frame] = Field(..., min_length=1, max_length=300)
    model: Literal["lsm", "gestos", "letras", "numeros"] = "lsm"
    aspect: float = Field(1.0, gt=0.2, lt=5)  # largura/altura do vídeo


class SignIn(BaseModel):
    label: str = Field(..., min_length=1, max_length=60)
    category: str = "Personalizado"


def _frames(frames: list[Frame]) -> list[dict]:
    return [f.model_dump() for f in frames]


# ------------------------------------------------------------------ rotas
@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/vocabulary")
def vocabulary():
    trained = set(model.meta.get("classes", [])) if model.ready else set()
    return [
        {**v, "samples": storage.count_samples(v["label"]), "trained": v["label"] in trained}
        for v in storage.load_vocabulary()
    ]


@app.post("/api/vocabulary")
def add_sign(sign: SignIn):
    vocab = storage.load_vocabulary()
    label = sign.label.strip()
    if any(v["label"].lower() == label.lower() for v in vocab):
        raise HTTPException(409, "Este sinal já existe.")
    vocab.append({"label": label, "category": sign.category.strip() or "Personalizado"})
    storage.save_vocabulary(vocab)
    return {"ok": True}


@app.delete("/api/vocabulary/{label:path}")
def remove_sign(label: str):
    if label == REST_LABEL:
        raise HTTPException(400, "A classe de repouso não pode ser removida.")
    storage.save_vocabulary([v for v in storage.load_vocabulary() if v["label"] != label])
    storage.clear_samples(label)
    return {"ok": True}


@app.post("/api/samples")
def add_sample(sample: SampleIn):
    if not any(v["label"] == sample.label for v in storage.load_vocabulary()):
        raise HTTPException(404, "Sinal não existe no vocabulário.")
    frames = _frames(sample.frames)
    if sum(1 for f in frames if f["hands"]) < 3:
        raise HTTPException(422, "Nenhuma mão detetada. Posicione as mãos dentro da câmara.")
    sid = storage.add_sample(sample.label, frames)
    return {"id": sid, "samples": storage.count_samples(sample.label)}


@app.delete("/api/samples/{label:path}/last")
def undo_sample(label: str):
    storage.delete_last_sample(label)
    return {"samples": storage.count_samples(label)}


@app.delete("/api/samples/{label:path}")
def clear_samples(label: str):
    storage.clear_samples(label)
    return {"samples": 0}


@app.get("/api/model")
def model_status():
    return {"ready": model.ready, "min_samples": MIN_SAMPLES_PER_SIGN, **model.meta}


@app.post("/api/train")
async def train():
    try:
        return await run_in_threadpool(model.train)
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.post("/api/model/reload")
def reload_model():
    """Recarrega data/model.joblib (ex.: depois de copiar um modelo treinado no Colab)."""
    model.load()
    return model_status()


@app.get("/api/models")
def models():
    """Modelos disponíveis para a tradução (prontos + o treinado com LSM)."""
    return catalog(
        model.ready, model.meta.get("classes", []) if model.ready else [], REST_LABEL,
        lsm_outdated=bool(model.meta.get("outdated")),
    )


def _predict(body: PredictIn) -> dict:
    frames = _frames(body.frames)
    if body.model == "gestos":
        return predict_gestures(frames)
    if body.model == "letras":
        return asl.predict(frames, LETTERS, body.aspect)
    if body.model == "numeros":
        return asl.predict(frames, DIGITS, body.aspect)
    return model.predict(frames)


@app.post("/api/predict")
async def predict(body: PredictIn):
    return await run_in_threadpool(_predict, body)


@app.get("/api/dataset/export")
def export_dataset():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("vocabulary.json", json.dumps(storage.load_vocabulary(), ensure_ascii=False))
        for f in storage.SAMPLES_DIR.glob("*/*.json"):
            z.write(f, f"samples/{f.parent.name}/{f.name}")
    buf.seek(0)
    return StreamingResponse(
        buf, media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="lsm-dataset.zip"'},
    )


@app.post("/api/dataset/import")
async def import_dataset(file: UploadFile = File(...)):
    """Junta um dataset exportado (ex.: gravado por outro sinalizante) ao atual."""
    data = await file.read()
    try:
        z = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile:
        raise HTTPException(400, "Ficheiro ZIP inválido.")
    vocab = storage.load_vocabulary()
    known = {v["label"] for v in vocab}
    added = 0
    with z:
        if "vocabulary.json" in z.namelist():
            for v in json.loads(z.read("vocabulary.json")):
                if v.get("label") and v["label"] not in known:
                    vocab.append({"label": v["label"], "category": v.get("category", "Importado")})
                    known.add(v["label"])
        for name in z.namelist():
            if not (name.startswith("samples/") and name.endswith(".json")):
                continue
            try:
                s = json.loads(z.read(name))
                label, frames = s["label"], s["frames"]
            except Exception:
                continue
            if label not in known:
                vocab.append({"label": label, "category": "Importado"})
                known.add(label)
            storage.add_sample(label, frames)
            added += 1
    storage.save_vocabulary(vocab)
    return {"imported": added}
