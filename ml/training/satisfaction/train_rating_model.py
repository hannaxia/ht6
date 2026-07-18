"""
Trains the Hotel Rating Impact Model — separate from the Airbnb ADR and
occupancy models (train_adr.py, train_occupancy.py), trained ONLY on
ml/datasets/hotel_reviews/Hotel Reviews.csv. The two datasets are never
combined.

Target:   reviews.rating (1.0-5.0)
Features: 14 categories x (presence, sentiment) extracted from review text
          (see extract_review_features.py), plus review_year.

No `city` / `country`. City was carrying 64.8% of this model's total
feature importance — the single largest share, by a wide margin — but this
dataset is 100% US listings (0% Canada), so that dominant chunk of learned
signal was entirely US-city-specific patterns with zero representation for
a Canada-focused product; any Canadian city falls into the "unseen
category" bucket anyway, so the feature was actively misleading, not just
unused. `country` is provably safe to drop too: it's 100% "US" in this
dataset (verified), a constant column that contributes exactly zero
importance regardless — removing it changes nothing about model accuracy.

Run: python train_rating_model.py   (from ml/training/satisfaction/, venv active)
"""

from __future__ import annotations

import time

import joblib
from evaluate_rating_model import evaluate, feature_importance_report
from extract_review_features import CATEGORIES, extract_features
from preprocess_reviews import MODELS_DIR, load_and_clean
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from xgboost import XGBRegressor

TARGET = "reviews.rating"

NUMERIC_FEATURES = (
    [f"{c}_present" for c in CATEGORIES]
    + [f"{c}_sentiment" for c in CATEGORIES]
    + ["review_year"]
)
CATEGORICAL_FEATURES: list[str] = []


def build_preprocessor() -> ColumnTransformer:
    """
    Numeric-only — no categorical branch. CATEGORICAL_FEATURES is
    deliberately empty (see module docstring: city/country both removed),
    kept as an empty list rather than deleted so the "this model has no
    categorical features" decision stays visible, not silently absent.
    """
    numeric_pipeline = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
        ]
    )
    return ColumnTransformer(
        transformers=[("num", numeric_pipeline, NUMERIC_FEATURES)],
        remainder="drop",
    )


def main() -> None:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    print("Loading and cleaning reviews...")
    df = load_and_clean()
    print(f"Rows: {len(df):,}")

    print("Extracting per-category presence + sentiment features (VADER)...")
    start = time.time()
    df = extract_features(df)
    print(f"Extracted in {time.time() - start:.1f}s")

    X = df[NUMERIC_FEATURES + CATEGORICAL_FEATURES]
    y = df[TARGET]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42
    )

    preprocessor = build_preprocessor()
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
    evaluate(y_test, y_pred, label="RATING MODEL")

    feature_importance_report(
        model,
        preprocessor,
        MODELS_DIR / "rating_feature_importance.csv",
        label="Rating model",
    )

    joblib.dump(model, MODELS_DIR / "rating_model.pkl")
    joblib.dump(preprocessor, MODELS_DIR / "rating_preprocessing.pkl")
    print(f"\nSaved: {MODELS_DIR / 'rating_model.pkl'}")
    print(f"Saved: {MODELS_DIR / 'rating_preprocessing.pkl'}")


if __name__ == "__main__":
    main()
