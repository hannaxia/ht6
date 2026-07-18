"""
Example inference script for the occupancy model. Note ttm_avg_rate is a
required feature here — the digital twin's simulation engine should call
predict_adr() first, then feed that predicted rate into this one (mirrors
how price affects occupancy in the real domain model too).

Run: python predict_occupancy.py
Or import predict_occupancy(payload_dict) from another script.
"""

from __future__ import annotations

import json
import sys

import joblib
import pandas as pd
from feature_engineering import MODELS_DIR, amenities_flags_from_list
from train_occupancy import CATEGORICAL_FEATURES, NUMERIC_FEATURES

EXAMPLE_INPUT = {
    "guests": 100,
    "bedrooms": 50,
    "beds": None,
    "baths": None,
    "room_type": "entire_home",
    "listing_type": "Entire home",
    "amenities": ["pool", "gym"],
    "rating_overall": 4.5,
    "rating_location": None,
    "ttm_avg_rate": 250.0,
    "latitude": 43.6532,
    "longitude": -79.3832,
}


def predict_occupancy(payload: dict) -> dict:
    model = joblib.load(MODELS_DIR / "occupancy_model.pkl")
    preprocessor = joblib.load(MODELS_DIR / "occupancy_preprocessing.pkl")

    row = {
        "latitude": payload.get("latitude"),
        "longitude": payload.get("longitude"),
        "bedrooms": payload.get("bedrooms"),
        "beds": payload.get("beds"),
        "baths": payload.get("baths"),
        "guests": payload.get("guests"),
        "rating_overall": payload.get("rating_overall"),
        "rating_location": payload.get("rating_location"),
        "ttm_avg_rate": payload.get("ttm_avg_rate"),
        "room_type": payload.get("room_type"),
        "listing_type": payload.get("listing_type"),
        **amenities_flags_from_list(payload.get("amenities", [])),
    }
    X = pd.DataFrame([row])[NUMERIC_FEATURES + CATEGORICAL_FEATURES]

    X_t = preprocessor.transform(X)
    predicted_occupancy = float(model.predict(X_t)[0])
    return {"predicted_occupancy": round(predicted_occupancy, 4)}


if __name__ == "__main__":
    payload = json.loads(sys.stdin.read()) if not sys.stdin.isatty() else EXAMPLE_INPUT
    print(json.dumps(predict_occupancy(payload)))
