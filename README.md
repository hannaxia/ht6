# Innsight

AI-powered hospitality digital twin and hotel investment simulator.

Explore real hotel markets on a map, simulate hotels you might build or renovate, and get AI-driven insights grounded in ML predictions and a structured simulation engine.

**Every predicted metric (ADR, occupancy, revenue, rating, ROI, payback, opportunity score) is a simulation estimate — never real financial data.**

## Features

- **Market Discovery** — Interactive city map with real hotel inventory (Stay22), competitor markers, and an opportunity heatmap showing where building a hotel makes the most sense.
- **Hotel Sandbox** — Configure a hotel (type, rooms, stars, modernity, amenities, pricing) and watch predicted metrics update instantly: ADR, occupancy, rating, annual revenue, investment, ROI, and payback period. A 3D model reflects the hotel's character in real time.
- **AI Discussion** — Two Gemini-powered agents (🙂 Guest and 👔 Revenue Manager) discuss the current hotel configuration on demand. The guest speaks from a comfort/value perspective; the manager references actual predicted metrics and closes with one actionable recommendation.
- **AI Consultant** — Natural language interface powered by Gemini tool-calling. Ask "make this hotel compete with Marriott" and the consultant drives the simulation engine, explains tradeoffs, and applies changes.
- **ML Predictions** — XGBoost models trained on real Airbnb and hotel review data predict ADR, occupancy, and guest rating. Falls back transparently to deterministic formulas when the ML service is unavailable.
- **Saved Hotels** — Authenticated users can save, rename, and revisit hotel configurations.

## Repo layout

```
innsight/
├── web/               Next.js app (Market Discovery map, Hotel Sandbox, AI panels)
├── api/               Express service (simulation engine, Stay22 client, Gemini
│                      orchestrator, AI agents, MongoDB models)
├── ml/                Python ML layer (training scripts, FastAPI service, models)
├── packages/config/   @innsight/config — tunable lookup tables (amenity impact,
│                      competition weighting, cost tables)
└── .env.example       Single env template — copy to .env at the repo root
```

## Quick start

Requires Node.js ≥ 20. This is an npm workspaces monorepo.

```bash
# 1. Install all workspace dependencies
npm install

# 2. Create your env file (the app boots without keys in degraded mode)
cp .env.example .env

# 3. Run everything
npm run dev     # ML service :8000, API :4000, web :3000
```

`npm run dev` runs all three services in parallel via `concurrently`. `Ctrl+C` stops all of them.

To run services individually:

```bash
npm run dev:ml           # Python ML service on :8000
npm run dev -w api       # Express API on :4000
npm run dev -w web       # Next.js on :3000
```

The stack boots with an empty `.env` in degraded mode: the map shows a placeholder, simulations return `503`, and AI panels show "not configured". `GET http://localhost:4000/health` reports each dependency's status.

## Environment variables

All values go in the single root `.env`. See `.env.example` for the full template.

| Variable | Required | Purpose |
|---|---|---|
| `STAY22_API_KEY` | For hotel data | Real hotel inventory, prices, ratings |
| `GEMINI_API_KEY` | For AI features | AI Consultant, AI Discussion agents |
| `GEMINI_MODEL` | No | Defaults to `gemini-flash-latest` |
| `MONGODB_URI` | For persistence | Hotels, Locations, Simulations, Saved Hotels |
| `MAPBOX_ACCESS_TOKEN` | For the map | Mapbox GL tiles |
| `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` | For the map | Same token, exposed to the browser |
| `AUTH0_DOMAIN` | For auth | Auth0 tenant |
| `AUTH0_CLIENT_ID` | For auth | Auth0 app client ID |
| `AUTH0_CLIENT_SECRET` | For auth | Auth0 app secret |
| `AUTH0_SECRET` | For auth | Session cookie encryption (`openssl rand -hex 32`) |
| `APP_BASE_URL` | For auth | Public web origin (default `http://localhost:3000`) |
| `ML_SERVICE_URL` | No | Python ML service URL (default `http://localhost:8000`) |
| `PORT` | No | API port (default `4000`) |
| `LOG_LEVEL` | No | pino log level (default `info`) |
| `FRONTEND_ORIGIN` | No | CORS allowlist (default `http://localhost:3000`) |
| `NEXT_PUBLIC_BACKEND_URL` | No | API base URL for the frontend (default `http://localhost:4000`) |

## Setup checklist

### Stay22

1. Request API access at [stay22.com](https://stay22.com) (manual approval).
2. Copy the key to `STAY22_API_KEY`.
3. Run `npm run scrape:hotels -w api` to populate the Hotels collection.

### Gemini

1. Get an API key at [aistudio.google.com](https://aistudio.google.com).
2. Copy to `GEMINI_API_KEY`. Optionally set `GEMINI_MODEL` (e.g. `gemini-2.5-flash`).

### Mapbox

1. Create a token at [mapbox.com](https://mapbox.com) with `styles:read`, `fonts:read`, `datasets:read`.
2. Copy to both `MAPBOX_ACCESS_TOKEN` and `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`.

### MongoDB Atlas

1. Create a free-tier cluster at [mongodb.com/atlas](https://mongodb.com/atlas).
2. Add a `readWrite` user on the `innsight` database.
3. Copy the connection string (with db name appended) to `MONGODB_URI`.
4. Seed location data: `npm run seed:locations -w api`.

### Auth0

1. Create a Regular Web Application in the Auth0 Dashboard.
2. Set callback URL to `http://localhost:3000/auth/callback`, logout URL to `http://localhost:3000`.
3. Copy domain, client ID, and client secret to the `AUTH0_*` variables.
4. Generate `AUTH0_SECRET` with `openssl rand -hex 32`.

### ML service (optional)

```bash
# Create and activate a Python venv, then:
pip install -r ml/training/requirements.txt

# Train models (outputs to ml/models/)
cd ml/training
python train_adr.py
python train_occupancy.py
cd satisfaction
python train_rating_model.py
```

The ML service starts automatically with `npm run dev`. If models aren't trained or the service is down, the API falls back to deterministic formulas.

## Useful commands

```bash
npm run type-check     # TypeScript strict check across all workspaces
npm run build          # Build all workspaces
npm run dev            # Run ML + API + web concurrently
```

## Architecture

- **Simulation engine** (`api/src/simulation/`) — Deterministic computation in strict dependency order. Config-driven lookup tables for amenity impacts, competition weights, and cost.
- **ML layer** (`ml/`) — XGBoost regressors for ADR ($R^2 = 0.76$), occupancy, and guest rating. FastAPI service with automatic fallback.
- **AI agents** (`api/src/ai/`) — Gemini-powered consultant (tool-calling), guest agent, and revenue manager agent. Each has a scoped system prompt ensuring it stays in character.
- **Validation** — Zod schemas on every boundary: API requests, simulation outputs, Gemini responses, Stay22 data.
- **Logging** — Structured pino logs (API) and gated browser logging (web, via `NEXT_PUBLIC_DEBUG`).

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js, React, TypeScript, Tailwind CSS, Mapbox GL, deck.gl, Three.js |
| Backend | Express, TypeScript, Zod, Pino |
| ML | Python, XGBoost, FastAPI, VADER (NLP sentiment) |
| Database | MongoDB Atlas |
| AI | Google Gemini (tool-calling + scoped agents) |
| Auth | Auth0 |
| Data | Stay22 API |
