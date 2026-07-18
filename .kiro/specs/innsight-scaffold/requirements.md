# Requirements Document

## Introduction

Innsight is an AI-powered hospitality digital twin and hotel investment simulator. This spec
covers the initial scaffolding of the project: a runnable, well-structured skeleton that
implements the domain model, service boundaries, and integrations defined in `CLAUDE.md`,
but leaves visual polish and unimplemented features to later specs.

The scaffold produces:

- A pnpm workspace monorepo containing a Next.js frontend, an Express backend, and a shared
  configuration package for lookup tables.
- A backend service exposing HTTP routes for market discovery, hotel sandbox simulation,
  and the AI consultant, plus a simulation engine that implements the ADR, Occupancy,
  Revenue, Rating, CapEx/ROI, and Opportunity Score formulas in the computation order
  specified in `CLAUDE.md`.
- MongoDB models for `Hotels`, `Locations`, and `Simulations`.
- A Stay22 API client (the sole source of real-world hotel data — no fabricated mocks).
- A Gemini-backed AI consultant orchestrator with the five tools listed in `CLAUDE.md`.
- A frontend skeleton with two flows (Market Discovery and Hotel Sandbox) and an AI
  Consultant panel, built with plain, swappable React + Tailwind components (no shadcn/ui,
  no ChatGPT-style aesthetic).
- Validation at every external boundary (Stay22 responses, Gemini responses) and at every
  simulation engine output (bounds checks on ADR, Occupancy, Rating, Revenue, ROI).
- Structured logging on the backend (`pino`) and gated debug logging on the frontend.
- Setup documentation (README plus per-integration notes) that walks the team through
  obtaining and installing the four external credentials (Stay22, Gemini, Mapbox, MongoDB
  Atlas) so the scaffold can be run against real services later.

All predicted metrics produced by the scaffold SHALL be labeled as estimates or simulations
in every user-facing surface. No fabricated hotel data SHALL be introduced as a stand-in
for Stay22.

### Scaffolding assumptions (open to change)

- **Monorepo layout**: `frontend/`, `backend/`, and `packages/config/` at the repo root,
  managed as pnpm workspaces.
- **Language / runtime**: TypeScript in strict mode across all packages. Node.js 20 or newer.
- **Validation library**: `zod` on both frontend and backend.
- **Frontend state**: React hooks and Context. No Redux, no Zustand, so the UI stays easy to
  rip out and replace.
- **AuthN**: none for the MVP scaffold. `Simulations.user` receives a client-generated
  anonymous session id.
- **Testing framework**: Vitest is configured for both packages, but authoring the tests
  themselves is out of scope for this spec.
- **Package manager**: pnpm.

## Glossary

- **Innsight**: The overall product; an AI-powered hospitality investment simulator.
- **Frontend**: The Next.js application in `frontend/` that renders Market Discovery, Hotel
  Sandbox, and the AI Consultant panel.
- **Backend**: The Express service in `backend/` that owns the simulation engine, database
  access, the AI orchestrator, and the Stay22 client.
- **Config_Package**: The `packages/config/` workspace holding tunable lookup tables
  (amenity impact, competition weighting, cost tables) as data files.
- **Simulation_Engine**: The backend module that computes ADR, Occupancy, Revenue, Rating,
  CapEx, ROI, Payback, and Opportunity Score from user-supplied hotel configuration.
- **AI_Consultant**: The backend Gemini orchestrator that interprets user prompts and calls
  simulation tools.
- **Stay22_Client**: The backend client that fetches real hotel inventory from Stay22 and
  validates every response before use.
- **ADR**: Average Daily Rate for a hotel, in USD.
- **Occupancy**: The predicted share of rooms occupied over a year, expressed as a
  percentage from 0 to 100.
- **Rating**: The predicted guest satisfaction score for a hotel, on a scale from 1.0 to 5.0.
- **Revenue**: Predicted annual room revenue for a hotel, in USD. Excludes F&B, spa, and
  events.
- **Investment**: Predicted one-time capital cost to build or renovate a hotel to the
  configured spec, in USD.
