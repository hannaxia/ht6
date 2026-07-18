# Implementation Plan: innsight-scaffold

## Overview

Convert the feature design into a series of prompts for a code-generation LLM that will
implement each step with incremental progress. Make sure that each prompt builds on the
previous prompts, and ends with wiring things together. There should be no hanging or
orphaned code that isn't integrated into a previous step. Focus ONLY on tasks that involve
writing, modifying, or testing code.

This scaffold is a pnpm workspace monorepo (`frontend/`, `backend/`, `packages/config/`)
implemented in TypeScript strict mode. Every task below produces production-shape code:
zod validation at every external boundary, structured `pino` logging on the backend,
gated `console` logging on the frontend, and bounds-checked simulation output. Config
placeholder values ship as part of `packages/config/` and are marked in comments as
`placeholder — tune later`; there is no separate tuning task. Setup documentation for
Stay22 / Gemini / Mapbox / MongoDB Atlas is the final documentation task, since those
steps are performed on external platforms.

Testing uses **Vitest** as the runner and **fast-check** (via `@fast-check/vitest`) as the
property-based-testing library, chosen in the design's Testing Strategy. Each of the 30
correctness properties in the design becomes its own property test sub-task, tagged
`// Feature: innsight-scaffold, Property N: <text>`. Optional test sub-tasks are marked
with `*` and can be skipped for a faster MVP; core implementation sub-tasks are never
optional.

## Tasks

- [ ] 1. Set up root workspace scaffolding
  - Create `package.json` at repo root declaring `packageManager: pnpm@…`, `engines.node: ">=20"`, workspace-wide scripts (`install`, `dev`, `build`, `lint`, `type-check`, `test`, `test:unit`, `test:prop`, `test:int`) that fan out via `pnpm -r run`, and `type-check` that exits non-zero and prints the failing workspace name via `pnpm -r --if-present --report-summary run type-check`
  - Create `pnpm-workspace.yaml` listing `frontend`, `backend`, and `packages/*`
  - Create `tsconfig.base.json` with strict mode, `moduleResolution: bundler`, `target: ES2022`, `esModuleInterop`, `skipLibCheck`, and `noUncheckedIndexedAccess`
  - Create `.env.example` with placeholder entries for `STAY22_API_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL=gemini-1.5-pro`, `MAPBOX_ACCESS_TOKEN`, `MONGODB_URI`, `PORT=4000`, `LOG_LEVEL=info`, `FRONTEND_ORIGIN=http://localhost:3000`, `NEXT_PUBLIC_BACKEND_URL=http://localhost:4000`, `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`, `NEXT_PUBLIC_DEBUG=false`
  - Create `.gitignore` covering `node_modules`, `.env`, `.env.local`, `.next`, `dist`, `.turbo`, `coverage`
  - Create a minimal placeholder `README.md` (the full setup docs land in task 21)
  - _Requirements: 1.1, 1.5, 1.6, 2.1, 2.2_

- [ ] 2. Build shared `@innsight/config` package
  - [ ] 2.1 Create `packages/config/` package skeleton
    - Add `package.json` with name `@innsight/config`, `main: dist/index.js`, `types: dist/index.d.ts`, scripts `build`, `type-check`, `test`, `test:prop`, and `zod` + `pino` as peer deps
    - Add `tsconfig.json` extending `tsconfig.base.json` with `outDir: dist`
    - _Requirements: 1.4, 6.1_

  - [ ] 2.2 Implement config data tables
    - Create `src/amenityImpact.ts` exporting `amenityImpactTable` (keyed by `(amenity, hotelType|locationType)`, returning percentage points) and `amenityImpactCap = 25`, with representative placeholder entries for `pool`, `spa`, `gym`, `restaurant`, `bar`, `wifi`, `parking`, `breakfast` — comment `// placeholder — tune later`
    - Create `src/competition.ts` exporting `competitionWeighting` (`starLevelWeight`, `typeMatchWeight`, `priceBandWeight`, `radiusKm`) with placeholder values
    - Create `src/cost.ts` exporting `costTable` (`perRoom` by hotel type × star, `perAmenity` install, `renovationPerRoom`) with placeholder values
    - Create `src/operating.ts` exporting `operatingMargin = 0.32`
    - Create `src/risk.ts` exporting `riskWeights` (`volatility`, `relConstructionCost`, `demandConcentration`) with placeholder values
    - Create `src/opportunity.ts` exporting `opportunityWeights` (`revenuePotential`, `demand`, `segmentWeightedCompetition`, `risk`) with placeholder values
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ] 2.3 Implement zod schemas and `loadConfig`
    - Create `src/schemas.ts` with one zod schema per exported table enforcing correct shapes, non-negative costs, valid hotel-type keys, and finite numeric weights
    - Create `src/index.ts` exporting `loadConfig(logger: pino.Logger): LoadedConfig` that parses the assembled config, logs a structured `error` entry with `issues` if validation fails, and throws
    - Re-export all typed tables plus `LoadedConfig` type
    - _Requirements: 6.6, 6.7_

  - [ ]* 2.4 Write property test for `loadConfig`
    - **Property 26: `loadConfig` accepts valid tables and rejects invalid mutations**
    - **Validates: Requirement 6.7**
    - File: `packages/config/src/loadConfig.property.test.ts` using `@fast-check/vitest`
    - fast-check mutations of the assembled config: valid mutations parse cleanly; schema-breaking mutations (negative costs, missing hotel-type keys, wrong types) cause `loadConfig` to throw and emit exactly one `error` log entry naming the failing field

