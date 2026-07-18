"""
FastAPI service wrapping the three trained models (ADR, occupancy, rating)
for the Node/TS backend to call. Every model is loaded once at import time
— predict endpoints are just map -> preprocess -> predict, no per-request
model loading.

Run: uvicorn main:app --port 8000   (from ml/service/, venv active)
Health check: GET /health
"""

from __future__ import annotations

import sys
from pathlib import Path

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

SERVICE_DIR = Path(__file__).resolve().parent
ML_DIR = SERVICE_DIR.parent
TRAINING_DIR = ML_DIR / "training"
SATISFACTION_DIR = TRAINING_DIR / "satisfaction"
MODELS_DIR = ML_DIR / "models"

sys.path.insert(0, str(TRAINING_DIR))
sys.path.insert(0, str(SATISFACTION_DIR))
sys.path.insert(0, str(SERVICE_DIR))

from feature_engineering import amenities_flags_from_list  # noqa: E402
from train_adr import CATEGORICAL_FEATURES as ADR_CATEGORICAL  # noqa: E402
from train_adr import NUMERIC_FEATURES as ADR_NUMERIC  # noqa: E402
from train_occupancy import CATEGORICAL_FEATURES as OCC_CATEGORICAL  # noqa: E402
from train_occupancy import NUMERIC_FEATURES as OCC_NUMERIC  # noqa: E402
from train_rating_model import CATEGORICAL_FEATURES as RATING_CATEGORICAL  # noqa: E402
from train_rating_model import NUMERIC_FEATURES as RATING_NUMERIC  # noqa: E402

import mapping  # noqa: E402

MODEL_FILES = {
    "adr_model": "adr_model.pkl",
    "adr_preprocessing": "adr_preprocessing.pkl",
    "occupancy_model": "occupancy_model.pkl",
    "occupancy_preprocessing": "occupancy_preprocessing.pkl",
    "rating_model": "rating_model.pkl",
    "rating_preprocessing": "rating_preprocessing.pkl",
}


def load_models() -> dict[str, object | None]:
    models: dict[str, object | None] = {}
    for name, filename in MODEL_FILES.items():
        path = MODELS_DIR / filename
        models[name] = joblib.load(path) if path.exists() else None
    return models


_models = load_models()
print(f"[innsight-ml] models loaded: {({k: v is not None for k, v in _models.items()})}")

app = FastAPI(title="Innsight ML service")


def _ready(*names: str) -> bool:
    return all(_models.get(n) is not None for n in names)


class HotelConfigPayload(BaseModel):
    hotelType: str = "midscale"
    rooms: int = 100
    stars: int = 3
    modernity: float = 0.5
    renovationDelta: float = 0.0
    amenities: list[str] = []
    state: str | None = None
    location: dict | None = None


class OccupancyRequest(HotelConfigPayload):
    predicted_adr: float


class AdrResponse(BaseModel):
    predicted_adr: float


class OccupancyResponse(BaseModel):
    predicted_occupancy: float


class RatingResponse(BaseModel):
    predicted_rating: float


@app.get("/health")
def health() -> dict:
    loaded = {k: v is not None for k, v in _models.items()}
    return {"status": "ok" if all(loaded.values()) else "degraded", "models": loaded}


def _run_adr(config: dict) -> float:
    row = mapping.adr_features(config)
    row.update(amenities_flags_from_list(row.pop("amenities", [])))
    X = pd.DataFrame([row])[ADR_NUMERIC + ADR_CATEGORICAL]
    X_t = _models["adr_preprocessing"].transform(X)
    raw = float(_models["adr_model"].predict(X_t)[0])
    # See mapping.SEGMENT_CALIBRATION_MULTIPLIER — no-op (x1.0) outside luxury/resort.
    return mapping.calibrate_adr(config.get("hotelType", "midscale"), raw)


@app.post("/predict/adr", response_model=AdrResponse)
def predict_adr(payload: HotelConfigPayload) -> AdrResponse:
    if not _ready("adr_model", "adr_preprocessing"):
        raise HTTPException(503, "ADR model not loaded — run train_adr.py")
    return AdrResponse(predicted_adr=round(_run_adr(payload.model_dump()), 2))


@app.post("/predict/occupancy", response_model=OccupancyResponse)
def predict_occupancy(payload: OccupancyRequest) -> OccupancyResponse:
    if not _ready("occupancy_model", "occupancy_preprocessing"):
        raise HTTPException(503, "Occupancy model not loaded — run train_occupancy.py")
    config = payload.model_dump()
    predicted_adr = config.pop("predicted_adr")
    row = mapping.occupancy_features(config, predicted_adr)
    row.update(amenities_flags_from_list(row.pop("amenities", [])))
    X = pd.DataFrame([row])[OCC_NUMERIC + OCC_CATEGORICAL]
    X_t = _models["occupancy_preprocessing"].transform(X)
    predicted = float(_models["occupancy_model"].predict(X_t)[0])
    return OccupancyResponse(predicted_occupancy=round(max(0.0, min(1.0, predicted)), 4))


@app.post("/predict/rating", response_model=RatingResponse)
def predict_rating(payload: HotelConfigPayload) -> RatingResponse:
    if not _ready("rating_model", "rating_preprocessing"):
        raise HTTPException(503, "Rating model not loaded — run train_rating_model.py")
    row = mapping.rating_features(payload.model_dump())
    cols = RATING_NUMERIC + RATING_CATEGORICAL if RATING_CATEGORICAL else RATING_NUMERIC
    X = pd.DataFrame([row])[cols]
    X_t = _models["rating_preprocessing"].transform(X)
    predicted = float(_models["rating_model"].predict(X_t)[0])
    return RatingResponse(predicted_rating=round(max(1.0, min(5.0, predicted)), 2))