- **Operating_Margin**: The assumed constant fraction of revenue retained as annual
  operating profit (default 0.32, tunable in config).
- **ROI**: Annual operating profit divided by investment.
- **Payback_Period**: Investment divided by annual operating profit, expressed in years.
- **Opportunity_Score**: Normalized 0-100 score for a grid cell indicating how attractive
  it is to build a hotel there.
- **Market_Discovery**: The frontend flow showing a map with existing hotels and the
  opportunity heatmap.
- **Hotel_Sandbox**: The frontend flow for configuring or editing a hotel and viewing the
  simulated metrics.
- **Amenity_Impact_Table**: Config lookup keyed by `(amenity, hotel_type_or_location_type)`
  that returns a percentage-point impact.
- **Cost_Table**: Config lookup returning cost-per-room by hotel type and star level,
  per-amenity install cost, and renovation cost per room.
- **Competition_Weighting**: The rule that weights nearby hotels by proximity in star
  level, type, and price band when computing competition pressure.
- **Estimate_Framing**: The convention that every predicted figure is labeled as an
  estimate or simulation in the UI.

## Requirements

### Requirement 1: Monorepo project structure

**User Story:** As a hackathon developer, I want a single repository that cleanly separates
the frontend, backend, and shared configuration, so that I can iterate on each layer
without dependency confusion.

#### Acceptance Criteria

1. THE Innsight repository SHALL contain three pnpm workspace packages: `frontend`,
   `backend`, and `packages/config`.
2. THE `frontend` package SHALL be a Next.js 14 or newer application configured for
   TypeScript strict mode and Tailwind CSS.
3. THE `backend` package SHALL be a Node.js Express service configured for TypeScript
   strict mode.
4. THE `packages/config` package SHALL export the amenity impact table, competition
   weighting parameters, and cost tables as typed data modules consumable by the backend.
5. THE root `package.json` SHALL define workspace scripts to install, build, lint, and
   type-check every workspace with a single command each.
6. IF a workspace fails type-checking, THEN THE root type-check script SHALL exit with a
   non-zero status and print the failing workspace name.

### Requirement 2: Environment configuration and setup documentation

**User Story:** As a hackathon developer, I want the scaffold to boot with placeholder
credentials and a clear checklist for obtaining real ones, so that I can start integrating
external services without guessing what each key does.

#### Acceptance Criteria

1. THE Innsight repository SHALL contain a root `README.md` that documents monorepo layout,
   install commands, dev commands, and a per-integration setup checklist for Stay22,
   Gemini, Mapbox, and MongoDB Atlas.
2. THE Innsight repository SHALL contain a root `.env.example` file with placeholder
   entries for `STAY22_API_KEY`, `GEMINI_API_KEY`, `MAPBOX_ACCESS_TOKEN`, and `MONGODB_URI`.
3. THE `frontend` package SHALL read `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` and
   `NEXT_PUBLIC_BACKEND_URL` from its own `.env.local` and SHALL document both in
   `frontend/README.md`.
4. THE `backend` package SHALL read `STAY22_API_KEY`, `GEMINI_API_KEY`, and `MONGODB_URI`
   from its own `.env` and SHALL document each in `backend/README.md`.
5. WHERE any required environment variable is missing at backend startup, THE Backend
   SHALL log a structured warning naming the missing variable and SHALL continue starting
   in a degraded mode instead of crashing.
6. THE setup checklist for Stay22 SHALL describe how to request API access, where to store
   the returned key, and which endpoints the scaffold consumes.
7. THE setup checklist for Gemini SHALL describe how to create an API key in Google AI
   Studio and which model identifier the scaffold expects.
8. THE setup checklist for Mapbox SHALL describe how to create an access token, which
   scopes the scaffold requires, and how to restrict the token to development domains.
9. THE setup checklist for MongoDB Atlas SHALL describe how to create a free-tier cluster,
   create a database user, whitelist the developer IP, and copy the connection string into
   `MONGODB_URI`.

### Requirement 3: Backend service skeleton and structured logging

