# @innsight/config

Tunable market assumptions for the Innsight simulation engine. Formula code in
`api/src/simulation/` contains **no market constants** — everything lives here
and is zod-validated at API startup (`loadConfig`).

All current values are placeholders marked `// placeholder — tune later`.

| Module | Export | Units / range |
|---|---|---|
| `amenityImpact.ts` | `amenityImpactTable` | Percentage points of ADR impact per amenity, keyed by hotel type or location type, `_default` fallback |
| `amenityImpact.ts` | `amenityImpactCap` | Max ±pp of total amenity impact (25) |
| `competition.ts` | `competitionWeighting` | Segment-proximity weights; `radiusKm` limits which competitors count |
| `cost.ts` | `costTable` | USD: per-room by type×stars, per-amenity install, renovation per room |
| `operating.ts` | `operatingMargin` | Fraction of revenue kept as operating profit (0–1, default 0.32) |
| `risk.ts` | `riskWeights` | Weights on volatility / relative construction cost / demand concentration |
| `opportunity.ts` | `opportunityWeights` | Weighted-sum weights for the normalized heatmap components |

Tuning: edit the table, run `pnpm type-check`, restart the API. If a value
violates its schema (negative cost, missing star level, etc.) the API logs a
structured error naming the field and refuses to start.
