"""
Trains the ADR (average daily rate) predictor.

Target:   ttm_avg_rate
Features: latitude, longitude, state, room_type, listing_type, bedrooms,
          beds, baths, guests, amenities (parsed to binary flags),
          rating_overall, rating_location, rating_cleanliness, superhost

No `city` / `city_frequency` — see feature_engineering.py: this dataset is
~72% US listings, so city-level features encode US-market patterns that
don't transfer to a Canada-focused product (verified: they carried ~19% of
this model's total feature importance before removal).

Deliberately excludes anything derived from revenue/occupancy/revpar or any
l90d_* rolling-window column — those are the same measurement family as the
target and would leak it. The only columns touched are the ones explicitly
selected below.

Run: python train_adr.py   (from ml/training/, with the venv active)
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

TARGET = "ttm_avg_rate"

NUMERIC_FEATURES = [
    "latitude",
    "longitude",
    "bedrooms",
    "beds",
    "baths",
    "guests",
    "rating_overall",
    "rating_location",
    "rating_cleanliness",
    "superhost",
    *CANONICAL_AMENITIES,
]
CATEGORICAL_FEATURES = ["state", "room_type", "listing_type"]


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
    evaluate(y_test, y_pred, label="ADR MODEL", unit="$")

    feature_importance_report(
        model,
        preprocessor,
        MODELS_DIR / "adr_feature_importance.csv",
        label="ADR model",
    )

    # Model and preprocessor are saved separately (not bundled into one
    # sklearn Pipeline object) so predict_adr.py can load+inspect each on
    # its own, matching the models/adr_model.pkl + models/preprocessing.pkl
    # split the spec asks for. Note: ADR and occupancy need DIFFERENT
    # preprocessors (different feature sets — ttm_avg_rate is a feature for
    # occupancy but is literally this model's target), so each gets its own
    # clearly-named file instead of sharing one models/preprocessing.pkl.
    joblib.dump(model, MODELS_DIR / "adr_model.pkl")
    joblib.dump(preprocessor, MODELS_DIR / "adr_preprocessing.pkl")
    print(f"\nSaved: {MODELS_DIR / 'adr_model.pkl'}")
    print(f"Saved: {MODELS_DIR / 'adr_preprocessing.pkl'}")


if __name__ == "__main__":
    main()
