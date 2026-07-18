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

**Wired into the backend.** `ml/service/` is a FastAPI wrapper around the
three trained models; the Node API calls it for ADR/occupancy/rating and
falls back to the deterministic formula engine on any failure. See "ML
service integration" below for the full design, and the "known
simplifications" documented in `ml/service/mapping.py` for every place the
mapping from a Sandbox hotel configuration to a model's expected features
required an approximation.

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

## Run the ML service

```bash
# from repo root, after training has produced ml/models/*.pkl
npm run dev:ml
# or directly:
.venv/Scripts/python.exe -m uvicorn main:app --app-dir ml/service --port 8000
```

Also included in `npm run dev` at the repo root (runs alongside `api`/`web`
via `concurrently`, prefixed `[ml]`). `GET /health` reports which of the six
`.pkl` files loaded — the service starts fine even if training hasn't been
run yet, it just answers `{"status": "degraded", ...}` and every predict
endpoint returns 503 until the missing model is trained.

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

---

## Currency — everything user-facing is CAD

Innsight is a Canada-focused product; every dollar figure a user sees is
CAD. Three separate places needed this, not one:

1. **ML predictions.** Both trained models learned from USD-denominated
   Airbnb data — the model itself still outputs USD internally. Converted
   to CAD exactly once, in `api/src/simulation/index.ts`, immediately after
   the ADR prediction comes back and before it's used for revenue or the
   final output. Uses a static rate (`packages/config/src/currency.ts`,
   `usdToCadRate = 1.37`) — not a live FX API, documented as an
   approximation, tunable like every other config constant.
2. **The occupancy model still needs USD internally.** It was trained with
   `ttm_avg_rate` as a USD-scale feature, so converting ADR to CAD *before*
   calling `/predict/occupancy` would feed it an out-of-distribution value.
   `simulateHotel()` keeps a separate `adrUsdForOccupancy` alongside the
   CAD-converted `adr` — the USD value goes to the occupancy call, the CAD
   value goes everywhere else (revenue, price-expectation penalty, final
   output). This applies whichever path produced ADR: if the deterministic
   formula won instead of ML, its CAD-native output is converted *back* to
   a USD-equivalent for that one occupancy call, then never surfaced.
3. **Stay22's live hotel prices** were defaulting to USD (their API's
   default). Fixed by requesting `currency=CAD` directly in
   `api/src/stay22/client.ts` — Stay22 does its own live FX for that,
   more accurate than a static rate for real market data, so no manual
   conversion needed there.

