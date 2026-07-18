"""
Shared preprocessing for the ADR and occupancy models. Both train_adr.py and
train_occupancy.py call load_and_engineer() to get the same enriched
DataFrame, then each selects its own numeric/categorical feature lists (they
differ — e.g. ttm_avg_rate is a feature for occupancy but is the ADR target)
and builds its own ColumnTransformer via build_preprocessor().

No city / city_frequency feature, deliberately: this dataset is ~72% US
listings (Canada is only 8.6%), so per-city one-hot columns and the
frequency derived from them both encode US-market-specific patterns that
don't transfer to a Canada-focused product — verified they carried 19-42%
of total feature importance in the ADR/occupancy models before removal,
which made an unseen-city fallback (any Canadian city not in the learned
top-50) worse than just not having the feature. See ml/README.md.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

TRAINING_DIR = Path(__file__).resolve().parent
ML_DIR = TRAINING_DIR.parent
DATASET_DIR = ML_DIR / "datasets" / "airbnb_market_data_north_america"
MODELS_DIR = ML_DIR / "models"

# Matches the product's actual amenity vocabulary (packages/config/src/
# amenityImpact.ts, web/components/sandbox/SandboxForm.tsx) rather than the
# ML spec's own example list, so a trained model's features line up with
# what the Hotel Sandbox lets a user toggle.
#
# VERIFIED against this dataset (see ml/README.md): 7 of these 15 never
# occur in real Airbnb amenity text at all — spa, restaurant, bar,
# conference_rooms, rooftop_bar, airport_shuttle, smart_rooms are all
# hotel-specific concepts; Airbnb's taxonomy tags homes/apartments, not
# full-service hotels. Those columns will be constant zero — harmless to
# XGBoost (it just never splits on them), but toggling them in the Sandbox
# will NOT move an ML-predicted ADR/occupancy. The deterministic config
# engine (packages/config/src/amenityImpact.ts) still has hand-tuned values
# for all 15 and should keep handling those specific amenities unless/until
# a hotel-specific dataset is added.
#
# Word-boundary regex, not plain substring — plain substring matching let
# "spa" false-positive-match inside "workspace" (...work-SPA-ce...).
AMENITY_PATTERNS: dict[str, list[str]] = {
    "pool": [r"\bpool\b"],
    "gym": [r"\bgym\b", r"\bfitness\b"],
    "spa": [r"\bspa\b"],  # 0% — see note above
    "restaurant": [r"\brestaurant\b"],  # 0%
    "bar": [r"\bbar\b"],  # 0%
    "breakfast": [r"\bbreakfast\b"],
    "wifi": [r"\bwifi\b"],
    "parking": [r"\bparking\b"],
    "coworking": [r"\bworkspace\b", r"\bcoworking\b", r"\boffice\b"],
    "ev_charging": [r"\bev charger\b", r"electric vehicle", r"\bev charging\b"],
    "conference_rooms": [r"\bconference\b", r"meeting room"],  # 0%
    "rooftop_bar": [r"\brooftop\b"],  # 0%
    "airport_shuttle": [r"airport shuttle", r"\bshuttle\b"],  # 0%
    "smart_rooms": [r"smart tv", r"smart lock", r"smart home"],  # 0%
    "pet_friendly": [r"pets allowed", r"pet friendly"],
}
CANONICAL_AMENITIES = list(AMENITY_PATTERNS.keys())


# Source data has ~1.2% of rows where columns are shifted (an upstream
# CSV-export bug, present even in the parquet copy) — room_type ends up
# holding a cover_photo_url instead. Those rows also carry nonsense prices
# (observed: mean $3,716/night vs. $248 for clean rows, max $284,142/night),
# which single-handedly wrecked RMSE and feature importances before this
# filter existed. Detected via room_type validity, since that's where the
# corruption is visible.
VALID_ROOM_TYPES = {"entire_home", "private_room", "hotel_room", "shared_room"}


def filter_corrupted_rows(df: pd.DataFrame) -> pd.DataFrame:
    valid = df["room_type"].isin(VALID_ROOM_TYPES)
    dropped = len(df) - int(valid.sum())
    if dropped:
        print(f"Dropping {dropped:,} rows with corrupted/shifted columns "
              f"(invalid room_type — see feature_engineering.py)")
    return df.loc[valid].copy()


def load_listings() -> pd.DataFrame:
    """Loads listings — prefers the parquet copy (same data, ~4x smaller/faster)."""
    parquet_path = DATASET_DIR / "listings.parquet"
    csv_path = DATASET_DIR / "listings.csv"
    if parquet_path.exists():
        return pd.read_parquet(parquet_path)
    return pd.read_csv(csv_path, low_memory=False, encoding="utf-8", encoding_errors="replace")


def parse_amenities(df: pd.DataFrame, amenities_col: str = "amenities") -> pd.DataFrame:
    """Adds one binary column per AMENITY_PATTERNS entry."""
    df = df.copy()
    raw = df[amenities_col].fillna("").astype(str).str.lower()
    for amenity, patterns in AMENITY_PATTERNS.items():
        mask = pd.Series(False, index=df.index)
        for pattern in patterns:
            mask = mask | raw.str.contains(pattern, regex=True)
        df[amenity] = mask.astype(int)
    return df


def amenities_flags_from_list(amenities: list[str]) -> dict[str, int]:
    """
    For inference callers (predict_adr.py / predict_occupancy.py): the
    Sandbox already sends clean canonical keys (e.g. ["pool","gym"]), not
    messy free text, so this is a direct membership check — not the
    AMENITY_PATTERNS regex matching, which is for parsing raw dataset text.
    """
    provided = {a.lower().replace(" ", "_") for a in (amenities or [])}
    return {amenity: int(amenity in provided) for amenity in CANONICAL_AMENITIES}


def clean_boolean(series: pd.Series) -> pd.Series:
    """'true'/'false' strings (or actual bools) -> 1/0, missing -> 0."""
    return (
        series.astype(str)
        .str.strip()
        .str.lower()
        .map({"true": 1, "false": 0})
        .fillna(0)
        .astype(int)
    )


def load_and_engineer() -> pd.DataFrame:
    """Loads listings.csv/parquet and applies every shared engineering step."""
    df = load_listings()
    df = filter_corrupted_rows(df)
    df = parse_amenities(df)
    if "superhost" in df.columns:
        df["superhost"] = clean_boolean(df["superhost"])
    return df


def prepare_features(
    df: pd.DataFrame,
    numeric_features: list[str],
    categorical_features: list[str],
    target_col: str,
) -> tuple[pd.DataFrame, pd.Series]:
    """
    Selects exactly the requested feature columns (never touches any
    ttm_revenue/ttm_revpar/l90d_* column, which is how target leakage is
    avoided — we only ever look at what's explicitly listed here) and the
    target, coercing numerics and dropping rows with a missing target.
    """
    df = df.copy()
    for col in numeric_features:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    df[target_col] = pd.to_numeric(df[target_col], errors="coerce")
    df = df.dropna(subset=[target_col])

    feature_cols = [c for c in (*numeric_features, *categorical_features) if c in df.columns]
    return df[feature_cols], df[target_col]


def build_preprocessor(
    numeric_features: list[str], categorical_features: list[str]
) -> ColumnTransformer:
    """
    sklearn Pipeline + ColumnTransformer, per spec. Median-impute + scale
    numerics; most-frequent-impute (falling back to a constant) + one-hot
    categoricals, capping high-cardinality columns like `city` at 50
    categories (plus an "infrequent" bucket) so the encoded matrix stays a
    manageable, dense size.
    """
    numeric_pipeline = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
        ]
    )
    categorical_pipeline = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="constant", fill_value="missing")),
            (
                "onehot",
                OneHotEncoder(handle_unknown="ignore", max_categories=50, sparse_output=False),
            ),
        ]
    )
    return ColumnTransformer(
        transformers=[
            ("num", numeric_pipeline, numeric_features),
            ("cat", categorical_pipeline, categorical_features),
        ],
        remainder="drop",
    )