**User Story:** As a hackathon developer, I want the backend to start cleanly, expose a
health check, and produce structured logs I can trace during development, so that I can
observe behavior without adding ad-hoc prints.

#### Acceptance Criteria

1. THE Backend SHALL start an Express server on the port defined by the `PORT`
   environment variable, defaulting to 4000 when `PORT` is unset.
2. THE Backend SHALL expose a `GET /health` route returning JSON with fields `status`,
   `uptimeSeconds`, and `dependencies`, where `dependencies` reports the readiness of
   MongoDB, Stay22, and Gemini as strings from the set `{"ready", "not_configured",
   "error"}`.
3. THE Backend SHALL initialize a `pino` logger with a `service` field set to `"innsight-backend"`
   and log level controlled by the `LOG_LEVEL` environment variable, defaulting to `"info"`.
4. WHEN an HTTP request completes, THE Backend SHALL log a structured entry containing
   method, path, status code, and duration in milliseconds, regardless of whether the
   handler threw an unhandled error.
5. IF an unhandled error is thrown from a route handler, THEN THE Backend SHALL log the
   error with a stack trace at level `error` as a separate log entry from the request
   completion entry and SHALL return HTTP 500 with a JSON body containing a stable
   `errorCode` and a human-readable `message` that does not leak internal stack details.
6. THE Backend SHALL enable CORS for the origin defined by `FRONTEND_ORIGIN`, defaulting
   to `http://localhost:3000` when unset.

### Requirement 4: MongoDB models and connection

**User Story:** As a hackathon developer, I want typed MongoDB models for the three
collections defined in `CLAUDE.md`, so that reads and writes stay consistent as the app
grows.

#### Acceptance Criteria

1. THE Backend SHALL connect to MongoDB using the `MONGODB_URI` environment variable and
   SHALL log a structured entry on connection success and on connection failure.
2. THE Backend SHALL define a `Hotels` collection schema with fields `name`, `supplier`,
   `stayId`, `coordinates` (GeoJSON Point), `city`, `country`, `stars`, `rating`, `price`,
   `amenities` (string array), `images` (string array), `createdAt`, and `updatedAt`.
3. THE Backend SHALL define a `Locations` collection schema with fields `coordinates`
   (GeoJSON Point), `city`, `country`, `tourism_score`, `business_score`, `transit_score`,
   `population_density`, `hotel_density`, `createdAt`, and `updatedAt`.
4. THE Backend SHALL define a `Simulations` collection schema with fields `sessionId`,
   `startingHotelId` (nullable), `changes` (object), `beforeMetrics` (object),
   `afterMetrics` (object), `createdAt`.
5. THE Backend SHALL create a 2dsphere index on `Hotels.coordinates` and on
   `Locations.coordinates`.
6. IF `MONGODB_URI` is missing at Backend startup, THEN THE Backend SHALL mark the
   MongoDB dependency as `"not_configured"` in `GET /health` immediately without
   attempting a connection.
7. IF `MONGODB_URI` is present but the connection attempt fails, THEN THE Backend SHALL
   mark the MongoDB dependency as `"error"` in `GET /health`.
8. WHILE the MongoDB dependency status is `"not_configured"` or `"error"`, THE Backend
   SHALL cause any route that requires the database to return HTTP 503 with
   `errorCode = "database_unavailable"`.

### Requirement 5: Stay22 API client with response validation

**User Story:** As a hackathon developer, I want a single validated Stay22 client so that
no unvalidated external data ever reaches the simulation engine or the frontend.

#### Acceptance Criteria

1. THE Stay22_Client SHALL expose a typed method to search hotels by city, bounding box,
   or coordinate radius, returning a validated array of hotel records.
2. THE Stay22_Client SHALL send the `STAY22_API_KEY` in the authorization header of every
   outbound request.
3. WHEN Stay22 returns a response, THE Stay22_Client SHALL validate the payload against a
   zod schema derived from Stay22's documented response shape before returning it.
