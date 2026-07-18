"""
Trains the occupancy predictor.

Target:   ttm_occupancy (already a 0-1 fraction in this dataset, not a
          percentage — predict_occupancy.py's example output of 0.78 is
          consistent with that).
Features: latitude, longitude, room_type, listing_type, bedrooms, beds,
          baths, guests, amenities (parsed to binary flags), rating_overall,
          rating_location, ttm_avg_rate.

No `city` / `city_frequency` — see feature_engineering.py: this dataset is
~72% US listings, so city-level features encode US-market patterns that
don't transfer to a Canada-focused product (verified: they carried ~42% of
this model's total feature importance before removal — the single largest
chunk of the model's decision-making).

ttm_avg_rate is intentionally a FEATURE here (price affects occupancy) even
though it's the ADR model's target — that's expected, not leakage: it's an
input to this model, not derived from this model's own target.

Run: python train_occupancy.py   (from ml/training/, with the venv active)
"""

from __future__ import annotations

import time

import joblib
from evaluate_models import evaluate, feature_importance_report
from feature_engineering import (
    CANONICAL_AMENITIES,
    MODELS_DIR,
    build_preprocessor,
    load_and_engineer,
    prepare_features,
)
from sklearn.model_selection import train_test_split
from xgboost import XGBRegressor

TARGET = "ttm_occupancy"

NUMERIC_FEATURES = [
    "latitude",
    "longitude",
    "bedrooms",
    "beds",
    "baths",
    "guests",
    "rating_overall",
    "rating_location",
    "ttm_avg_rate",
    *CANONICAL_AMENITIES,
]
CATEGORICAL_FEATURES = ["room_type", "listing_type"]


def main() -> None:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    print("Loading listings and engineering features...")
    df = load_and_engineer()
    X, y = prepare_features(df, NUMERIC_FEATURES, CATEGORICAL_FEATURES, TARGET)
    print(f"Rows after dropping missing target: {len(X):,}")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42
    )

    preprocessor = build_preprocessor(NUMERIC_FEATURES, CATEGORICAL_FEATURES)
    X_train_t = preprocessor.fit_transform(X_train)
    X_test_t = preprocessor.transform(X_test)

    print(f"Training XGBRegressor on {X_train_t.shape[0]:,} rows, "
          f"{X_train_t.shape[1]} encoded features...")
    model = XGBRegressor(
        n_estimators=400,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        n_jobs=-1,
    )
    start = time.time()
    model.fit(X_train_t, y_train)
    print(f"Trained in {time.time() - start:.1f}s")

    y_pred = model.predict(X_test_t)
    evaluate(y_test, y_pred, label="OCCUPANCY MODEL", unit="")

    feature_importance_report(
        model,
        preprocessor,
        MODELS_DIR / "occupancy_feature_importance.csv",
        label="Occupancy model",
    )

    # See train_adr.py for why this gets its own *_preprocessing.pkl rather
    # than sharing a single models/preprocessing.pkl with the ADR model.
    joblib.dump(model, MODELS_DIR / "occupancy_model.pkl")
    joblib.dump(preprocessor, MODELS_DIR / "occupancy_preprocessing.pkl")
    print(f"\nSaved: {MODELS_DIR / 'occupancy_model.pkl'}")
    print(f"Saved: {MODELS_DIR / 'occupancy_preprocessing.pkl'}")


if __name__ == "__main__":
    main()
