import type { LoadedConfig } from "@innsight/config";
import type { Logger } from "pino";
import { adrFormula } from "./adr.js";
import * as competition from "./competition.js";
import { locationMultiplier } from "./locationScore.js";
import { qualityMultiplier } from "./qualityScore.js";
import type {
  OpportunityCell,
  OpportunityGridInput,
} from "./types.js";

const EPSILON = 1e-9;

interface RawCell {
  coordinates: { lat: number; lng: number };
  components: OpportunityCell["components"];
}

function minMaxNormalize(values: number[]): number[] | null {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max - min <= EPSILON) return null; // constant component
  return values.map((v) => ((v - min) / (max - min)) * 100);
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
  const { north, south, east, west } = input.cityBbox;
  const n = Math.max(1, Math.floor(input.gridSize));

  // Pass 1: raw components per cell (hypothetical 4-star, 100-room midscale hotel)
  const rawCells: RawCell[] = [];
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const lat = south + ((row + 0.5) / n) * (north - south);
      const lng = west + ((col + 0.5) / n) * (east - west);
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
        components: {
          revenuePotential,
          demand,
          segmentWeightedCompetition,
          risk,
        },
      });
    }
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

  // Pass 3: weighted sum, clamped to [0, 100]
  const w = config.opportunityWeights;
  const cells = rawCells.map((cell, i) => {
    const normalized = {
      revenuePotential: normalizedByKey.revenuePotential![i]!,
      demand: normalizedByKey.demand![i]!,
      segmentWeightedCompetition:
        normalizedByKey.segmentWeightedCompetition![i]!,
      risk: normalizedByKey.risk![i]!,
    };
    const score =
      w.revenuePotential * normalized.revenuePotential +
      w.demand * normalized.demand -
      w.segmentWeightedCompetition * normalized.segmentWeightedCompetition -
      w.risk * normalized.risk;
    return {
      ...cell,
      normalized,
      opportunityScore: Math.max(0, Math.min(100, score)),
    };
  });
  log.info(
    { cells: cells.length, gridSize: n },
    "opportunity grid computed",
  );
  return cells;
}
