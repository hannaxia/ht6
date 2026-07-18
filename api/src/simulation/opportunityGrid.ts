import type { LoadedConfig } from "@innsight/config";
import type { Logger } from "pino";
import { adrFormula } from "./adr.js";
import * as competition from "./competition.js";
import { isInLakeOntario } from "./lakeOntarioBoundary.js";
import { locationMultiplier } from "./locationScore.js";
import { qualityMultiplier } from "./qualityScore.js";
import type {
  OpportunityCell,
  OpportunityGridInput,
} from "./types.js";

const EPSILON = 1e-9;

interface RawCell {
  coordinates: { lat: number; lng: number };
  cellHalfDegLat: number;
  cellHalfDegLng: number;
  components: OpportunityCell["components"];
}

function minMaxNormalize(values: number[]): number[] | null {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max - min <= EPSILON) return null; // constant component
  return values.map((v) => ((v - min) / (max - min)) * 100);
}

/**
 * Maps each value to its percentile position (0-100) within the array. Ties
 * share the averaged (midrank) percentile so identical scores get identical
 * colors. Robust to skew and outliers by construction — the output is always
 * an even spread across [0, 100], which is exactly what a legible heatmap
 * needs. A single value maps to 50 (no meaningful ranking with one point).
 */
function percentileRank(values: number[]): number[] {
  const n = values.length;
  if (n <= 1) return values.map(() => 50);
  const order = values
    .map((v, i) => ({ v, i }))
    .sort((a, b) => a.v - b.v);
  const result = new Array<number>(n);
  let k = 0;
  while (k < n) {
    let j = k;
    while (j < n && order[j]!.v === order[k]!.v) j++;
    const pct = ((k + j - 1) / 2 / (n - 1)) * 100; // midrank of the tie group
    for (let m = k; m < j; m++) result[order[m]!.i] = pct;
    k = j;
  }
  return result;
}

/**
 * Three passes: raw components → min-max normalize to [0,100] → weighted sum.
 * Falls back to a uniform score of 50 when the grid is empty or any
 * component is constant across the grid.
 */
