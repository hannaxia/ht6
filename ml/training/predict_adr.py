"""
Example inference script for the ADR model — this is what the backend
simulation engine will eventually call (as a subprocess, or ported to a
small FastAPI/Flask wrapper) instead of running it standalone.

Run: python predict_adr.py
Or import predict_adr(payload_dict) from another script.
"""

from __future__ import annotations

import json
import sys

import joblib
import pandas as pd
from feature_engineering import MODELS_DIR, amenities_flags_from_list
from train_adr import CATEGORICAL_FEATURES, NUMERIC_FEATURES

EXAMPLE_INPUT = {
    "state": None,
    "guests": 100,
    "bedrooms": 50,
    "beds": None,
    "baths": None,
    "room_type": "entire_home",
    "listing_type": "Entire home",
    "amenities": ["pool", "gym"],
    "rating_overall": 4.5,
    "rating_location": None,
    "rating_cleanliness": None,
    "superhost": False,
    "latitude": 43.6532,
    "longitude": -79.3832,
}


def predict_adr(payload: dict) -> dict:
    model = joblib.load(MODELS_DIR / "adr_model.pkl")
    preprocessor = joblib.load(MODELS_DIR / "adr_preprocessing.pkl")

    row = {
        "latitude": payload.get("latitude"),
        "longitude": payload.get("longitude"),
        "bedrooms": payload.get("bedrooms"),
        "beds": payload.get("beds"),
        "baths": payload.get("baths"),
        "guests": payload.get("guests"),
        "rating_overall": payload.get("rating_overall"),
        "rating_location": payload.get("rating_location"),
        "rating_cleanliness": payload.get("rating_cleanliness"),
        "superhost": int(bool(payload.get("superhost", False))),
        "state": payload.get("state"),
        "room_type": payload.get("room_type"),
        "listing_type": payload.get("listing_type"),
        **amenities_flags_from_list(payload.get("amenities", [])),
    }
    X = pd.DataFrame([row])[NUMERIC_FEATURES + CATEGORICAL_FEATURES]

    X_t = preprocessor.transform(X)
    predicted_adr = float(model.predict(X_t)[0])
    return {"predicted_adr": round(predicted_adr, 2)}


if __name__ == "__main__":
    payload = json.loads(sys.stdin.read()) if not sys.stdin.isatty() else EXAMPLE_INPUT
    print(json.dumps(predict_adr(payload)))