- [ ] 3. Set up backend runtime foundation
  - [ ] 3.1 Create backend package skeleton
    - Add `backend/package.json` with dependencies `express`, `pino`, `pino-http`, `mongoose`, `zod`, `@google/generative-ai`, `nanoid`, `cors`, `@innsight/config` (workspace), and dev deps `typescript`, `tsx`, `vitest`, `@fast-check/vitest`, `fast-check`, `supertest`, `mongodb-memory-server`, `msw`
    - Add scripts: `dev` (`tsx watch src/index.ts`), `build`, `type-check`, `lint`, `test` (`vitest --run`), `test:unit`, `test:prop`, `test:int`
    - Add `backend/tsconfig.json` extending base with `rootDir: src`, `outDir: dist`
    - Add `backend/vitest.config.ts` with node environment and test file globs
    - Add `backend/.env.example` documenting `STAY22_API_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `MONGODB_URI`, `PORT`, `LOG_LEVEL`, `FRONTEND_ORIGIN`
    - _Requirements: 1.3, 1.5, 2.4_

  - [ ] 3.2 Implement env parsing (`src/env.ts`)
    - Define a zod schema for `Env` with all required keys optional (backend must degrade cleanly per Req 2.5)
    - Export `loadEnv(logger?: pino.Logger): Env` that parses `process.env`, logs a `warn` per missing required variable naming that variable, and returns the typed object without throwing
    - Export helper `isConfigured(env, key): boolean`
    - _Requirements: 2.4, 2.5_

  - [ ] 3.3 Implement pino logger (`src/logger.ts`)
    - Export a singleton `logger = pino({ level: env.LOG_LEVEL ?? 'info', base: { service: 'innsight-backend' }, redact: ['req.headers.authorization', 'res.headers["set-cookie"]'], formatters: { level: (label) => ({ level: label }) } })`
    - Export `createChildLogger(bindings)` helper for request-scoped logs
    - _Requirements: 3.3_

- [ ] 4. Implement backend cross-cutting middleware
  - [ ] 4.1 Implement `requestId` middleware (`src/middleware/requestId.ts`)
    - Attach `req.id = nanoid()` and `req.log = logger.child({ requestId: req.id, route: req.path, method: req.method })`
    - _Requirements: 3.3, 3.4_

  - [ ] 4.2 Implement `requestLogger` middleware (`src/middleware/requestLogger.ts`)
    - On the `finish` event of `res`, emit exactly one structured log entry with `{ method, path, status, durationMs, requestId }` regardless of whether the handler threw
    - _Requirements: 3.4_

  - [ ] 4.3 Implement error handler middleware (`src/middleware/errorHandler.ts`)
    - Log any thrown error at level `error` with stack + requestId as a separate entry from the request-completion entry
    - Respond HTTP 500 with envelope `{ errorCode: 'internal_error', message: 'Unexpected server error' }` — no stack trace in the body
    - Export a `notFoundHandler` that returns 404 with a stable envelope
    - _Requirements: 3.5_

  - [ ] 4.4 Implement CORS middleware (`src/middleware/cors.ts`)
    - Configure `cors` with `origin = env.FRONTEND_ORIGIN ?? 'http://localhost:3000'`, credentials on
    - _Requirements: 3.6_

  - [ ]* 4.5 Write property tests for cross-cutting middleware
    - **Property 20: Every completed request produces exactly one completion log**
    - **Validates: Requirement 3.4**
    - **Property 21: Unhandled errors produce a safe 500 envelope**
    - **Validates: Requirement 3.5**
    - File: `backend/src/middleware/middleware.property.test.ts` using `supertest` against a minimally composed app with a spy logger; fast-check arbitrary route paths and thrown-error shapes

- [ ] 5. Implement MongoDB layer
  - [ ] 5.1 Implement connection lifecycle (`src/db/mongo.ts`)
    - Export `MongoConnection { readiness, models, close }` interface and `connectMongo(env, logger): Promise<MongoConnection>`
    - `readiness = 'not_configured'` when `MONGODB_URI` unset (no connect attempt, immediate return)
    - `readiness = 'ready'` after `mongoose.connect` + `db.admin().ping()` succeeds (log info)
    - `readiness = 'error'` when connect fails (log error, do not throw)
    - `buildDetachedModels()` returns model stubs whose methods throw a well-known error, so accidental use in degraded mode fails at the boundary
    - _Requirements: 4.1, 4.6, 4.7_

  - [ ] 5.2 Implement `Hotel` model (`src/db/models/Hotel.ts`)
    - Mongoose schema with `stayId` (unique index), `name`, `supplier`, `city?`, `country?`, `stars? (1..5)`, `rating? (0..5)`, `price?`, `amenities[]`, `images[]`, `coordinates` (GeoJSON Point), `timestamps: true`
    - Register `2dsphere` index on `coordinates`
    - _Requirements: 4.2, 4.5_

  - [ ] 5.3 Implement `Location` model (`src/db/models/Location.ts`)
    - Mongoose schema with `city`, `country`, `coordinates` (GeoJSON Point), `tourism_score`, `business_score`, `transit_score`, `population_density`, `hotel_density`, `timestamps: true`
    - Register `2dsphere` index on `coordinates`
    - _Requirements: 4.3, 4.5_

  - [ ] 5.4 Implement `Simulation` model (`src/db/models/Simulation.ts`)
    - Mongoose schema with `sessionId`, `startingHotelId?` (nullable), `changes` (mixed), `beforeMetrics?`, `afterMetrics`, `createdAt`
    - Add compound index on `{ sessionId: 1, createdAt: -1 }`
    - _Requirements: 4.4_

  - [ ]* 5.5 Write integration tests for Mongo schemas
    - Uses `mongodb-memory-server`
    - fast-check-generated valid docs → save → query → assert equality on non-timestamp fields for each of `Hotel`, `Location`, `Simulation`
    - Assert `2dsphere` index exists on both `Hotels.coordinates` and `Locations.coordinates`
    - _Requirements: 4.2, 4.3, 4.4, 4.5_

- [ ] 6. Implement Stay22 API client
  - [ ] 6.1 Define Stay22 zod schemas (`src/stay22/schemas.ts`)
    - `stay22HotelSchema`: `id`, `name`, `supplier`, `coordinates {lat,lng}` with bounds, optional `city`, `country`, `stars 1..5`, `rating 0..5`, `price {amount, currency length 3, per: night|stay}`, `amenities[]` (default `[]`), `images[]` (URLs), optional `bookingUrl`
    - `stay22EnvelopeSchema`: `{ hotels: unknown[], meta?: { total?: number } }` (per-record validation is done after envelope)
    - Export `Stay22Hotel` inferred type
    - _Requirements: 5.3_

  - [ ] 6.2 Implement Stay22 client class (`src/stay22/client.ts`)
    - Export `Stay22Client` with `readiness`, `searchByCity`, `searchByBoundingBox`, `searchByRadius`
    - Attach `Authorization: Bearer <STAY22_API_KEY>` (single header helper, adjustable in one place) to every outbound request
    - Enforce a 10-second timeout via `AbortController`; log a structured `warn` on timeout and return `[]`
    - Parse envelope with `stay22EnvelopeSchema`; envelope failure → `logger.error` with issues + return `[]`
    - For each record, parse with `stay22HotelSchema`; record failure → `logger.warn` with index and issues, then skip
    - When `STAY22_API_KEY` unset: `readiness = 'not_configured'`, log a `warn` at client construction, every method returns `[]`
    - **No fabricated data path**: no synthetic hotels are ever generated as substitutes
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

  - [ ]* 6.3 Write property tests for Stay22 client
    - **Property 24: `STAY22_API_KEY` is attached to every outbound request**
    - **Validates: Requirement 5.2**
    - **Property 25: Every returned record passes the Stay22 record schema**
    - **Validates: Requirements 5.3, 5.4, 5.5**
    - File: `backend/src/stay22/client.property.test.ts`; mock global `fetch` (or use `msw`); fast-check-generated envelopes and mixed-validity records; assert every returned record passes `stay22HotelSchema`, envelope failures return `[]`, and exactly one `warn` log per discarded record

  - [ ]* 6.4 Write integration test for Stay22 client happy path
    - Use `msw` to serve a fixture envelope; verify auth header is present, timeout wiring works, and record-level validation short-circuits malformed records
    - _Requirements: 5.1, 5.2, 5.7_

- [ ] 7. Implement simulation engine sub-modules
  - [ ] 7.1 Define simulation types and `SimulationError` (`src/simulation/types.ts`, `src/simulation/errors.ts`)
    - Export `HotelType`, `LocationType`, `LocationScores`, `HotelConfig`, `CompetitorHotel`, `SimulateHotelOutput`, `OpportunityGridInput`, `OpportunityCell`
    - Export `SimulationError extends Error` carrying `code` and `input`
    - _Requirements: 7.6_

  - [ ] 7.2 Implement `locationScore` module (`src/simulation/locationScore.ts`)
    - Pure function `locationMultiplier(scores: LocationScores): number` derived from `transit`, `airport`, `tourism`, `business` (no other inputs)
    - _Requirements: 8.3_

  - [ ] 7.3 Implement `qualityScore` module (`src/simulation/qualityScore.ts`)
    - Pure function `qualityMultiplier(stars: 1|2|3|4|5, modernity: number): number` — **must not** depend on predicted rating
    - Deterministic star base map × modernity boost as in the design
    - _Requirements: 7.2, 8.2_

  - [ ] 7.4 Implement shared amenity impact module (`src/simulation/amenityImpact.ts`)
    - Export `aggregate(amenities, { hotelType, locationType }, table): number` (sums percentage points using `hotelType` → `locationType` → `_default` → 0 lookup)
    - Export `cap(raw, capPP): number` (clamps to `[-capPP, +capPP]`)
    - _Requirements: 6.4, 7.3, 7.4_

  - [ ] 7.5 Implement shared competition module (`src/simulation/competition.ts`)
    - Export `pressure(subject: HotelConfig, competitors: CompetitorHotel[], weights: CompetitionWeighting): number` returning percentage points
    - Weights nearby hotels by proximity in star level, hotel type, and price band per config
    - Falls off with geographic distance within `radiusKm`
    - _Requirements: 7.5_

  - [ ] 7.6 Implement `adr` module (`src/simulation/adr.ts`)
    - Pure function `adrFormula(basePrice, locationMultiplier, qualityMultiplier, cappedAmenityPct): number`
    - `adr = basePrice × locationMultiplier × qualityMultiplier × (1 + cappedAmenityPct / 100)`
    - Throws `SimulationError('adr_non_positive')` and logs `error` when result is non-finite or ≤ 0
    - _Requirements: 8.1, 8.4_

  - [ ] 7.7 Implement `occupancy` module (`src/simulation/occupancy.ts`)
    - Pure function `occupancyFormula(baseDemand, locationDemand, hotelQuality, amenityMatch, competitionPressure): number`
    - Clamps to `[0, 100]`; throws `SimulationError('occupancy_non_finite')` and logs `error` when pre-clamp is not finite
    - _Requirements: 9.1, 9.2, 9.3_

  - [ ] 7.8 Implement `revenue` module (`src/simulation/revenue.ts`)
    - Pure function `revenueFormula(rooms, adr, occupancyPct): number`
    - `revenue = rooms × adr × (occupancy / 100) × 365`
    - Throws `SimulationError('rooms_invalid')` when rooms is not a non-negative integer
    - Returns `0` (no error) when rooms is `0`
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [ ] 7.9 Implement `rating` module (`src/simulation/rating.ts`)
    - Export `priceExpectationPenalty(adr, segmentAdrNorm): number` — monotone non-decreasing in adr; guarded when `segmentAdrNorm <= 0`
    - Export `ratingFormula(baseRating, amenitySatisfaction, locationSatisfaction, penalty): number` clamping to `[1.0, 5.0]`
    - `amenitySatisfaction` is derived from the same shared aggregate used by ADR — no separate lookup
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [ ] 7.10 Implement `capex` module (`src/simulation/capex.ts`)
    - `investmentFormula(input, costTable)`: `(costPerRoom × rooms) + Σ(perAmenityInstallCost) + (renovationPerRoom × rooms × renovationDelta)`; throws `SimulationError('investment_invalid')` when non-finite or negative
    - `roi(profit, investment)`: throws `SimulationError('investment_non_positive')` when `investment <= 0`; returns `0` when profit is `0` (log `warn`)
    - `payback(profit, investment)`: throws `SimulationError('investment_non_positive')` when `investment <= 0`; returns `Number.POSITIVE_INFINITY` when profit is `0` (log `warn`)
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7_

- [ ] 8. Compose simulation engine and opportunity grid
  - [ ] 8.1 Define simulation output bounds schema (`src/schemas/simulation.ts`)
    - `simulateHotelOutputSchema`: `adr > 0`, `0 ≤ occupancy ≤ 100`, `1.0 ≤ rating ≤ 5.0`, `revenue ≥ 0`, `investment ≥ 0`, `annualOperatingProfit ≥ 0`, `roi ≥ 0`, `paybackYears > 0 ∨ paybackYears === Number.POSITIVE_INFINITY`, `disclaimer` literal
    - `opportunityCellSchema`: `coordinates`, raw `components`, `normalized ∈ [0,100]`, `opportunityScore ∈ [0, 100]`
    - Export the fixed disclaimer constant `"All predicted metrics are simulation estimates and not real financial data."`
    - _Requirements: 14.1, 14.3, 22.3_

  - [ ] 8.2 Implement `opportunityGrid` module (`src/simulation/opportunityGrid.ts`)
    - Three-pass algorithm: raw components → min-max normalize → weighted sum
    - `risk = wVol × volatility + wCost × relConstructionCost + wConc × demandConcentration` from `config.riskWeights`
    - `opportunityScore = w1 × norm.revenue + w2 × norm.demand − w3 × norm.competition − w4 × norm.risk` clamped to `[0, 100]`
    - Uses the shared competition module for `segmentWeightedCompetition`
    - If grid empty OR any component constant across the grid: emit `warn` and return every cell with `opportunityScore = 50`
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_

  - [ ] 8.3 Compose `simulateHotel` and export the engine (`src/simulation/index.ts`)
    - Export `createSimulationEngine(config: LoadedConfig, logger: pino.Logger): SimulationEngine`
    - `simulateHotel(input)` composes sub-modules in the mandated order: Location/Quality → ADR → Occupancy → Revenue → Rating → CapEx → ROI → Payback
    - `amenityImpactPct` is computed **once** and reused for ADR and Rating
    - `competitionPressure` is computed once and reused between Occupancy and (optionally) the caller's downstream views
    - `computeOpportunityGrid(input)` delegates to the module in 8.2
    - Every output object carries the fixed `disclaimer` string
    - _Requirements: 7.1, 7.4, 7.5, 7.6, 22.3_

  - [ ] 8.4 Create fast-check generators (`src/simulation/__generators__/index.ts`)
    - `hotelConfigArb`, `competitorArb`, `opportunityGridInputArb` centralized so every property test draws from the same generators
    - Bake in edge cases: zero rooms, empty amenities, extreme location scores, negative modernity floor
    - _Requirements: N/A (test infra)_

  - [ ]* 8.5 Property test: ADR is invariant to `baseRating`
    - **Property 1: ADR is invariant to baseRating**
    - **Validates: Requirements 7.2, 8.2**
    - File: `backend/src/simulation/adr.property.test.ts` — same `HotelConfig` under two `baseRating` values yields identical `adr`

  - [ ]* 8.6 Property test: amenity aggregator is bounded and order-independent
    - **Property 2: Aggregated amenity impact is bounded and order-independent**
    - **Validates: Requirements 6.4, 7.3**
    - File: `backend/src/simulation/amenityImpact.property.test.ts`

  - [ ]* 8.7 Property test: ADR and Rating share amenity aggregation
    - **Property 3: ADR and Rating share the same amenity aggregation**
    - **Validates: Requirements 7.4, 11.3**
    - File: `backend/src/simulation/amenitySharing.property.test.ts` — inspect `intermediates.amenityImpactPct` vs. rating branch value

  - [ ]* 8.8 Property test: competition pressure respects segment proximity
    - **Property 4: Competition pressure respects segment proximity**
    - **Validates: Requirement 7.5**
    - File: `backend/src/simulation/competition.property.test.ts`

  - [ ]* 8.9 Property test: ADR definitional formula
    - **Property 5: ADR follows the definitional formula**
    - **Validates: Requirement 8.1**
    - File: `backend/src/simulation/adrFormula.property.test.ts` — floating-point tolerance

  - [ ]* 8.10 Property test: `locationMultiplier` is a pure function of location scores
    - **Property 6: `locationMultiplier` is a pure function of location scores**
    - **Validates: Requirement 8.3**
    - File: `backend/src/simulation/locationScore.property.test.ts`

  - [ ]* 8.11 Property test: Occupancy is always in `[0, 100]`
    - **Property 7: Occupancy is always in [0, 100]**
    - **Validates: Requirements 9.1, 9.2**
    - File: `backend/src/simulation/occupancy.property.test.ts`

  - [ ]* 8.12 Property test: Revenue follows annualization formula
    - **Property 8: Revenue follows the annualization formula**
    - **Validates: Requirements 10.1, 10.2**
    - File: `backend/src/simulation/revenue.property.test.ts`

  - [ ]* 8.13 Property test: Zero rooms produces zero revenue without error
    - **Property 9: Zero rooms produces zero revenue without error**
    - **Validates: Requirement 10.4**
    - File: `backend/src/simulation/revenueZeroRooms.property.test.ts`

  - [ ]* 8.14 Property test: Rating is always in `[1.0, 5.0]`
    - **Property 10: Rating is always in [1.0, 5.0]**
    - **Validates: Requirements 11.1, 11.4**
    - File: `backend/src/simulation/rating.property.test.ts`

  - [ ]* 8.15 Property test: Price expectation penalty is monotone in ADR
    - **Property 11: Price-expectation penalty is monotone non-decreasing in ADR**
    - **Validates: Requirement 11.2**
    - File: `backend/src/simulation/priceExpectation.property.test.ts`

  - [ ]* 8.16 Property test: CapEx algebra is definitional
    - **Property 12: CapEx algebra is definitional**
    - **Validates: Requirements 12.1, 12.2, 12.3, 12.4**
    - File: `backend/src/simulation/capex.property.test.ts`

  - [ ]* 8.17 Property test: Zero profit → infinite payback and zero ROI
    - **Property 13: Zero profit yields infinite payback and zero ROI**
    - **Validates: Requirement 12.6**
    - File: `backend/src/simulation/capexZeroProfit.property.test.ts` — also asserts `warn` log emitted

  - [ ]* 8.18 Property test: Investment and ROI are non-negative
    - **Property 14: Investment and ROI are non-negative**
    - **Validates: Requirement 12.7**
    - File: `backend/src/simulation/capexNonNegative.property.test.ts`

  - [ ]* 8.19 Property test: Adding positive-impact amenity does not decrease ADR
    - **Property 15: Adding a positive-impact amenity does not decrease ADR (below the cap)**
    - **Validates: Requirements 7.3, 7.4, 8.1**
    - File: `backend/src/simulation/amenityMonotonicity.property.test.ts`

  - [ ]* 8.20 Property test: Every `simulateHotel` output passes bounds schema
    - **Property 16: Every `simulateHotel` output passes the bounds schema**
    - **Validates: Requirement 14.1**
    - File: `backend/src/simulation/outputBounds.property.test.ts`

  - [ ]* 8.21 Property test: Every opportunity cell has `opportunityScore ∈ [0, 100]`
    - **Property 17: Every opportunity-grid cell has `opportunityScore` in [0, 100]**
    - **Validates: Requirements 13.3, 13.4, 14.3**
    - File: `backend/src/simulation/opportunityGrid.property.test.ts`

  - [ ]* 8.22 Property test: Constant-component grid falls back to 50
    - **Property 18: Constant-component grid falls back to 50**
    - **Validates: Requirement 13.6**
    - File: `backend/src/simulation/opportunityGridFallback.property.test.ts` — also asserts `warn` log emitted

  - [ ]* 8.23 Example tests: simulation error paths
    - Unit examples for `SimulationError` cases: bad ADR inputs (Req 8.4), non-integer rooms (Req 10.3), zero investment (Req 12.5)
    - _Requirements: 8.4, 10.3, 12.5_

- [ ] 9. Checkpoint — simulation engine and integrations pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Define HTTP contract schemas
  - Create `src/schemas/common.ts`: `errorEnvelopeSchema` with the six stable `errorCode`s (`invalid_request`, `database_unavailable`, `ai_not_configured`, `simulation_output_invalid`, `internal_error`, `response_validation_failed`); `coordinateSchema`
  - Create `src/schemas/hotel.ts`: reuse `stay22HotelSchema`; add `hotelsListResponseSchema`
  - Create `src/schemas/simulation.ts`: `hotelConfigSchema` (request body for `POST /simulations`, including rooms as non-negative integer, stars 1..5, modernity 0..1, renovationDelta 0..1, amenities string array, target segment enum, base price, location scores); re-export `simulateHotelOutputSchema` from task 8.1; `simulationsResponseSchema` combining `{ result, simulationId, disclaimer }`
  - Create `src/schemas/grid.ts`: `opportunityGridQuerySchema`, `opportunityGridResponseSchema` (array of cells; server-side discards any cell that fails and logs `warn`)
  - Create `src/schemas/ai.ts`: `aiConsultRequestSchema` (`sessionId`, `prompt`, optional `context`); `aiConsultResponseSchema` (`message`, `deltas: { hotel?, simulation? }`, `disclaimer` literal)
  - _Requirements: 14.1, 14.3, 16.5, 22.3_

- [ ] 11. Implement backend service layer and routes
  - [ ] 11.1 Implement service modules (`src/services/`)
    - `healthService.ts`: aggregates readiness of mongo/stay22/gemini into a `HealthResponse`; never throws
    - `hotelService.ts`: wraps `Stay22Client.searchByCity/Bbox/Radius` with input validation; passes through the client's already-validated records
    - `simulationService.ts`: composes engine call + output validation via `simulateHotelOutputSchema` + persistence to `Simulations`
    - `locationService.ts`: builds `OpportunityGridInput` from city + gridSize + city bbox context, invokes engine, filters cells failing `opportunityCellSchema` (log each discarded cell at `warn`)
    - _Requirements: 3.2, 4.4, 13.1, 14.1, 14.3_

  - [ ] 11.2 Implement `GET /health` (`src/routes/health.ts`)
    - Returns `{ status, uptimeSeconds, dependencies: { mongodb, stay22, gemini } }`
    - `status === 'ok'` iff every dependency is `'ready'`, else `'degraded'`
    - Never returns 5xx
    - _Requirements: 3.2_

  - [ ] 11.3 Implement `GET /hotels` (`src/routes/hotels.ts`)
    - Query zod validation for `city?`, `bbox?`, `center` + `radiusKm?`
    - Delegates to `hotelService`; returns `{ hotels: Stay22Hotel[] }`
    - Returns `[]` (HTTP 200) when Stay22 is `not_configured` — no error
    - _Requirements: 16.1, 16.5_

  - [ ] 11.4 Implement `GET /locations/opportunity-grid` (`src/routes/locations.ts`)
    - Query zod validation for `city`, `gridSize` (default 20)
    - Returns 503 `errorCode: 'database_unavailable'` when mongo readiness is not `'ready'`
    - Delegates to `locationService`; returns `{ cells: OpportunityCell[] }`
    - _Requirements: 4.8, 13.1, 14.3, 16.2, 16.5_

  - [ ] 11.5 Implement `POST /simulations` (`src/routes/simulations.ts`)
    - Request body zod validation via `hotelConfigSchema` → 400 `invalid_request` with `details.issues` on failure
    - 503 `database_unavailable` when mongo readiness is not `'ready'`
    - Invoke `simulationService`; validate output; on schema failure log `error` with input and issues, return 500 `simulation_output_invalid`
    - Response body: `{ result, simulationId, disclaimer }`
    - _Requirements: 4.8, 14.1, 14.2, 16.3, 16.5, 22.3_

  - [ ] 11.6 Implement app composition root (`src/app.ts`, `src/index.ts`)
    - `createApp(deps: AppDependencies): express.Express` mounting cors → json → requestId → requestLogger → routers → notFoundHandler → errorHandler
    - `src/index.ts`: load env, create logger, load `@innsight/config`, connect mongo, construct Stay22 client, construct simulation engine, construct AI orchestrator (may be `null`), call `createApp`, listen on `PORT` (default 4000)
    - _Requirements: 3.1, 3.6_

  - [ ]* 11.7 Property tests for backend HTTP contracts
    - **Property 19: Missing-env subsets degrade cleanly at startup**
    - **Validates: Requirements 2.5, 4.6, 5.6, 15.6**
    - **Property 22: DB-requiring routes return 503 during degraded state**
    - **Validates: Requirement 4.8**
    - **Property 23: Invalid request bodies produce a 400 envelope with field issues**
    - **Validates: Requirement 16.5**
    - File: `backend/src/routes/routes.property.test.ts` — supertest against `createApp({...fakes})`; fakes drive mongo readiness, injected simulation faults, and arbitrary bodies

  - [ ]* 11.8 Property test: `POST /simulations` always carries the disclaimer
    - **Property 30: Every simulation response carries the disclaimer**
    - **Validates: Requirement 22.3**
    - File: `backend/src/routes/simulationsDisclaimer.property.test.ts` — fast-check `HotelConfig` inputs; supertest asserts the fixed disclaimer literal on every 200 response

- [ ] 12. Implement AI Consultant orchestrator
  - [ ] 12.1 Gemini client wrapper (`src/ai/gemini.ts`)
    - `createGeminiClient(env): GeminiClient | null` returns `null` when `GEMINI_API_KEY` unset
    - Configures `GoogleGenerativeAI` with `model = env.GEMINI_MODEL ?? 'gemini-1.5-pro'`, system instruction, tool declarations, `functionCallingConfig.mode = 'AUTO'`
    - _Requirements: 15.1, 15.6_

  - [ ] 12.2 System instruction (`src/ai/systemInstruction.ts`)
    - Export the hardcoded system instruction requiring every predicted number to be described as an "estimate" or "simulation" and every Stay22-sourced value attributed to "Stay22"
    - _Requirements: 22.5_

  - [ ] 12.3 Tool schemas and handlers (`src/ai/tools/`)
    - `index.ts` exports `Tool<Args, Result>` interface and `TOOLS` registry
    - `simulateHotelChange.ts`: args `{ base: HotelConfig, changes: Partial<HotelConfig> }` → `{ before, after }` via `simulationService`
    - `calculateRevenue.ts`: args `{ config: HotelConfig }` → `{ revenue, breakdown }` via simulation engine
    - `analyzeLocation.ts`: args `{ city, coordinates? }` → `{ scores, opportunityCells }` via `locationService`
    - `compareCompetitors.ts`: args `{ hotel: HotelConfig, radiusKm }` → `{ competitors, segmentPressure }` via `Stay22Client` + shared competition module
    - `generateInvestmentReport.ts`: args `{ config: HotelConfig }` → `{ investment, roi, paybackYears, narrativeSummary }` via engine
    - Each tool has zod arg + result schemas
    - _Requirements: 15.2_

  - [ ] 12.4 Dispatch loop (`src/ai/consultant.ts`)
    - Round budget of 6; log `warn` naming session id when hit and return a schema-valid budget-exhausted response
    - Validate tool args with the tool's `argsSchema` before invoking the handler; on failure return a structured tool error to Gemini + log `warn`
    - Validate every tool result with the tool's `resultSchema` before returning to Gemini
    - Aggregate deltas across rounds
    - Final response passes `aiConsultResponseSchema`; on validation failure route responds 500 `internal_error` and logs `error` with offending payload
    - _Requirements: 15.3, 15.4, 15.5, 15.7_

  - [ ] 12.5 `POST /ai/consult` route (`src/routes/ai.ts`)
    - Request body zod validation via `aiConsultRequestSchema` → 400 `invalid_request` on failure
    - Returns 503 `ai_not_configured` when Gemini client is `null`
    - Delegates to `consultant.consult(...)`; returns `{ message, deltas, disclaimer }`
    - _Requirements: 15.6, 16.4, 16.5_

  - [ ]* 12.6 Property tests for AI orchestrator
    - **Property 27: Tool handlers are invoked only when args pass zod validation**
    - **Validates: Requirements 15.3, 15.4**
    - **Property 28: Final Gemini responses pass the response schema**
    - **Validates: Requirement 15.5**
    - **Property 29: Tool-call rounds per request are bounded by 6**
    - **Validates: Requirement 15.7**
    - File: `backend/src/ai/consultant.property.test.ts` — fake Gemini client returning fast-check-generated tool-call sequences

  - [ ]* 12.7 Integration test: AI orchestrator end-to-end
    - Route-level test with a fake Gemini client scripted to call `simulateHotelChange` once, verifying the deltas propagate into the response body
    - _Requirements: 15.2, 16.4_

- [ ] 13. Checkpoint — backend end-to-end works
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Set up frontend workspace and configuration
  - [ ] 14.1 Create Next.js 14+ App Router project (`frontend/`)
    - `package.json` with `next`, `react`, `react-dom`, `tailwindcss`, `zod`, `mapbox-gl`, `@deck.gl/core`, `@deck.gl/layers`, `@deck.gl/mapbox`, `nanoid`; dev deps `typescript`, `vitest`, `@fast-check/vitest`, `fast-check`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`
    - `tsconfig.json` extending base with `jsx: preserve`, path alias `@/*`
    - `next.config.mjs`, `tailwind.config.ts` (scan `app`, `components`, `lib`), `postcss.config.mjs`
    - `.env.example` documenting `NEXT_PUBLIC_BACKEND_URL`, `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`, `NEXT_PUBLIC_DEBUG`
    - `vitest.config.ts` with jsdom environment
    - **Explicit non-goals**: no `shadcn/ui`, no `radix-ui`, no `mui`, no `chakra`, no `antd` in dependencies
    - _Requirements: 1.2, 2.3, 17.1, 17.2_

  - [ ] 14.2 Root layout + landing route (`app/layout.tsx`, `app/page.tsx`)
    - `layout.tsx` mounts `SessionProvider` and `AIConsultantProvider` (created in task 16)
    - `page.tsx` = landing route with plain Tailwind-styled links to `/discover` and `/sandbox` — no gradient hero, no chat-clone aesthetic
    - _Requirements: 17.1, 17.2, 17.4_

