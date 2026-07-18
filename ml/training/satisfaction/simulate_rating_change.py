"""
Counterfactual rating simulation — what the digital twin sandbox calls:
given a hotel's current feature vector and a set of changes ("add a pool"),
runs both through the trained model and returns old/new rating + the delta.

Run: python simulate_rating_change.py
Or import simulate_rating_change(current, changes) from another script.
"""

from __future__ import annotations

import json
import sys

import joblib
import pandas as pd
from extract_review_features import CATEGORIES
from preprocess_reviews import MODELS_DIR
from train_rating_model import CATEGORICAL_FEATURES, NUMERIC_FEATURES

RATING_MIN, RATING_MAX = 1.0, 5.0

# Unspecified fields default to "not mentioned" (0 / neutral) — matching
# training data, where a review that never mentions an aspect gets the same
# 0/0.0 default (see extract_review_features.extract_features_for_review).
# review_year defaults to 2016, the dataset's modal year (see ml/README.md)
# — a made-up recent year would be extrapolation outside training data.
# No city/country default — the model has neither feature (see
# train_rating_model.py: this dataset is 100% US listings, city carried
# 64.8% of total importance, both were removed).
DEFAULT_FEATURES: dict[str, object] = {f"{c}_present": 0 for c in CATEGORIES}
DEFAULT_FEATURES.update({f"{c}_sentiment": 0.0 for c in CATEGORIES})
DEFAULT_FEATURES.update({"review_year": 2016})

EXAMPLE_CURRENT = {
    "breakfast_present": 1,
    "breakfast_sentiment": 0.6,
    "gym_present": 1,
    "gym_sentiment": 0.4,
    "wifi_present": 1,
    "wifi_sentiment": 0.5,
}
EXAMPLE_CHANGES = {"pool_present": 1, "pool_sentiment": 0.7}


def _clamp(rating: float) -> float:
    return max(RATING_MIN, min(RATING_MAX, rating))


def _build_row(features: dict) -> pd.DataFrame:
    row = {**DEFAULT_FEATURES, **features}
    return pd.DataFrame([row])[NUMERIC_FEATURES + CATEGORICAL_FEATURES]


def simulate_rating_change(current: dict, changes: dict) -> dict:
    model = joblib.load(MODELS_DIR / "rating_model.pkl")
    preprocessor = joblib.load(MODELS_DIR / "rating_preprocessing.pkl")

    old_row = _build_row(current)
    new_row = _build_row({**current, **changes})

    old_rating = _clamp(float(model.predict(preprocessor.transform(old_row))[0]))
    new_rating = _clamp(float(model.predict(preprocessor.transform(new_row))[0]))

    return {
        "old_rating": round(old_rating, 2),
        "new_rating": round(new_rating, 2),
        "impact": round(new_rating - old_rating, 2),
    }


if __name__ == "__main__":
    if not sys.stdin.isatty():
        payload = json.loads(sys.stdin.read())
        current, changes = payload.get("current", {}), payload.get("changes", {})
    else:
        current, changes = EXAMPLE_CURRENT, EXAMPLE_CHANGES
    print(json.dumps(simulate_rating_change(current, changes)))
