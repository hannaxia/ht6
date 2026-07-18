"""
Loads and cleans the hotel reviews dataset. This is a SEPARATE data source
from the Airbnb listings used by ../train_adr.py / ../train_occupancy.py —
the Hotel Rating Impact Model never touches
ml/datasets/airbnb_market_data_north_america/, and vice versa.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

SATISFACTION_DIR = Path(__file__).resolve().parent
TRAINING_DIR = SATISFACTION_DIR.parent
ML_DIR = TRAINING_DIR.parent
DATASET_PATH = ML_DIR / "datasets" / "hotel_reviews" / "Hotel Reviews.csv"
MODELS_DIR = ML_DIR / "models"

RATING_MIN, RATING_MAX = 1.0, 5.0


def load_reviews() -> pd.DataFrame:
    return pd.read_csv(DATASET_PATH, encoding="utf-8", encoding_errors="replace", low_memory=False)


def clean_reviews(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["reviews.rating"] = pd.to_numeric(df["reviews.rating"], errors="coerce")

    before = len(df)
    df = df.dropna(subset=["reviews.text", "reviews.rating"])
    df["reviews.text"] = df["reviews.text"].astype(str).str.strip()
    df = df[df["reviews.text"].str.len() > 0]
    df = df[(df["reviews.rating"] >= RATING_MIN) & (df["reviews.rating"] <= RATING_MAX)]
    dropped = before - len(df)
    if dropped:
        print(f"Dropped {dropped:,} rows with missing/invalid text or out-of-range rating")

    # review_year: mild temporal feature ("if useful" per spec) — dataset is
    # heavily concentrated in 2015-2016 (see ml/README.md), so predictions
    # for years far outside that range are extrapolation, not interpolation.
    df["review_year"] = pd.to_datetime(df["reviews.date"], errors="coerce", utc=True).dt.year

    return df.reset_index(drop=True)


def load_and_clean() -> pd.DataFrame:
    return clean_reviews(load_reviews())
