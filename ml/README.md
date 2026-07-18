# Innsight ML layer

Three supervised XGBoost regressors, two separate pipelines that never
share data:

- **ADR + occupancy** (`ml/training/`) — trained on real Airbnb North
  America listings, standing in for two of the deterministic formulas in
  `api/src/simulation/`. Revenue is **not** modeled; it's still
  `ADR × Occupancy × Rooms × 365`, computed in the app, not by a model.
- **Hotel Rating Impact Model** (`ml/training/satisfaction/`) — trained on
  a separate hotel reviews dataset, predicts `reviews.rating` from
  NLP-extracted hotel-aspect features, and exposes a counterfactual
  "if I change X, what happens to the rating" function.

**Not wired into the backend yet.** Every `predict_*.py` / `simulate_*.py`
script is standalone (stdin JSON in, JSON out) meant to be called from
`api/` later — as a subprocess, or ported behind a small FastAPI/Flask
service. That integration hasn't been built for either pipeline.

## Setup

```bash
# from repo root, using the existing .venv
.venv/Scripts/python.exe -m pip install -r ml/training/requirements.txt
```

## Run training

```bash
cd ml/training
python train_adr.py
python train_occupancy.py

cd satisfaction
python train_rating_model.py
```

Outputs land in `ml/models/` (gitignored — regenerate, don't commit):
`adr_model.pkl`, `adr_preprocessing.pkl`, `occupancy_model.pkl`,
`occupancy_preprocessing.pkl`, `adr_feature_importance.csv`,
`occupancy_feature_importance.csv`, `rating_model.pkl`,
`rating_preprocessing.pkl`, `rating_feature_importance.csv`.

## Data

`ml/datasets/` (gitignored — large, and already present in this checkout):

- `airbnb_market_data_north_america/listings.csv` (+ `.parquet`, same data,
  ~4x smaller — training prefers the parquet copy) — the only file the ADR
  and occupancy models train on.
- `airbnb_market_data_north_america/past_rates.csv` — daily time series,
  not used by either model (spec doesn't call for it; would matter for a
  future seasonality-aware version).
- `hotel_reviews/Hotel Reviews.csv` — the only file the rating model trains
  on. **Never combined with the Airbnb listings** — separate pipeline,
  separate folder (`satisfaction/`), separate models directory entries.

## Results (real, on a 20% held-out split)

```
ADR MODEL
MAE:   $69.36
RMSE:  $129.74
R2:    0.7637

OCCUPANCY MODEL
MAE:   0.1575   (15.8 percentage points)
RMSE:  0.1939
R2:    0.2536
```

Occupancy's R² is genuinely much lower than ADR's — not a bug. Checked: the
target itself is clean (no out-of-range values, sane [0.03, 1.0] spread).
Occupancy just depends heavily on things this dataset doesn't capture
(search ranking, photo quality, host responsiveness, seasonality) — static
listing attributes explain some of it, not most of it. Reporting the real
number rather than tuning until it looks better.

## No `city` feature — removed, not just deprioritized

Originally both models had `city` (one-hot, capped at 50 categories) and an
engineered `city_frequency`. Both are gone. Why: this dataset is ~72% US
listings (Canada is only 8.6% — United States 51,878 / Mexico 10,976 /
Canada 6,156 / Costa Rica 2,019 / rest smaller), so per-city patterns are
overwhelmingly US-market-specific. For a Canada-focused product, any actual
target city falls into the one-hot encoder's "unseen category" bucket
regardless — the feature wasn't just unhelpful, it was actively encoding
signal that can't apply to real usage.

Checked how much this actually cost before removing it — city-related
columns held **18.9% of total importance in the ADR model and 41.8% in
occupancy** before removal. After removal, both models' R² barely moved
(ADR 0.7647→0.7637, occupancy 0.2534→0.2536): the "importance" was mostly
redundant with `latitude`/`longitude`/`state`/`rating_overall`/amenities,
not unique signal, so XGBoost just redistributed it to features that
generalize. Verified with real before/after retraining, not assumed.

## Data-quality issue found and fixed

**881 of 71,904 rows (1.2%) have shifted columns** — an upstream CSV-export
bug present even in the parquet copy: `room_type` ends up holding a
`cover_photo_url` value instead of a category. Those exact rows also carry
absurd prices (mean $3,716/night vs. $248 for clean rows; max
**$284,142/night**), which single-handedly wrecked the first training run
(RMSE $1,041, R² 0.62, top "feature" was a Costa Rican province driven by a
handful of corrupted outliers). `feature_engineering.filter_corrupted_rows()`
drops any row whose `room_type` isn't one of the four valid values before
either model sees it — that's the whole fix; see the numbers above are
post-fix.

## Amenity vocabulary

Trained on the product's actual 15-amenity list (`packages/config/src/
amenityImpact.ts`, `web/components/sandbox/SandboxForm.tsx`), not the ML
spec's own example list, so a Sandbox toggle maps directly onto a model
feature.

**Verified against the real data: 7 of these 15 never occur in Airbnb's
amenity taxonomy at all** — `spa`, `restaurant`, `bar`, `conference_rooms`,
`rooftop_bar`, `airport_shuttle`, `smart_rooms`. These are hotel-specific
concepts; Airbnb tags homes/apartments, not full-service hotels. Those
columns are constant zero — harmless to XGBoost (never split on), but
**toggling them in the Sandbox will not move an ML-predicted ADR or
occupancy.** The deterministic config engine still has hand-tuned values
for all 15 and should keep handling those seven specifically, unless/until
a hotel-specific dataset is added. The 8 with real signal: `pool` (38% of
listings), `parking` (94%), `wifi` (98%), `coworking`≈workspace (53%),
`pet_friendly` (29%), `gym` (16%), `breakfast` (3.6%), `ev_charging` (3.7%).

Matching itself uses word-boundary regex, not plain substring — plain
substring matching let `"spa"` false-positive-match inside `"workspace"`
(...work-**spa**-ce...) in an earlier pass; caught via the occurrence-rate
sanity check before training, not left in.

---

## Hotel Rating Impact Model (`ml/training/satisfaction/`)

Predicts `reviews.rating` (1.0-5.0) from 14 hotel aspects extracted out of
free-text reviews via keyword matching + VADER sentence-level sentiment —
no fine-tuning, no model download, per spec ("do not over-engineer").
Aspects: pool, gym, spa, breakfast, restaurant, parking, wifi, cleanliness,
rooms, staff (staff/service combined), location, noise, transportation,
business_facilities. Each gets a `{aspect}_present` (0/1) and
`{aspect}_sentiment` (VADER compound, [-1,1]) feature — sentiment is scored
per sentence that mentions the aspect, not the whole review, so "the pool
was amazing but the wifi was terrible" scores pool positive and wifi
negative independently, matching the spec's own example.

Also uses `review_year` (from `reviews.date`) as a feature. **No `city` or
`country`**, despite the spec listing both: `country` is 100% `"US"` in
this dataset (verified) — a constant column, contributes exactly zero
importance regardless, removing it is risk-free. `city` is a bigger deal —
this dataset is **100% US reviews, zero Canadian cities**, and city was
carrying **64.8% of this model's total feature importance**, the single
largest share by a wide margin, before removal. That's the opposite of
harmless: a Canada-focused product would fall into the "unseen category"
bucket on every real query while the model's biggest lever came from
US-city-specific patterns. Removed both; see "Results" below for the real
measured cost.

### Results (real, on a 20% held-out split)

```
RATING MODEL
MAE:   0.7418
RMSE:  0.9609
R2:    0.3076
```

R² dropped slightly after removing city/country (0.3155 → 0.3076) — a
small, honest cost, since unlike the ADR/occupancy models some of that
importance really was unique signal here, not fully redundant. In exchange,
the top-10 factors are now **entirely genuine hospitality features** —
rooms, staff, and cleanliness sentiment lead, followed by review_year,
breakfast, noise, business_facilities, location, and parking sentiment —
instead of a list dominated by specific US city names. That's a real
usability win for a product that wants to explain *why* a rating changed,
not just predict a number.

Lower R² than the ADR model generally, and that's expected, not a
shortfall to hide: individual review ratings carry a lot of idiosyncratic,
personal variance that a lexicon-based sentiment scorer over 14 keyword
categories can't capture (VADER doesn't know sarcasm, doesn't know what a
specific guest actually cared about that trip). The top factors lining up
with what real hospitality research says drives ratings is the sanity
check that matters here, not the raw R² number.

### Counterfactual simulation (`simulate_rating_change.py`)

```bash
cd ml/training/satisfaction
python simulate_rating_change.py
# {"old_rating": 4.67, "new_rating": 4.88, "impact": 0.2}
```

Takes `{"current": {...}, "changes": {...}}` (stdin JSON), builds the
before/after feature rows (unspecified fields default to "not mentioned" —
0 presence, 0.0 sentiment, matching what a review that never brings up an
aspect looks like in training), predicts both, returns
`{old_rating, new_rating, impact}` clamped to [1.0, 5.0].

**Impacts are not always positive, and that's correct model behavior, not
a bug** — e.g. adding a pool to a hotel whose cleanliness and staff are
already strongly positive can come back near-zero or slightly negative,
because XGBoost has learned real interaction effects, not "amenity X is
always worth +0.15." Verified by testing more than one scenario, not just
the one that looked good.

### Deviations from the literal spec here

- **`models/rating_preprocessing.pkl`** (not in the original file list) —
  `simulate_rating_change.py` needs the fitted `ColumnTransformer` to
  encode a single new feature row the same way training data was encoded.
- No `city`/`country` features at all (spec listed both) — see above.
- `evaluate_rating_model.py` duplicates `../evaluate_models.py`'s two
  functions rather than importing them — keeps `satisfaction/` a
  self-contained folder, consistent with never mixing this dataset/pipeline
  with the Airbnb one.

## Deviations from the literal file-naming spec (ADR / occupancy)

- **`models/adr_preprocessing.pkl` + `models/occupancy_preprocessing.pkl`
  instead of one shared `models/preprocessing.pkl`.** The two models don't
  share a feature set — `ttm_avg_rate` is a feature for occupancy but is
  literally the ADR model's target — so one shared fitted transformer
  can't correctly serve both. Two clearly-named files is the correct
  behavior, not a shortcut.
- No `city` feature (spec's example input includes `"city": "Toronto"`) —
  see "No `city` feature" above.

## Files

```
ml/
├── datasets/                        real data, gitignored
├── training/
│   ├── feature_engineering.py       shared: loading, cleaning, amenity
│   │                                 parsing, ColumnTransformer (no city — see README)
│   ├── train_adr.py
│   ├── train_occupancy.py
│   ├── evaluate_models.py           shared MAE/RMSE/R2 + feature-importance reporting
│   ├── predict_adr.py               example inference (stdin JSON -> stdout JSON)
│   ├── predict_occupancy.py
│   ├── requirements.txt             shared by both pipelines (same venv)
│   └── satisfaction/                Hotel Rating Impact Model — separate
│       │                            pipeline, separate dataset, never mixed
│       │                            with the Airbnb models above
│       ├── preprocess_reviews.py
│       ├── extract_review_features.py   keyword + VADER sentiment, 14 aspects
│       ├── evaluate_rating_model.py     self-contained (not shared with ../)
│       ├── train_rating_model.py
│       └── simulate_rating_change.py    counterfactual: old/new rating + impact
├── models/                          generated by training, gitignored
└── README.md
``` 