- [ ] 15. Build frontend lib (api client, logger, session, debounce)
  - [ ] 15.1 Gated debug logger (`lib/log.ts`)
    - Export `log` with `debug`, `info`, `warn`, `error` methods
    - When `NEXT_PUBLIC_DEBUG === 'true'`: forward every call to matching `console` method
    - Otherwise: forward only `warn` and `error`; discard `debug` and `info`
    - Prefix every message with `"[innsight]"`
    - _Requirements: 21.1, 21.2, 21.3_

  - [ ] 15.2 Session module (`lib/session.ts`)
    - On first client render, generate a `nanoid` and persist to `localStorage["innsight_session"]`; expose `getSessionId()` / SSR-safe wrapper
    - _Requirements: (used by 15.4, 18.4, 20.2)_

  - [ ] 15.3 Debounce module (`lib/debounce.ts`)
    - `createInFlightDebouncer<T>(minIntervalMs)`: returns a runner that resolves to `null` when a request is skipped (either in-flight or within window); previous state is retained by the caller
    - _Requirements: 19.4_

  - [ ] 15.4 API client with zod-validated responses (`lib/api/`)
    - `client.ts`: `fetchJson<T>(url, init, schema)` — issues JSON request; on non-2xx parses backend error envelope and throws `ApiError`; on 2xx validates via schema; on schema failure throws `ApiError({ errorCode: 'response_validation_failed' })` and calls `log.warn` with URL + issues
    - `schemas.ts`: response zod schemas mirroring backend contracts (`hotelsListResponseSchema`, `opportunityGridResponseSchema`, `simulationsResponseSchema`, `aiConsultResponseSchema`, `errorEnvelopeSchema`)
    - `hotels.ts`: `hotelsApi.list({ city?, bbox?, center?, radiusKm? })`
    - `simulations.ts`: `simulationsApi.create(config: HotelConfig, sessionId: string)`
    - `locations.ts`: `locationsApi.opportunityGrid({ city, gridSize? })`
    - `ai.ts`: `aiApi.consult({ sessionId, prompt, context? })`
    - _Requirements: 17.5, 17.6, 21.4_

