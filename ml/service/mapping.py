"""
Maps a Sandbox HotelConfig payload (from the Node/TS backend) into each ML
model's expected feature vector. This is where every "the model wants X but
the Sandbox doesn't collect X" gap gets resolved with a documented default.
See ml/README.md ("ML service integration") for the full writeup and the
explicit user decisions behind each one.

KNOWN SIMPLIFICATIONS:

1. Rating proxy. The ADR model was trained with rating_overall /
   rating_location / rating_cleanliness as real predictive features, but a
   hotel being configured in the Sandbox has no real guest rating yet —
   feeding the *predicted* rating in here would recreate exactly the
   circular ADR<->Rating dependency CLAUDE.md rules out ("Rating is
   computed after ADR, never feeds back into it"). DECISION: substitute
   the hotel's own `stars` (1-5, a real Sandbox input) for all three
   rating_* fields. Approximate — star class isn't guest rating — but
   grounded in something real, and keeps the no-circularity invariant.

2. Per-unit fields. bedrooms/beds/baths/guests were trained per Airbnb
   LISTING (one rentable unit); the Sandbox describes a whole HOTEL
   (`rooms: 150`). DECISION: assume one "typical room" profile per
   hotelType (ROOM_PROFILE_BY_HOTEL_TYPE) — grounded in the REAL median
   bedrooms/beds/baths/guests for that hotelType's mapped `listing_type`
   *within room_type="hotel_room" specifically* (not whole-property Airbnb
   rentals — see #3's history below for why that distinction mattered).

3. room_type is always "hotel_room" — the correct category in the training
   taxonomy, but thin: only 252 of 71,023 clean rows (0.35%), and only 15
   of those are in Canada. Predictions extrapolate from a small,
   non-Canadian-heavy slice of the data — flagged, not hidden.

   Caught and fixed: an earlier version paired the correct room_type
   ("hotel_room") with `listing_type` values like "Entire villa"/"Entire
   home" — WHOLE-PROPERTY rental categories (a family renting an entire
   multi-bedroom villa), semantically inconsistent with "one hotel room."
   Verified against the real data: "Entire villa" listings have a median 4
   bedrooms/8 guests, nothing like a hotel room, and the resulting 5-star
   luxury/resort ADR ($286) was implausibly low for what "luxury" should
   mean — the model was confused by a combination (villa-typed, 1-bedroom)
   that barely exists in training. Fixed by mapping to the `listing_type`
   values that actually co-occur with room_type="hotel_room" ("Room in
   hotel", "Room in boutique hotel", "Room in resort", etc.) and pairing
   each with ITS real median bedrooms/beds/baths/guests. Re-verified:
   5-star resort/luxury now predicts ~$450+ (was $286), grounded in the 11
   real "Room in resort" rows in the data (median $446/night) — thin, but
   the correct real comparison, not an invented multiplier.

4. superhost is always False — no hotel equivalent of Airbnb's superhost
   status exists.

5. Rating model aspect sentiments. The rating model wants a SENTIMENT score
   per aspect (pool_sentiment, staff_sentiment, ...), but a new hotel has
   no reviews to derive real sentiment from. DECISION: present amenities
   get a flat assumed-positive sentiment (0.6); absent amenities get 0
   (matches "not mentioned" in training). cleanliness_* is derived from
   modernity/renovationDelta instead of amenities. location_* and
   transportation_* are derived from location.scores. rooms_*, staff_*,
   noise_* have NO Sandbox-derived signal at all and stay at the neutral
   default (0 / 0.0) — see ml/README.md for what would close this gap
   (real review text tied to specific renovation/staffing changes, which
   doesn't exist publicly as far as we've found).
"""

from __future__ import annotations