4. IF individual records within a Stay22 response fail schema validation, THEN THE
   Stay22_Client SHALL log the field-level validation errors at level `warn`, discard the
   malformed records, and return only the records that validated successfully.
5. IF the entire Stay22 response envelope fails schema validation, THEN THE Stay22_Client
   SHALL log the structural validation errors at level `error` and return an empty array
   without throwing.
6. IF `STAY22_API_KEY` is unset, THEN THE Stay22_Client SHALL log a structured warning
   naming the missing variable, return an empty array, and mark the Stay22 dependency as
   `"not_configured"` in `GET /health`.
7. THE Stay22_Client SHALL enforce a request timeout of 10 seconds and SHALL log a
   structured `warn` entry when a request times out.
8. THE Backend SHALL NOT generate synthetic hotel data as a substitute for Stay22 in any
   code path.

### Requirement 6: Config-driven amenity impact, competition weighting, and cost tables

**User Story:** As a hackathon developer, I want the tunable numbers behind the simulation
engine to live in data files that ship as their own package, so that I can adjust market
assumptions without touching formula code.

#### Acceptance Criteria

1. THE Config_Package SHALL export an `amenityImpactTable` keyed by
   `(amenity, hotel_type_or_location_type)` returning a percentage-point impact value.
2. THE Config_Package SHALL export a `competitionWeighting` module defining the star-level,
   hotel-type, and price-band proximity weights used when scoring competitor influence.
3. THE Config_Package SHALL export a `costTable` module defining cost per room by hotel
   type and star level, per-amenity install cost, and renovation cost per room.
4. THE Config_Package SHALL export an `amenityImpactCap` value defining the ±25 percentage
   point cap on aggregated amenity impact.
5. THE Config_Package SHALL export an `operatingMargin` value used in ROI and Payback
   calculations, defaulting to 0.32.
6. THE Simulation_Engine SHALL read every tunable constant from Config_Package and SHALL
   NOT inline any of these values in formula code.
7. WHEN Config_Package is loaded at Backend startup, THE Backend SHALL validate each
   exported table against a zod schema and log a structured `error` entry if validation
   fails.

### Requirement 7: Simulation engine — computation order and shared mechanisms

**User Story:** As a hackathon developer, I want the simulation engine to compute metrics
in the corrected order from `CLAUDE.md` and share amenity and competition logic across
formulas, so that predictions stay internally consistent.

#### Acceptance Criteria

1. THE Simulation_Engine SHALL compute metrics in the order Location/Quality scores → ADR
   → Occupancy → Revenue → Rating → CapEx → ROI → Payback → Opportunity Score.
2. THE Simulation_Engine SHALL NOT use the predicted Rating as an input to ADR's Quality
   Multiplier.
3. WHEN the Simulation_Engine computes amenity impact for any formula, THE
   Simulation_Engine SHALL look up each active amenity in Amenity_Impact_Table using the
   current hotel or location context, sum the percentage-point values, and clamp the sum
   to the range defined by `amenityImpactCap`.
4. THE Simulation_Engine SHALL apply the aggregated amenity impact as a single multiplier
   in ADR and as a single satisfaction term in Rating, using the same underlying
   aggregation.
5. WHEN the Simulation_Engine computes competition for any formula, THE Simulation_Engine
   SHALL weight nearby hotels by proximity in star level, hotel type, and price band as
   defined by Competition_Weighting.
6. THE Simulation_Engine SHALL expose a single entrypoint `simulateHotel(input)` that
   returns an object containing `adr`, `occupancy`, `revenue`, `rating`, `investment`,
   `annualOperatingProfit`, `roi`, `paybackYears`, and the intermediate location and
   quality scores.

### Requirement 8: Simulation engine — ADR calculation

**User Story:** As a user configuring a hotel, I want ADR to reflect base city price,
location advantages, quality choices, and amenities in a bounded way, so that predicted
nightly rates stay realistic.

#### Acceptance Criteria

1. THE Simulation_Engine SHALL compute ADR as `basePrice × locationMultiplier ×
   qualityMultiplier × (1 + cappedAmenityPercent)`.