- [ ] 16. Build frontend shared components and contexts
  - [ ] 16.1 Shared UI primitives (`components/shared/`)
    - `EstimateLabel.tsx` — `<span>` with plain Tailwind, no design-system dep
    - `Stay22Attribution.tsx` — `"source: Stay22"` label
    - `ErrorBanner.tsx` — inline (non-modal) banner accepting `errorCode` and optional `message`
    - `Panel.tsx` — collapsible **side** panel (never full-screen; explicit `w-96` / `md:w-[420px]`)
    - `FormField.tsx` — `<label>` + `<input>`; no external UI lib
    - _Requirements: 17.2, 17.3, 17.4, 22.1, 22.2_

  - [ ] 16.2 Session and AI Consultant contexts (`contexts/`)
    - `SessionContext.tsx` — hydrates on mount from `lib/session.ts`; exposes `{ sessionId }`
    - `AIConsultantContext.tsx` — exposes `{ isOpen, open, close, lastDeltas, applyDeltas }`; feature pages subscribe to `lastDeltas`
    - _Requirements: 20.3_

- [ ] 17. Build Market Discovery view
  - [ ] 17.1 Discover page (`app/discover/page.tsx`)
    - Loads city selection state; fetches hotels via `hotelsApi.list` and opportunity grid via `locationsApi.opportunityGrid`
    - Mounts `DiscoverMap` and the `ConsultantPanel` (from task 19) as a side panel
    - Renders `<ErrorBanner />` on any zod validation failure via `log.warn`
    - _Requirements: 17.1, 17.6, 18.1_

  - [ ] 17.2 `DiscoverMap` and layers (`components/discover/`)
    - `DiscoverMap.tsx`: initializes `mapboxgl.Map` with `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`; if unset, renders `<MapNotConfigured />` linked to the Mapbox setup section of the README (task 21) — do not touch the Mapbox SDK when token missing
    - `HotelLayer.tsx`: deck.gl `ScatterplotLayer` driven by `GET /hotels` results
    - `OpportunityLayer.tsx`: deck.gl `GridCellLayer` driven by `GET /locations/opportunity-grid` results
    - `HotelMarkerTooltip.tsx`: hover tooltip with hotel name, stars, Stay22 price + `<Stay22Attribution />`
    - `HeatmapTooltip.tsx`: hover tooltip with opportunity score and component scores, each with `<EstimateLabel />`
    - `MapNotConfigured.tsx`: plain placeholder with README link
    - **No third-party tooltip lib** — plain HTML overlays styled with Tailwind
    - _Requirements: 17.2, 17.3, 17.4, 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 22.1, 22.2_

  - [ ]* 17.3 Example tests for Discover view
    - Missing `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` renders `<MapNotConfigured />` and the Mapbox SDK is never invoked (Requirement 18.6)
    - Hover on hotel marker renders `<Stay22Attribution />` (Requirement 18.4, 22.2)
    - Hover on heatmap cell renders `<EstimateLabel />` for every value (Requirement 18.5, 22.1)