export function computeOpportunityGrid(
  input: OpportunityGridInput,
  config: LoadedConfig,
  logger: Logger,
): OpportunityCell[] {
  const log = logger.child({ component: "opportunity-grid", city: input.city });

  // Cell centers: either an explicit list (nationwide grid, anchored to
  // where hotels actually exist, with per-cell sizing) or the default even
  // NxN grid over cityBbox (single-city grids, e.g. Toronto).
  let cellCenters: {
    lat: number;
    lng: number;
    cellHalfDegLat: number;
    cellHalfDegLng: number;
  }[];
  if (input.cellCoordinates) {
    cellCenters = input.cellCoordinates;
  } else {
    const { north, south, east, west } = input.cityBbox;
    const n = Math.max(1, Math.floor(input.gridSize));
    const cellHalfDegLat = (north - south) / n / 2;
    const cellHalfDegLng = (east - west) / n / 2;
    cellCenters = [];
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        cellCenters.push({
          lat: south + ((row + 0.5) / n) * (north - south),
          lng: west + ((col + 0.5) / n) * (east - west),
          cellHalfDegLat,
          cellHalfDegLng,
        });
      }
    }
  }

  // Pass 1: raw components per cell (hypothetical 4-star, 100-room midscale hotel)
  // Cells centered on open water are skipped entirely — a hotel can't be
  // built on a lake, so there's no meaningful opportunity score for that
  // point. Only Lake Ontario is checked today since it's the only body of
  // water this app currently has fine-grained coverage near (Toronto);
  // extend with more lake polygons as needed for other waterfront areas.
  let skippedWaterCells = 0;
  const rawCells: RawCell[] = [];
  for (const { lat, lng, cellHalfDegLat, cellHalfDegLng } of cellCenters) {
    if (isInLakeOntario(lng, lat)) {
      skippedWaterCells += 1;
      continue;
    }
    const ctx = input.cellContextResolver({ lat, lng });

    const locMult = locationMultiplier(ctx.location.scores);
    const qualMult = qualityMultiplier(4, 0.7);
    const adr = adrFormula(ctx.basePrice, locMult, qualMult, 0);
    const baselineOccupancy = Math.max(
      0,
      Math.min(100, ctx.location.baseDemand + ctx.location.locationDemand),
    );
    const revenuePotential = adr * (baselineOccupancy / 100) * 365; // per-room USD
    const demand = ctx.location.baseDemand + ctx.location.locationDemand;
    const segmentWeightedCompetition = competition.pressure(
      {
        stars: 4,
        hotelType: "midscale",
        segmentAdrNorm: ctx.segmentAdrNorm,
        location: ctx.location,
      },
      input.competitors,
      config.competitionWeighting,
    );
    const risk =
      config.riskWeights.volatility * ctx.volatility +
      config.riskWeights.relConstructionCost * ctx.relConstructionCost +
      config.riskWeights.demandConcentration * ctx.demandConcentration;

    rawCells.push({
      coordinates: { lat, lng },
      cellHalfDegLat,
      cellHalfDegLng,
      components: {
        revenuePotential,
        demand,
        segmentWeightedCompetition,
        risk,
      },
    });
  }

  if (rawCells.length === 0) {
    log.warn("opportunity grid is empty; returning no cells");
    return [];
  }

  // Pass 2: normalize each component across the grid
  const componentKeys = [
    "revenuePotential",
    "demand",
    "segmentWeightedCompetition",
    "risk",
  ] as const;
  const normalizedByKey: Partial<
    Record<(typeof componentKeys)[number], number[]>
  > = {};
  let constantComponent: string | null = null;
  for (const key of componentKeys) {
    const normalized = minMaxNormalize(rawCells.map((c) => c.components[key]));
    if (normalized === null) {
      constantComponent = key;
      break;
    }
    normalizedByKey[key] = normalized;
  }

  // Fallback: constant component → every cell scores 50
  if (constantComponent !== null) {
    log.warn(
      { constantComponent, cells: rawCells.length },
      "a grid component is constant; falling back to uniform opportunityScore 50",
    );
    return rawCells.map((cell) => ({
      ...cell,
      normalized: {
        revenuePotential: 50,
        demand: 50,
        segmentWeightedCompetition: 50,
        risk: 50,
      },
      opportunityScore: 50,
    }));
  }

  // Pass 3: weighted sum → percentile rank as the final 0-100 score.
  //
  // The weighted sum alone is min-max normalized per component, which across
  // a nationwide grid is dominated by the single highest-opportunity metro —
  // every other location collapses toward 0 and the old `Math.max(0, ...)`
  // clamp then floored all the negatives, leaving ~96% of cells at exactly 0
  // (a useless, uniformly-red heatmap). Percentile-ranking the raw weighted
  // sum instead guarantees a full, evenly-spread 0-100 gradient regardless of
  // how skewed the underlying distribution is, and is the more honest framing:
  // opportunity here is inherently relative ("this location ranks above that
  // one"), so the score literally *is* a percentile.
  const w = config.opportunityWeights;
  const rawScores = rawCells.map((_, i) => {
    const nr = normalizedByKey.revenuePotential![i]!;
    const nd = normalizedByKey.demand![i]!;
    const nc = normalizedByKey.segmentWeightedCompetition![i]!;
    const nk = normalizedByKey.risk![i]!;
    return (
      w.revenuePotential * nr +
      w.demand * nd -
      w.segmentWeightedCompetition * nc -
      w.risk * nk
    );
  });
  const percentiles = percentileRank(rawScores);

  const cells = rawCells.map((cell, i) => ({
    ...cell,
    normalized: {
      revenuePotential: normalizedByKey.revenuePotential![i]!,
      demand: normalizedByKey.demand![i]!,
      segmentWeightedCompetition: normalizedByKey.segmentWeightedCompetition![i]!,
      risk: normalizedByKey.risk![i]!,
    },
    opportunityScore: percentiles[i]!,
  }));
  log.info(
    { cells: cells.length, candidateCells: cellCenters.length, skippedWaterCells },
    "opportunity grid computed",
  );
  return cells;
}