2. THE Simulation_Engine SHALL derive `qualityMultiplier` from user-set stars and
   renovation or modernity level only, and SHALL NOT reference the predicted Rating.
3. THE Simulation_Engine SHALL derive `locationMultiplier` from the transit, airport,
   tourism, and business-district scores associated with the hotel's coordinates.
4. IF the computed ADR is not a finite number greater than zero, THEN THE
   Simulation_Engine SHALL log a structured `error` entry naming the offending input and
   SHALL return an error to the caller instead of a metrics object.

### Requirement 9: Simulation engine — Occupancy calculation

**User Story:** As a user configuring a hotel, I want predicted occupancy to combine base
demand, location, hotel quality, amenity match, and competition, so that it responds to
the meaningful levers.

#### Acceptance Criteria

1. THE Simulation_Engine SHALL compute Occupancy as `clamp(0, 100, baseDemand +
   locationDemand + hotelQuality + amenityMatch − segmentWeightedCompetition)`.
2. THE Simulation_Engine SHALL express Occupancy as a percentage in the range 0 through
   100 inclusive.
3. IF the pre-clamp Occupancy value is not a finite number, THEN THE Simulation_Engine
   SHALL log a structured `error` entry and SHALL return an error to the caller.

### Requirement 10: Simulation engine — Revenue calculation

**User Story:** As a user configuring a hotel, I want predicted revenue to follow the
standard RevPAR annualization, so that it is easy to reason about and validate.

#### Acceptance Criteria

1. THE Simulation_Engine SHALL compute Revenue as `rooms × adr × (occupancy / 100) × 365`.
2. THE Simulation_Engine SHALL return Revenue as a non-negative number denominated in USD.
3. IF `rooms` is not a non-negative integer, THEN THE Simulation_Engine SHALL log a
   structured `error` entry and SHALL return an error to the caller.
4. WHEN `rooms` equals zero, THE Simulation_Engine SHALL return Revenue as zero without
   raising an error.

### Requirement 11: Simulation engine — Rating calculation

**User Story:** As a user configuring a hotel, I want predicted guest rating to reflect
amenity satisfaction, location satisfaction, and price expectations relative to segment,
so that quality tradeoffs are visible.

#### Acceptance Criteria

1. THE Simulation_Engine SHALL compute Rating as `clamp(1.0, 5.0, baseRating +
   amenitySatisfaction + locationSatisfaction − priceExpectationPenalty)`.
2. THE Simulation_Engine SHALL derive `priceExpectationPenalty` from the ratio of ADR to
   the segment norm for the hotel's star level and type.
3. THE Simulation_Engine SHALL derive `amenitySatisfaction` from the same aggregated,
   capped amenity impact used in ADR.
4. THE Simulation_Engine SHALL return Rating as a number in the range 1.0 through 5.0
   inclusive.

### Requirement 12: Simulation engine — CapEx, ROI, and Payback

**User Story:** As a user editing a hotel, I want a rough estimate of what my changes cost
and when they break even, so that I can weigh investments.

#### Acceptance Criteria

1. THE Simulation_Engine SHALL compute Investment as
   `(costPerRoom × rooms) + Σ(perAmenityInstallCost) + (renovationCostPerRoom ×
   renovationDelta)`, drawing every cost value from Cost_Table.
2. THE Simulation_Engine SHALL compute Annual Operating Profit as `revenue ×
   operatingMargin`, drawing `operatingMargin` from Config_Package.
3. THE Simulation_Engine SHALL compute ROI as `annualOperatingProfit / investment`.
4. THE Simulation_Engine SHALL compute Payback Period as `investment /
   annualOperatingProfit`, expressed in years.
5. IF Investment is zero or negative, THEN THE Simulation_Engine SHALL log a structured
   `error` entry and SHALL return an error to the caller instead of dividing by zero.
6. WHEN Annual Operating Profit is zero, THE Simulation_Engine SHALL return Payback
   Period as JavaScript `Number.POSITIVE_INFINITY` and ROI as zero, and SHALL log a
   structured `warn` entry naming the offending input.