- [ ] 18. Build Hotel Sandbox view
  - [ ] 18.1 Sandbox page (`app/sandbox/page.tsx`)
    - Loads current `HotelConfig` state; on any change, invokes `createInFlightDebouncer(250)` runner that calls `simulationsApi.create`
    - Mounts `SandboxForm` and `MetricsPanel`; mounts the `ConsultantPanel` (from task 19) as a side panel
    - On response arrival, renders new metrics within 500 ms (no artificial delay)
    - On error, retains previously rendered metrics and renders `<ErrorBanner errorCode=… />`
    - _Requirements: 19.2, 19.4, 19.5_

  - [ ] 18.2 Sandbox components (`components/sandbox/`)
    - `SandboxForm.tsx`: `FormField`-based controls for hotel type, room count, star rating, modernity/renovation level, target audience, and amenity toggles — plain HTML, no design system
    - `MetricsPanel.tsx`: grid of `MetricCard`
    - `MetricCard.tsx`: value + `<EstimateLabel />`; when the response is missing `disclaimer`, renders the fallback label and calls `log.warn`
    - `ChangeSummary.tsx`: before/after view used when the AI applies deltas via `AIConsultantContext.lastDeltas`
    - _Requirements: 17.2, 17.3, 19.1, 19.3, 22.1, 22.4_

  - [ ]* 18.3 Example tests for Sandbox view
    - Debouncer never issues more than one in-flight request per 250 ms window (Requirement 19.4)
    - On error, previously rendered metrics are retained and `<ErrorBanner />` references the returned `errorCode` (Requirement 19.5)
    - Missing `disclaimer` in response triggers fallback `<EstimateLabel />` + `log.warn` (Requirement 22.4)