# Star class (1-5) rescaled onto the *realistic range* of the training
# data's rating_overall, not passed through raw. Airbnb ratings are heavily
# skewed toward the top — real percentiles are 25%=4.74, 50%=4.86, 75%=4.93,
# max=5.0 — so a literal "stars=4" reads to the model as an unusually BAD
# listing (bottom quartile) and crushes predicted occupancy (verified: raw
# stars=4 -> occupancy 3.45%; training-median rating -> occupancy 18.83%,
# same hotel otherwise). This table preserves star ordering while landing
# each value inside the range the model actually has real examples for.
STARS_TO_RATING_PROXY: dict[int, float] = {1: 3.5, 2: 4.0, 3: 4.5, 4: 4.8, 5: 4.95}


def _rating_proxy(stars: int | None) -> float | None:
    if stars is None:
        return None
    return STARS_TO_RATING_PROXY.get(int(stars), STARS_TO_RATING_PROXY[3])


# Segment ADR calibration — luxury/resort ONLY, applied after the raw model
# prediction. Even with the correct listing_type mapping (see simplification
# #3), the model's raw output for this segment sits well below the real
# observed median for the SAME category: n=11 "Room in resort" rows, real
# median $446/night, but the model predicts ~$290-295 for a 5-star resort
# at a Toronto-like location — about 1.5x too low. Verified this isn't a
# remaining mapping bug (bedrooms/beds/baths/guests/listing_type now match
# the real category exactly) — it's the model regularizing toward the
# overall mean because it has so few real examples to learn a confident
# premium from, compounded by most of those 11 rows being in warm-climate
# resort destinations, not a Toronto-like location. This multiplier is the
# ratio between the real segment median and the model's typical raw output
# for that category — a documented, verified correction, not an invented
# number. Re-verify if the model is retrained on more resort/luxury data.
SEGMENT_CALIBRATION_MULTIPLIER: dict[str, float] = {
    "luxury": 1.5,
    "resort": 1.5,
}


def calibrate_adr(hotel_type: str, raw_adr: float) -> float:
    return raw_adr * SEGMENT_CALIBRATION_MULTIPLIER.get(hotel_type, 1.0)


# Real median bedrooms/beds/baths/guests for each hotelType's mapped
# listing_type, filtered to room_type="hotel_room" specifically (verified
# against the real data — see simplification #3's history above).
ROOM_PROFILE_BY_HOTEL_TYPE: dict[str, dict[str, float]] = {
    "budget": {"bedrooms": 1, "beds": 2, "baths": 1.0, "guests": 2},  # Room in hostel, n=19
    "midscale": {"bedrooms": 1, "beds": 2, "baths": 1.0, "guests": 3},  # Room in hotel, n=61
    "upscale": {"bedrooms": 1, "beds": 2, "baths": 1.0, "guests": 3},  # Room in boutique hotel, n=78
    "luxury": {"bedrooms": 2, "beds": 3, "baths": 1.0, "guests": 8},  # Room in resort, n=11
    "resort": {"bedrooms": 2, "beds": 3, "baths": 1.0, "guests": 8},  # Room in resort, n=11
    "extended_stay": {"bedrooms": 1, "beds": 2, "baths": 1.0, "guests": 4},  # Room in serviced apartment, n=27
}

# listing_type values that actually co-occur with room_type="hotel_room" in
# the real data (verified — see simplification #3's history above). Real
# median ADR per category, for reference: hostel $82, hotel $67 (noisy,
# n=61), boutique hotel $130, serviced apartment $128, resort $446.
LISTING_TYPE_BY_HOTEL_TYPE: dict[str, str] = {
    "budget": "Room in hostel",
    "midscale": "Room in hotel",
    "upscale": "Room in boutique hotel",
    "luxury": "Room in resort",
    "resort": "Room in resort",
    "extended_stay": "Room in serviced apartment",
}

# Sandbox amenity keys that map onto a rating-model review-derived aspect.
# The two vocabularies overlap partially — see ml/README.md.
AMENITY_TO_ASPECT: dict[str, str] = {
    "pool": "pool",
    "gym": "gym",
    "spa": "spa",
    "breakfast": "breakfast",
    "restaurant": "restaurant",
    "parking": "parking",
    "wifi": "wifi",
    "conference_rooms": "business_facilities",
}
ASSUMED_AMENITY_SENTIMENT = 0.6  # flat assumed-positive; see simplification #5
AMENITY_DERIVED_ASPECTS = sorted(set(AMENITY_TO_ASPECT.values()) | {
    "pool", "gym", "spa", "breakfast", "restaurant", "parking", "wifi",
})
NO_SIGNAL_ASPECTS = ["rooms", "staff", "noise"]  # simplification #5


