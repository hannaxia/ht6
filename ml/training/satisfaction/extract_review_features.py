"""
Converts raw review text into structured per-category presence + sentiment
features. Deliberately simple per spec: keyword matching (word-boundary
regex, same discipline as the amenity matching in ../feature_engineering.py
— plain substring already caused one false-positive bug there) + VADER, a
lexicon-based sentiment scorer with no model download/training required.

Presence is "was this category mentioned anywhere in the review." Sentiment
is the VADER compound score of the SENTENCE(S) that mention it, averaged if
mentioned more than once — not the whole review's sentiment — so a mixed
review ("the pool was amazing but the wifi was terrible") scores each aspect
on its own, matching the spec's own example.
"""

from __future__ import annotations

import re

import pandas as pd
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "pool": [r"\bpool\b"],
    "gym": [r"\bgym\b", r"\bfitness\b"],
    "spa": [r"\bspa\b"],
    "breakfast": [r"\bbreakfast\b"],
    "restaurant": [r"\brestaurant\b", r"\bdining\b"],
    "parking": [r"\bparking\b"],
    "wifi": [r"\bwifi\b", r"\bwi-fi\b", r"\binternet\b"],
    "cleanliness": [r"\bclean\w*\b", r"\bdirty\b", r"\bdust\w*\b", r"\bspotless\b", r"\bhygien\w*\b"],
    "rooms": [r"\brooms?\b", r"\bbedroom\b"],
    "staff": [r"\bstaff\b", r"\bservice\b", r"\bemployee\w*\b", r"\breceptionist\b", r"\bconcierge\b"],
    "location": [r"\blocation\b", r"\blocated\b", r"\bneighbo(u)?rhood\b", r"\bwalking distance\b"],
    "noise": [r"\bnois\w*\b", r"\bloud\b", r"\bquiet\b"],
    "transportation": [
        r"\btransport\w*\b", r"\btransit\b", r"\bsubway\b", r"\bbus\b",
        r"\btrain\b", r"\btaxi\b", r"\buber\b",
    ],
    "business_facilities": [
        r"\bbusiness center\b", r"\bconference\b", r"\bmeeting room\b",
        r"\bbusiness facilit\w*\b",
    ],
}
CATEGORIES = list(CATEGORY_KEYWORDS.keys())

_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+")
_analyzer = SentimentIntensityAnalyzer()


def split_sentences(text: str) -> list[str]:
    text = text.strip()
    if not text:
        return []
    return [s for s in _SENTENCE_SPLIT_RE.split(text) if s.strip()]


def sentence_sentiment(sentence: str) -> float:
    """VADER compound score, in [-1, 1]."""
    return _analyzer.polarity_scores(sentence)["compound"]


def extract_features_for_review(text: str) -> dict[str, float]:
    features: dict[str, float] = {}
    for category in CATEGORIES:
        features[f"{category}_present"] = 0
        features[f"{category}_sentiment"] = 0.0

    category_scores: dict[str, list[float]] = {c: [] for c in CATEGORIES}
    for sentence in split_sentences(text):
        lower = sentence.lower()
        mentioned = [
            category
            for category, patterns in CATEGORY_KEYWORDS.items()
            if any(re.search(p, lower) for p in patterns)
        ]
        if not mentioned:
            continue
        score = sentence_sentiment(sentence)
        for category in mentioned:
            category_scores[category].append(score)

    for category, scores in category_scores.items():
        if scores:
            features[f"{category}_present"] = 1
            features[f"{category}_sentiment"] = sum(scores) / len(scores)

    return features


def extract_features(df: pd.DataFrame, text_col: str = "reviews.text") -> pd.DataFrame:
    """Applies extract_features_for_review() to every row; returns df + new columns."""
    records = [extract_features_for_review(t) for t in df[text_col]]
    features_df = pd.DataFrame(records, index=df.index)
    return pd.concat([df, features_df], axis=1)