7. THE Simulation_Engine SHALL return Investment as a non-negative number denominated in
   USD and ROI as a non-negative number.

### Requirement 13: Simulation engine — Opportunity Score and heatmap grid

**User Story:** As a user exploring a city, I want an opportunity heatmap that scores each
grid cell on a normalized scale, so that I can compare locations at a glance.

#### Acceptance Criteria

1. THE Simulation_Engine SHALL expose a function `computeOpportunityGrid(city, gridSize)`
   that returns an array of grid cells, each with `coordinates`, component scores, and a
   final `opportunityScore`.
2. THE Simulation_Engine SHALL compute each cell's `revenuePotential`, `demand`,
   `segmentWeightedCompetition`, and `risk` component in the raw units of each formula
   before normalization.
3. THE Simulation_Engine SHALL normalize each component to the range 0 through 100 across
   the grid using min-max normalization before combining them.
4. THE Simulation_Engine SHALL compute `opportunityScore` as a weighted sum of normalized
   `revenuePotential`, `demand`, `−segmentWeightedCompetition`, and `−risk`, and SHALL
   clamp the result to the range 0 through 100 inclusive.
5. THE Simulation_Engine SHALL derive `risk` from market or price volatility in the area,
   construction cost relative to the city average, and demand concentration or
   seasonality, drawing weights from Config_Package.
6. IF the grid is empty or every component is constant, THEN THE Simulation_Engine SHALL
   return every cell's `opportunityScore` as 50 and SHALL log a structured `warn` entry.

### Requirement 14: Simulation output validation

**User Story:** As a hackathon developer, I want every simulation output validated against
domain bounds before it leaves the backend, so that malformed predictions never reach the
UI.

#### Acceptance Criteria

1. WHEN the Simulation_Engine returns a metrics object, THE Backend SHALL validate the
   object against a zod schema that enforces `adr > 0`, `0 ≤ occupancy ≤ 100`,
   `1.0 ≤ rating ≤ 5.0`, `revenue ≥ 0`, `investment ≥ 0`, `annualOperatingProfit ≥ 0`,
   `roi ≥ 0`, and `paybackYears > 0` or `paybackYears === Number.POSITIVE_INFINITY`.
2. IF simulation output validation fails, THEN THE Backend SHALL log the failure with the
   full input and the validation errors at level `error` and SHALL return HTTP 500 with
   `errorCode = "simulation_output_invalid"`.
3. WHEN `computeOpportunityGrid` returns, THE Backend SHALL validate every cell's
   `opportunityScore` is in the range 0 through 100 inclusive and SHALL discard any cell
   that fails, logging the discarded cell at level `warn`.

### Requirement 15: AI Consultant orchestrator with Gemini and tool wiring

**User Story:** As a user, I want to drive the simulator with natural-language prompts and
receive answers grounded in the same simulation tools the UI uses, so that the AI's
recommendations stay consistent with the numbers I see.

#### Acceptance Criteria

1. THE AI_Consultant SHALL be implemented as a single backend orchestrator that calls the
   Gemini API using `GEMINI_API_KEY`.
2. THE AI_Consultant SHALL register the five tools `simulateHotelChange`,
   `calculateRevenue`, `analyzeLocation`, `compareCompetitors`, and
   `generateInvestmentReport`, each backed by a typed handler that calls into
   Simulation_Engine, Stay22_Client, and MongoDB models rather than duplicating logic.
3. WHEN Gemini returns a tool call, THE AI_Consultant SHALL validate the tool arguments
   against a zod schema for that tool before invoking the handler.
4. IF tool argument validation fails, THEN THE AI_Consultant SHALL return a structured
   tool error to Gemini instead of invoking the handler and SHALL log the validation
   failure at level `warn`.
5. WHEN Gemini returns a final response, THE AI_Consultant SHALL validate the response
   against a zod schema before returning it to the frontend.