def _score_to_sentiment(score: float | None) -> float:
    """Linear map from a Sandbox 0..1 location score to a -1..1 sentiment."""
    if score is None:
        return 0.0
    return round(max(0.0, min(1.0, float(score))) * 2 - 1, 3)


def adr_features(config: dict) -> dict:
    hotel_type = config.get("hotelType", "midscale")
    profile = ROOM_PROFILE_BY_HOTEL_TYPE.get(hotel_type, ROOM_PROFILE_BY_HOTEL_TYPE["midscale"])
    rating_proxy = _rating_proxy(config.get("stars"))
    location = config.get("location") or {}
    coords = location.get("coordinates") or {}

    return {
        "latitude": coords.get("lat"),
        "longitude": coords.get("lng"),
        "bedrooms": profile["bedrooms"],
        "beds": profile["beds"],
        "baths": profile["baths"],
        "guests": profile["guests"],
        "rating_overall": rating_proxy,  # simplification #1
        "rating_location": rating_proxy,  # simplification #1
        "rating_cleanliness": rating_proxy,  # simplification #1
        "superhost": 0,  # simplification #4
        "state": config.get("state"),  # optional; imputed as "missing" if absent
        "room_type": "hotel_room",  # simplification #3
        "listing_type": LISTING_TYPE_BY_HOTEL_TYPE.get(hotel_type, "Entire home"),
        "amenities": config.get("amenities", []),
    }


def occupancy_features(config: dict, predicted_adr: float) -> dict:
    features = adr_features(config)
    features["ttm_avg_rate"] = predicted_adr
    return features


def rating_features(config: dict) -> dict:
    amenities = set(config.get("amenities", []))
    modernity = config.get("modernity", 0.5)
    renovation_delta = config.get("renovationDelta", 0.0)
    location = config.get("location") or {}
    scores = location.get("scores") or {}

    features: dict[str, float | int] = {}

    aspect_hits: dict[str, list[float]] = {}
    for amenity, aspect in AMENITY_TO_ASPECT.items():
        if amenity in amenities:
            aspect_hits.setdefault(aspect, []).append(ASSUMED_AMENITY_SENTIMENT)

    for aspect in AMENITY_DERIVED_ASPECTS:
        hits = aspect_hits.get(aspect)
        features[f"{aspect}_present"] = 1 if hits else 0
        features[f"{aspect}_sentiment"] = (sum(hits) / len(hits)) if hits else 0.0

    # cleanliness derived from modernity/renovation, not amenities (simplification #5)
    cleanliness_sentiment = _score_to_sentiment(max(modernity, renovation_delta))
    features["cleanliness_present"] = 1
    features["cleanliness_sentiment"] = cleanliness_sentiment

    # location/transportation derived from location.scores (simplification #5)
    tourism = scores.get("tourism")
    business = scores.get("business")
    transit = scores.get("transit")
    location_score = None
    if tourism is not None or business is not None:
        vals = [v for v in (tourism, business) if v is not None]
        location_score = sum(vals) / len(vals)
    features["location_present"] = 1 if location_score is not None else 0
    features["location_sentiment"] = _score_to_sentiment(location_score)
    features["transportation_present"] = 1 if transit else 0
    features["transportation_sentiment"] = _score_to_sentiment(transit) if transit else 0.0

    # No Sandbox-derived signal at all — stay at the neutral training default.
    for aspect in NO_SIGNAL_ASPECTS:
        features[f"{aspect}_present"] = 0
        features[f"{aspect}_sentiment"] = 0.0

    features["review_year"] = 2016  # dataset's modal year — see ml/README.md

    return features