The deterministic formula engine's own config values (`packages/config/
src/cost.ts`, `api/src/cities.ts` basePrice/segmentAdrNorm) needed no
conversion at all — they were always arbitrary hackathon placeholders,
never tied to a real currency, so they're just documented as CAD-native
directly.

Verified end to end through the real API, not just the Python layer: a
5-star luxury resort came back at $602.76 CAD, matching $439.97 USD ×
1.37 exactly.

---

## ML service integration

`ml/service/main.py` is a FastAPI app that loads all six `.pkl` files once
at import time and exposes `POST /predict/adr`, `POST /predict/occupancy`,
`POST /predict/rating`, and `GET /health`. `api/src/ml/mlClient.ts` is the
Node-side HTTP client; `api/src/simulation/index.ts`'s `simulateHotel()`
calls it for ADR, occupancy, and rating — **each with a 5-second timeout,
falling back to the deterministic formula on any failure** (service down,
timeout, non-2xx, malformed response). Revenue and CapEx/ROI/Payback are
never called through ML — see "CapEx/ROI" below for why, and
`computeOpportunityGrid` stays fully deterministic on purpose (100+ cells
per heatmap request; calling the ML service that many times per request
would be slow).

Verified, not assumed: killed the ML service mid-session and confirmed
`POST /simulations` still returns valid results (deterministic values,
clearly different from the ML ones) instead of erroring, and `GET /health`
correctly reports `"ml": "error"`.

### The mapping problem

A Sandbox `HotelConfig` (hotelType, rooms, stars, modernity, amenities,
location) doesn't look like the rows either model trained on — an Airbnb
listing has bedrooms/beds/baths/guests for one rentable unit, not a whole
hotel; a real review has genuine per-aspect sentiment, not a hypothetical
hotel's assumed guest reaction. Every gap is resolved in
`ml/service/mapping.py`, documented there in full as "KNOWN
SIMPLIFICATIONS" — summarized here:

1. **Rating proxy, with a real calibration bug caught before shipping.**
   The ADR model wants `rating_overall`/`rating_location`/
   `rating_cleanliness` as inputs, but a new hotel has no real guest rating
   — and feeding the *separately predicted* rating in would recreate the
   circular ADR↔Rating dependency CLAUDE.md rules out. Decision (with you):
   substitute the hotel's own `stars` (1-5). First attempt passed `stars`
   through raw and produced badly wrong occupancy — verified: `stars=4`
   raw gave occupancy 3.45%, while the training data's *median* rating
   value on the same hotel gave 18.83%. Cause: Airbnb ratings are heavily
   skewed toward 4.7-5.0 in practice (25th percentile is 4.74), so a literal
   "4" reads to the model as an unusually bad listing, not a solid 4-star
   hotel. Fixed with `STARS_TO_RATING_PROXY`, a table rescaling 1-5 onto the
   training distribution's realistic range (`{1: 3.5, 2: 4.0, 3: 4.5, 4:
   4.8, 5: 4.95}`) — re-verified monotonic-ish occupancy (8.3%→25.4% across
   stars 1-5) and a sane ADR range ($120-180) after the fix.
2. **Per-unit fields.** bedrooms/beds/baths/guests assumed from
   `ROOM_PROFILE_BY_HOTEL_TYPE` (one "typical room" per hotelType) — the
   Sandbox has no reason to collect per-room bed counts for a 150-room
   hotel.
3. **`room_type` is always `"hotel_room"`** — the correct category, but
   thin: 252 of 71,023 clean rows (0.35%), only 15 in Canada. Predictions
   extrapolate from a small, non-Canadian-heavy slice.

   **A second real bug caught here, from user testing:** the first version
   paired the correct `room_type` with `listing_type` values like "Entire
   villa"/"Entire home" — WHOLE-PROPERTY rental categories (a family
   renting an entire multi-bedroom villa), not "one hotel room." Verified:
   "Entire villa" listings have a real median of 4 bedrooms / 8 guests,
   nothing like a hotel room, and the resulting 5-star luxury/resort ADR
   ($286 USD) was implausibly low. Fixed by mapping to the `listing_type`
   values that actually co-occur with `room_type="hotel_room"` ("Room in
   hotel", "Room in boutique hotel", "Room in resort", ...) and pairing
   each with *its own* real median bedrooms/beds/baths/guests. Even after
   that fix, luxury/resort still landed ~40% below the real segment median
   ($446, n=11) — traced to the model regularizing toward the overall mean
   because it has so few real "Room in resort" examples, compounded by
   those 11 rows mostly being in warm-climate destinations, not a
   Toronto-like location. Closed the gap with a documented calibration
   multiplier (`SEGMENT_CALIBRATION_MULTIPLIER`, 1.5x for luxury/resort —
   the verified ratio between the real segment median and the model's
   typical raw output for that category), not by inventing a number.
   Re-verified end to end: 5-star luxury/resort now predicts ~$440 USD
   (~$603 CAD), a realistic luxury-hotel price, with a clean monotonic
   ladder across all six hotel types.
4. **`superhost` is always `False`** — no hotel equivalent exists.
5. **Rating model aspect sentiments** have no real signal for a
   never-reviewed hotel. Present amenities get a flat assumed sentiment
   (0.6); `cleanliness_*` derives from `modernity`/`renovationDelta`;
   `location_*`/`transportation_*` derive from `location.scores`.
   `rooms_*`, `staff_*`, `noise_*` have **no Sandbox-derived signal at all**
   and stay neutral — see "What to look for" below.

### What to look for (per your ask — real leads, not guesses)

- **Real hotel booking data with genuine ADR**, not Airbnb: Kaggle's
  "Hotel Booking Demand" dataset (`hotel_bookings.csv`) has real
  reservations from two actual hotels (a resort + a city hotel, Portugal),
  with real ADR. European, not Canadian, and it's booking/cancellation
  data rather than cost data, so it wouldn't close the CapEx gap below —
  but it would give per-unit fields (nights, room type) that are genuinely
  hotel-shaped instead of Airbnb-shaped, improving simplifications #2/#3.
- **Staffing/operations signal**: nothing public we're aware of ties guest
  reviews to specific staffing levels or operational changes — this is
  likely proprietary hotel-chain internal data (RevPAR management systems,
  STR benchmarking with operational detail) if it exists in a usable form
  at all.
- **Canadian-specific hotel data**: Destination Canada and provincial
  tourism boards (e.g. Destination Ontario) sometimes publish aggregate
  regional ADR/occupancy stats — worth checking if you want Canada-specific
  calibration beyond what `state`-level Airbnb data already provides.

## CapEx / ROI / Payback — flagged, not solved

No ML model, and (as far as we've found) no accessible public dataset —
real construction/renovation cost data is normally proprietary industry
data (STR, CBRE, HVS hospitality cost reports), not something on Kaggle.
**Decision: stays permanently deterministic** (the `packages/config` cost
tables), but flagged here as an open item rather than closed off — if you
get access to real hotel construction/renovation cost data later (an
industry report, a partnership, anything with actual $/key figures), this
is the piece to revisit. Nothing about the current architecture blocks
adding it later; `investmentFormula` in `api/src/simulation/capex.ts` is
already an isolated, swappable function.

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
├── service/                         FastAPI wrapper — Node calls this, not
│   │                                 the training scripts directly
│   ├── main.py                      loads all 6 .pkl once; /predict/adr,
│   │                                 /predict/occupancy, /predict/rating, /health
│   └── mapping.py                   HotelConfig -> ML features; every
│                                     approximation documented as "KNOWN
│                                     SIMPLIFICATIONS" at the top of the file
├── models/                          generated by training, gitignored
└── README.md
``` 