6. IF `GEMINI_API_KEY` is unset, THEN THE AI_Consultant SHALL mark the Gemini dependency
   as `"not_configured"` in `GET /health` and SHALL cause `POST /ai/consult` to return
   HTTP 503 with `errorCode = "ai_not_configured"`.
7. THE AI_Consultant SHALL enforce a per-request budget of at most 6 tool call rounds and
   SHALL log a structured `warn` entry when a request hits the budget.

### Requirement 16: Backend HTTP API surface

**User Story:** As a frontend developer, I want a small, predictable set of HTTP routes
covering the two flows and the AI consultant, so that the frontend has one contract to
integrate against.

#### Acceptance Criteria

1. THE Backend SHALL expose `GET /hotels` accepting query parameters `city`, `bbox`, and
   `radiusKm` and SHALL return validated Stay22 hotel records.
2. THE Backend SHALL expose `GET /locations/opportunity-grid` accepting `city` and
   `gridSize` and SHALL return the opportunity grid from Simulation_Engine.
3. THE Backend SHALL expose `POST /simulations` accepting a hotel configuration payload
   and SHALL return the simulated metrics from Simulation_Engine, persisting a
   `Simulations` document with `beforeMetrics` and `afterMetrics`.
4. THE Backend SHALL expose `POST /ai/consult` accepting `{ sessionId, prompt, context }`
   and SHALL return the AI_Consultant's validated response including any hotel or
   simulation deltas the AI applied.
5. WHEN any route receives a request body that fails zod validation, THE Backend SHALL
   respond with HTTP 400 and `errorCode = "invalid_request"`, including the field-level
   validation errors in the response body.

### Requirement 17: Frontend application skeleton

**User Story:** As a hackathon developer, I want a Next.js app skeleton with plain,
swappable components and Tailwind styling, so that the UI can be redesigned later without
being locked into a design system.

#### Acceptance Criteria

1. THE Frontend SHALL use Next.js App Router with routes for `/` (landing), `/discover`
   (Market Discovery), and `/sandbox` (Hotel Sandbox).
2. THE Frontend SHALL NOT include shadcn/ui or any comparable opinionated component
   library, and every UI element SHALL be built from plain HTML elements styled with
   Tailwind utility classes.
3. THE Frontend SHALL structure components under `frontend/components/` grouped by
   feature (`discover/`, `sandbox/`, `consultant/`, `shared/`).
4. THE Frontend SHALL avoid visual patterns strongly associated with generic AI chat UIs,
   specifically full-screen chat layouts, animated typing indicators, avatar bubbles, and
   gradient hero sections, in the scaffolded views.
5. THE Frontend SHALL expose a typed API client module in `frontend/lib/api/` that wraps
   every backend route with a zod-validated response type.
6. WHEN the frontend receives a response that fails zod validation, THE Frontend SHALL
   surface an inline error message in the affected view and SHALL log the validation
   error through the gated debug logger.

### Requirement 18: Market Discovery view

**User Story:** As a user, I want an interactive map of a city showing real hotels and an
opportunity heatmap, so that I can identify promising locations.

#### Acceptance Criteria

1. THE Market_Discovery view SHALL render a Mapbox GL JS map centered on a user-selected
   city, using `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`.
2. THE Market_Discovery view SHALL render existing hotels as deck.gl markers driven by
   `GET /hotels` results.
3. THE Market_Discovery view SHALL render the opportunity heatmap as a deck.gl grid layer
   driven by `GET /locations/opportunity-grid` results.
4. WHEN the user hovers over a hotel marker, THE Market_Discovery view SHALL show a
   tooltip with the hotel name, star rating, and Stay22 price and SHALL label the price
   as sourced from Stay22.
5. WHEN the user hovers over a heatmap cell, THE Market_Discovery view SHALL show the
   cell's opportunity score and its component scores, labeling every value as an
   estimate.
6. IF `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` is missing, THEN THE Market_Discovery view SHALL
   render a "Map not configured" placeholder with a link to the Mapbox setup section of
   the README.

### Requirement 19: Hotel Sandbox view

**User Story:** As a user, I want to configure a hotel and watch its predicted metrics
update in near real time, so that I can experiment with tradeoffs.