- [ ] 19. Build AI Consultant panel
  - [ ] 19.1 Consultant components (`components/consultant/`)
    - `ConsultantPanel.tsx`: collapsible **side** panel (never full-screen), subscribes to `AIConsultantContext`
    - `PromptForm.tsx`: `<textarea>` + submit; on submit calls `aiApi.consult({ sessionId, prompt, context })` with the active view's context (city or hotel config)
    - `ConsultantMessage.tsx`: plain `<p>` text — **no avatar bubbles**, **no animated typing indicators**, **no gradient backgrounds**
    - `AiNotConfigured.tsx`: rendered when `aiApi.consult` returns `errorCode: 'ai_not_configured'`; links to the Gemini setup section of the README (task 21)
    - _Requirements: 17.2, 17.4, 20.1, 20.4, 20.5_

  - [ ] 19.2 Wire Consultant panel into pages
    - On successful `aiApi.consult` response, forward `deltas.hotel` and `deltas.simulation` to `AIConsultantContext.applyDeltas` so Discover and Sandbox re-render with the AI's applied changes
    - _Requirements: 20.2, 20.3_

  - [ ]* 19.3 Example tests for Consultant panel
    - Panel is a side panel and does not span 100vw (Requirement 20.1)
    - Rendered `ConsultantMessage` contains no `img.avatar`, no typing indicator element, no `bg-gradient-*` class (Requirement 20.4)
    - `ai_not_configured` response renders `<AiNotConfigured />` with README link (Requirement 20.5)

