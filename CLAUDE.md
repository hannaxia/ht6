# Innsight

## Project summary

Innsight is an AI-powered hospitality digital twin / hotel investment simulator (ht6 2026
hackathon project). It answers "where should I build a hotel, what kind, and what decisions
maximize profitability?" — not "where can I book a hotel?"

Two core user flows:

- **Market Discovery**: an interactive city map showing existing hotels (price, rating,
  amenities, competition) plus an **opportunity heatmap** — the city is divided into a grid,
  each cell simulates a hypothetical hotel, and gets an Opportunity Score (0-100) for whether
  building there makes sense.
- **Hotel Sandbox**: user configures a hotel (type, rooms, star rating, modernity, target
  audience, amenity toggles) or edits an existing one, and the simulation engine immediately
  recomputes predicted ADR, occupancy, rating, annual revenue, ROI, and payback period.

An **AI Consultant** (Gemini) lets users drive both flows in natural language (e.g. "make this
hotel compete with Marriott") — it interprets intent, calls simulation tools, applies changes,
and explains tradeoffs in hospitality-consultant language.

All predicted figures (ADR, occupancy, rating, revenue, ROI, opportunity score) are
**simulations/estimates** — never presented as real financial data.

## Architecture

- **Frontend**: Next.js + React + TypeScript + Tailwind CSS. Map/visualization: Mapbox GL JS
  + deck.gl for the heatmap layer and hotel markers.
- **Backend**: separate Node.js + Express service — API routes, the simulation engine, AI tool
  implementations, and DB access. Not implemented as Next.js API routes.
- **Database**: MongoDB, three collections:
  - `Hotels` — name, location, coordinates, rating, price, amenities, stars, supplier, images.
  - `Locations` — coordinates, tourism_score, business_score, transit_score,
    population_density, hotel_density.
  - `Simulations` — user, starting_hotel, changes, before_metrics, after_metrics, timestamp.
- **External data**: Stay22 API is the sole real-world market data source (hotel inventory,
  coordinates, prices, ratings, amenities, booking links). It does **not** provide revenue,
  occupancy, profit, or cost data — those are always our own predictions.
- **AI**: Gemini API as a single backend orchestrator/tool-caller — not four separate agent
  services. Tools: `simulateHotelChange`, `calculateRevenue`, `analyzeLocation`,
  `compareCompetitors`, `generateInvestmentReport`.

## Simulation engine — domain model

This is the corrected source of truth for the prediction formulas (the original hackathon
vision doc had gaps — circular dependencies, unbounded amenity stacking, no cost model, an
undefined "Risk" term — resolved here).

**Computation order** (avoids circular dependencies): Location/Quality scores → ADR →
Occupancy → Revenue → Rating → CapEx/ROI → Opportunity Score.

- ADR's Quality Multiplier must derive only from user-set inputs (stars, renovation/modernity)
  — **never** from predicted rating, since Rating is computed after ADR and depends on it.

### Amenity impact (shared mechanism)

Every amenity has a context-dependent percentage-point impact that varies by hotel type /
location type (e.g. pool: +15pp in a resort context, +2pp in a business district), drawn from
a lookup table keyed on `(amenity, hotel_type/location_type)`. Sum all active amenities'
percentage points, cap the total (e.g. ±25pp), then apply as a **single** multiplier — do not
multiply independent per-amenity multipliers together (that compounds unrealistically with
several amenities enabled). The same lookup/aggregation feeds both the ADR amenity multiplier
and the Rating amenity satisfaction term, so an amenity contributes consistently to both price
and satisfaction in a given context.

### Competition (shared mechanism)

Segment-weighted, not raw density — nearby hotels count more toward competition pressure the
closer their star-level/type/price-band is to the subject hotel. A luxury hotel is barely
affected by a nearby budget motel. Feeds both Occupancy and Opportunity Score.

### ADR

```
ADR = Base City Price
    × Location Multiplier (transit / airport / tourism / business-district scores)
    × Quality Multiplier (stars, renovation — not predicted rating)
    × (1 + capped amenity %)
```

### Occupancy

```
Occupancy = clamp[0%, 100%](
    Base Demand (city-average baseline)
    + Location Demand
    + Hotel Quality
    + Amenity Match
    − Segment-Weighted Competition
)
```

### Revenue

```
Revenue = Rooms × ADR × Occupancy × 365
```

Standard RevPAR annualization. This is room revenue only — no F&B/spa/event revenue
(explicit simplification).

### Rating

```
Rating = clamp[1.0, 5.0](
    Base Rating
    + Amenity Satisfaction (context-dependent, same lookup as ADR)
    + Location Satisfaction
    − Price Expectation Penalty (derived from ADR vs. segment norm)
)
```

### CapEx / ROI / Payback

Not present in the original vision doc's formulas, but required by its own demo example
("Investment: $2.4M", "Payback: 3.8 years") and by the core product question of what changes
cost and when they break even.

```
Investment = (Cost per Room × Rooms, by hotel type/star level)
           + Σ(per-amenity install/construction cost)
           + (Renovation Cost per Room × renovation delta, if upgrading an existing hotel)

Annual Operating Profit ≈ Revenue × Operating Margin   (assumed GOP-style constant, ~30-35%)

ROI = Annual Operating Profit / Investment
Payback Period (years) = Investment / Annual Operating Profit
```

This is an explicit simplification, not a full P&L. Cost tables (cost-per-room by type/star,
per-amenity cost, renovation cost/room) live alongside the amenity-impact lookup table as
config data, not hardcoded in formula code.

### Opportunity Score (heatmap)

```
Opportunity Score = weighted sum of, each normalized to 0-100 across the city grid:
    Revenue Potential
    + Demand
    − Segment-Weighted Competition
    − Risk
```

Components must be normalized (e.g. min-max across the grid) before summing — raw units differ
(dollars vs. scores). Risk should be defined from concrete inputs (market/price volatility in
the area, construction cost relative to city average, demand concentration/seasonality) rather
than left undefined.

## Conventions

- Do not fabricate mock/sample hotel data as a stand-in for Stay22. Build the real API client
  against env var placeholders; use empty/loading/"not configured" states until real keys are
  supplied.
- Keep the AI layer to one backend orchestrator calling Gemini with tool schemas — do not
  build four separate agent services.
- Predictions are always framed as estimates/simulations, never as real financial data.
- Amenity impact, competition weighting, and cost tables are config-driven lookup data, not
  inline constants, so they can be tuned without touching formula code.

## Environment variables

Placeholders only — real values to be supplied later:

```
STAY22_API_KEY=       # Stay22 market data (hotel inventory, prices, ratings, amenities)
GEMINI_API_KEY=       # Gemini API, AI consultant orchestration/tool-calling
MAPBOX_ACCESS_TOKEN=  # Mapbox GL JS map rendering
MONGODB_URI=          # MongoDB connection string (Hotels, Locations, Simulations collections)
```

## Status

Scaffolded as a pnpm workspace monorepo: `web/` (Next.js app), `api/` (Express service:
simulation engine, Stay22 client, Gemini orchestrator, MongoDB models), and
`packages/config/` (tunable lookup tables). A single root `.env` feeds both apps — no
per-package env files. The stack boots in degraded mode with an empty `.env`; see
`README.md` for the external setup checklist (Stay22, Gemini, Mapbox, MongoDB Atlas) and
remaining manual work (seed Toronto `Locations`, confirm Stay22 wire format, tune config
tables).