#### Acceptance Criteria

1. THE Hotel_Sandbox view SHALL provide form controls for hotel type, room count, star
   rating, modernity or renovation level, target audience, and a set of amenity toggles.
2. WHEN the user changes any control, THE Hotel_Sandbox view SHALL call `POST
   /simulations` with the updated configuration and SHALL render the returned metrics
   within 500 ms of the response arriving.
3. THE Hotel_Sandbox view SHALL display ADR, Occupancy, Revenue, Rating, Investment, ROI,
   and Payback Period, and SHALL label every value as an estimate.
4. THE Hotel_Sandbox view SHALL debounce simulation requests such that no more than one
   in-flight request is issued per 250 ms window per session.
5. WHEN a simulation request fails, THE Hotel_Sandbox view SHALL retain the previously
   rendered metrics and SHALL show an inline error banner referencing the returned
   `errorCode`.

### Requirement 20: AI Consultant frontend panel

**User Story:** As a user, I want a persistent AI consultant panel available from both
Market Discovery and Hotel Sandbox, so that I can ask for guidance without leaving my
current view.

#### Acceptance Criteria

1. THE AI_Consultant panel SHALL be reachable from both `/discover` and `/sandbox` as a
   collapsible side panel rather than a full-screen chat surface.
2. WHEN the user submits a prompt, THE AI_Consultant panel SHALL call `POST /ai/consult`
   with the current session id, the prompt, and the current view's context (city or
   hotel configuration).
3. WHEN `POST /ai/consult` returns hotel or simulation deltas, THE AI_Consultant panel
   SHALL forward the deltas to the active view so that the map or sandbox reflects the
   AI's applied changes.
4. THE AI_Consultant panel SHALL render the AI's textual explanation as plain text
   without avatar bubbles, without animated typing indicators, and without gradient
   backgrounds.
5. IF `POST /ai/consult` returns `errorCode = "ai_not_configured"`, THEN THE
   AI_Consultant panel SHALL display a "Gemini not configured" message linking to the
   Gemini setup section of the README.

### Requirement 21: Frontend gated debug logging

**User Story:** As a hackathon developer, I want opt-in verbose logging on the frontend,
so that I can trace behavior in the browser during development without shipping noisy logs
to end users.

#### Acceptance Criteria

1. THE Frontend SHALL expose a debug logger module with `debug`, `info`, `warn`, and
   `error` methods.
2. WHERE `NEXT_PUBLIC_DEBUG` equals `"true"`, THE Frontend debug logger SHALL forward
   every call to the corresponding `console` method.
3. WHERE `NEXT_PUBLIC_DEBUG` is unset or not `"true"`, THE Frontend debug logger SHALL
   forward only `warn` and `error` calls to `console` and SHALL discard `debug` and
   `info` calls.
4. THE Frontend SHALL route every diagnostic log through the debug logger and SHALL NOT
   call `console` directly from feature code.

### Requirement 22: Estimate framing across the product

**User Story:** As a user, I want every predicted number in the app to be clearly labeled
as an estimate, so that I never mistake a simulation for real financial data.

#### Acceptance Criteria

1. WHEN the Frontend renders any value produced by Simulation_Engine, THE Frontend SHALL
   display it with an "estimated" or "simulated" label adjacent to the value.
2. WHEN the Frontend renders any value sourced from Stay22, THE Frontend SHALL display it
   with a "source: Stay22" attribution adjacent to the value.
3. THE Backend SHALL include in every simulation response a `disclaimer` field with the
   value `"All predicted metrics are simulation estimates and not real financial data."`.
4. IF a simulation response arrives at the Frontend without a `disclaimer` field, THEN
   THE Frontend SHALL render a fallback estimate label adjacent to each simulated value
   and SHALL log a `warn` entry through the debug logger without blocking rendering.
5. THE AI_Consultant SHALL be prompted with a system instruction that requires it to
   describe predicted metrics as estimates or simulations and to attribute Stay22 data
   explicitly when citing it.