- [ ] 20. Add cross-cutting smoke and guard tests
  - [ ] 20.1 Repository-shape smoke tests (`backend/tests/smoke.test.ts`, `frontend/tests/smoke.test.ts`)
    - Assert workspace layout matches design (Requirements 1.1–1.5, 2.1–2.4)
    - Assert `packages/config` exports the seven named tables (Requirements 6.1–6.5)
    - Assert Mongo model registrations include `2dsphere` on `Hotels.coordinates` and `Locations.coordinates` (Requirement 4.5)

  - [ ] 20.2 Grep-guard tests
    - No `shadcn`, `@radix-ui`, `@mui`, `chakra-ui`, `antd`, `daisyui` in `frontend/package.json` dependencies (Requirement 17.2)
    - No `bg-gradient-`, `.avatar`, "typing" indicators in `components/consultant/**` (Requirement 20.4)
    - No direct `console.*` calls outside `frontend/lib/log.ts` (Requirement 21.4)
    - No `mockHotels`, `sampleHotels`, or `fakeHotels` outside `**/__tests__/**`, `**/*.test.ts`, `**/*.property.test.ts` (Requirement 5.8)
    - Simulation modules under `backend/src/simulation/` contain no numeric literals matching known config values (guard for Requirement 6.6)

- [ ] 21. Write setup documentation
  - Update root `README.md` with monorepo layout, install commands (`pnpm install`), dev commands (`pnpm --filter backend dev`, `pnpm --filter frontend dev`), and a "Setup checklist" section with anchored sub-sections for each integration
  - **Stay22 setup**: request API access via the Stay22 partner portal, confirm email, copy the issued key into `STAY22_API_KEY`, list the endpoints the scaffold consumes (search-by-city, search-by-bbox, search-by-radius) (Requirement 2.6)
  - **Gemini setup**: sign in to Google AI Studio, create an API key, list the expected model identifier `gemini-1.5-pro` (override via `GEMINI_MODEL`), paste into `GEMINI_API_KEY` (Requirement 2.7)
  - **Mapbox setup**: create a Mapbox account, mint an access token with `styles:read`, `fonts:read`, `datasets:read`, `vision:read` scopes, restrict URLs to `http://localhost:3000/*` (and prod domains later), paste into `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`, note that only domain restriction protects a browser-visible token (Requirement 2.8)
  - **MongoDB Atlas setup**: sign up, create free-tier M0 cluster, create a database user with `readWrite` on `innsight`, add developer IP (or `0.0.0.0/0`) to Network Access, copy the connection string into `MONGODB_URI` substituting the password (Requirement 2.9)
  - Add `backend/README.md` and `frontend/README.md` documenting each package's env vars and dev command
  - Add `packages/config/README.md` explaining how to tune values, plus units and ranges for each table
  - Anchor `MapNotConfigured` and `AiNotConfigured` links from tasks 17.2 and 19.1 land on the correct README sections
  - _Requirements: 2.1, 2.3, 2.4, 2.6, 2.7, 2.8, 2.9, 18.6, 20.5_

