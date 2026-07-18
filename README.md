# Innsight

AI-powered hospitality digital twin and hotel investment simulator (ht6 2026).
Explore real hotel markets on a map, simulate hotels you might build or
renovate, and get AI consulting grounded in the same simulation engine.

**Every predicted metric (ADR, occupancy, revenue, rating, ROI, payback,
opportunity score) is a simulation estimate — never real financial data.**

## Repo layout

```
innsight/
├── web/               Next.js app (Market Discovery map, Hotel Sandbox, AI panel)
├── api/               Express service (simulation engine, Stay22 client, Gemini
│                      orchestrator, MongoDB models)
├── packages/config/   @innsight/config — tunable lookup tables (amenity impact,
│                      competition weighting, cost tables) with zod validation
├── .env.example       The single env template — copy to .env at the repo root
└── CLAUDE.md          Project brief / domain model source of truth
```

Both apps read the **single root `.env`** — there are no per-package `.env`
files to keep in sync.

## Quick start

```bash
# 1. Install pnpm if you don't have it
npm install -g pnpm

# 2. Install all workspace dependencies
pnpm install

# 3. Create your env file (fill in keys later — the app boots without them)
cp .env.example .env

# 4. Run both apps (two terminals)
pnpm --filter @innsight/api dev     # Express API on http://localhost:4000
pnpm --filter @innsight/web dev     # Next.js on http://localhost:3000
```

The stack **boots and runs with an empty `.env`** in degraded mode: the map
shows a "not configured" placeholder, hotel lists are empty, simulations and
the heatmap return `503 database_unavailable`, and the AI panel shows "Gemini
not configured". `GET http://localhost:4000/health` reports each dependency as
`ready`, `not_configured`, or `error`.

Useful workspace commands:

```bash
pnpm type-check     # TypeScript strict check across all workspaces
pnpm build          # Build all workspaces
```

## Setup checklist (work to be done outside this repo)

These four steps happen on external platforms and cannot be automated from
this codebase. After each one, paste the value into the root `.env` and
restart the dev processes.

### Stay22

Stay22 is the sole source of real hotel market data. Without it the map has
no hotels and competitor analysis is empty. **The scaffold never fabricates
hotel data as a substitute.**

1. Request API access via the Stay22 partner portal (https://stay22.com) —
   this is a manual approval process, not self-serve; do it early.
2. Once approved, copy the issued key into `STAY22_API_KEY` in `.env`.
3. The scaffold consumes hotel search by city, bounding box, and radius
   (see `api/src/stay22/client.ts`).
4. **Important:** `api/src/stay22/schemas.ts` and the base URL in
   `api/src/stay22/client.ts` encode an assumed response shape — confirm both
   against the API docs Stay22 gives you with access, and adjust in those two
   files (they are the only places the wire format lives). Every response is
   zod-validated; malformed records are logged and discarded, never passed on.

### Gemini (Google AI Studio)

1. Sign in at https://aistudio.google.com.
2. Click **Get API key** → create key in a new project.
3. Copy it into `GEMINI_API_KEY` in `.env`.
4. Default model is `gemini-1.5-pro`; override with `GEMINI_MODEL` if needed.

### Mapbox

1. Create an account at https://mapbox.com.
2. Go to **Access tokens** → create a token with scopes `styles:read`,
   `fonts:read`, `datasets:read`.
3. Restrict the token's URLs to `http://localhost:3000/*` (add production
   domains later). The token is visible in the browser — the URL restriction
   is what protects it.
4. Copy it into both `MAPBOX_ACCESS_TOKEN` and
   `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` in `.env`.

### MongoDB Atlas

1. Sign up at https://mongodb.com/atlas and create a **free-tier M0 cluster**.
2. **Database Access** → add a database user with `readWrite` on the
   `innsight` database.
3. **Network Access** → add your current IP (or `0.0.0.0/0` for the
   hackathon).
4. **Connect → Drivers** → copy the connection string, substitute your
   password, append the db name (e.g. `...mongodb.net/innsight`), and paste
   into `MONGODB_URI` in `.env`.

### Remaining work after keys are in

- **Seed the `Locations` collection for Toronto.** The opportunity heatmap
  reads per-area scores (tourism/business/transit/density) from the
  `Locations` collection. Cells with no nearby Location doc fall back to
  neutral scores, so the heatmap is flat until real location data is loaded.
  Write a small seed script (e.g. `api/src/scripts/seedLocations.ts`) with
  real Toronto neighbourhood data.
- **Confirm the Stay22 wire format** (see the Stay22 section above) and run a
  real search to verify records flow through validation into the map.
- **Tune the config tables.** Everything in `packages/config/src/` is marked
  `placeholder — tune later`: amenity impacts, competition weights, cost
  tables, operating margin, risk/opportunity weights.

## Environment variables (root `.env`)

| Variable | Used by | Purpose |
|---|---|---|
| `STAY22_API_KEY` | api | Stay22 hotel market data |
| `GEMINI_API_KEY` | api | AI consultant (Gemini) |
| `GEMINI_MODEL` | api | Optional; defaults to `gemini-1.5-pro` |
| `MONGODB_URI` | api | MongoDB Atlas connection string |
| `PORT` | api | API port (default 4000) |
| `LOG_LEVEL` | api | pino level (default `info`) |
| `FRONTEND_ORIGIN` | api | CORS allowlist (default `http://localhost:3000`) |
| `MAPBOX_ACCESS_TOKEN` / `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` | web | Mapbox GL map tiles |
| `NEXT_PUBLIC_BACKEND_URL` | web | API base URL (default `http://localhost:4000`) |
| `NEXT_PUBLIC_DEBUG` | web | `true` enables verbose browser logging |

## Architecture notes

- **Validation everywhere:** every Stay22 response, every Gemini tool call and
  final response, every simulation request body, and every simulation output
  is zod-validated. Out-of-bounds simulation results are rejected server-side
  (`simulation_output_invalid`), malformed external records are logged and
  discarded.
- **Logging:** the API uses structured `pino` logs (request completion entries
  with method/path/status/duration, error entries with stacks, per-component
  child loggers). The web app routes all diagnostics through `web/lib/log.ts`,
  gated by `NEXT_PUBLIC_DEBUG`.
- **Simulation domain model** (formulas, computation order, amenity capping,
  segment-weighted competition): see `CLAUDE.md` — the engine in
  `api/src/simulation/` implements it directly, with all tunable constants in
  `packages/config/`.