- [ ] 22. Final checkpoint — full stack integrates
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP; core implementation
  sub-tasks are never optional.
- Each task references specific requirements for traceability. Property tests additionally
  reference the property number from the design's Correctness Properties section.
- Property tests use **fast-check** via `@fast-check/vitest` with the default 100 iterations
  per property, run in the same Vitest invocation as unit tests; the `test:prop` script
  filter lets developers focus on property tests when tuning generators.
- Validation and structured logging are woven into every task that produces code — there is
  no separate "add validation later" task. `pino` on the backend, gated `console` via
  `NEXT_PUBLIC_DEBUG` on the frontend.
- All 30 correctness properties from the design map to concrete sub-tasks:
  Properties 1–18 to the simulation engine (task 8), Properties 19–23 and 30 to backend
  HTTP contracts (tasks 4.5, 11.7, 11.8), Properties 24–25 to the Stay22 client (task 6.3),
  Property 26 to the config package (task 2.4), Properties 27–29 to the AI orchestrator
  (task 12.6).
- Placeholder config values ship as part of task 2.2 with the comment
  `// placeholder — tune later`. There is no separate tuning task.
- Setup documentation for the four external credentials (Stay22, Gemini, Mapbox, MongoDB
  Atlas) is deliberately the final task because those are manual steps performed on
  external platforms; the scaffold boots and its tests pass without any credentials thanks
  to the degraded-mode design.
- **Explicit non-goals reflected in this plan**: no shadcn/ui or comparable component
  library; no chat-clone aesthetic (no full-screen chat, no avatar bubbles, no typing
  indicators, no gradient hero); frontend components are plain and swappable; every
  external API response (Stay22, Gemini) is zod-validated before use; every simulation
  output passes the bounds zod schema before leaving the backend.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "3.1", "14.1"] },
    { "id": 2, "tasks": ["2.2", "3.2", "3.3", "14.2", "15.1", "15.2", "15.3"] },
    { "id": 3, "tasks": ["2.3", "4.1", "4.2", "4.3", "4.4", "5.1", "6.1", "7.1", "16.1", "16.2"] },
    { "id": 4, "tasks": ["2.4", "4.5", "5.2", "5.3", "5.4", "6.2", "7.2", "7.3", "7.4", "7.5", "10"] },
    { "id": 5, "tasks": ["5.5", "6.3", "6.4", "7.6", "7.7", "7.8", "7.9", "7.10", "8.1", "15.4"] },
    { "id": 6, "tasks": ["8.2", "8.3", "8.4"] },
    { "id": 7, "tasks": ["8.5", "8.6", "8.7", "8.8", "8.9", "8.10", "8.11", "8.12", "8.13", "8.14", "8.15", "8.16", "8.17", "8.18", "8.19", "8.20", "8.21", "8.22", "8.23", "11.1"] },
    { "id": 8, "tasks": ["11.2", "11.3", "11.4", "11.5"] },
    { "id": 9, "tasks": ["11.6"] },
    { "id": 10, "tasks": ["11.7", "11.8", "12.1", "12.2", "12.3"] },
    { "id": 11, "tasks": ["12.4", "17.2", "18.2", "19.1"] },
    { "id": 12, "tasks": ["12.5", "17.1", "18.1", "19.2"] },
    { "id": 13, "tasks": ["12.6", "12.7", "17.3", "18.3", "19.3", "20.1", "20.2"] },
    { "id": 14, "tasks": ["21"] }
  ]
}
```
