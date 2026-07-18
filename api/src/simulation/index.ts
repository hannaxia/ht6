import type { LoadedConfig } from "@innsight/config";
import type { Logger } from "pino";
import type { MLClient } from "../ml/mlClient.js";
import { adrFormula } from "./adr.js";
import * as amenityImpact from "./amenityImpact.js";
import { investmentFormula, payback, roi } from "./capex.js";
import * as competition from "./competition.js";
import { locationMultiplier } from "./locationScore.js";
import { occupancyFormula } from "./occupancy.js";
import { computeOpportunityGrid } from "./opportunityGrid.js";
import { qualityMultiplier } from "./qualityScore.js";
import { priceExpectationPenalty, ratingFormula } from "./rating.js";
import { revenueFormula } from "./revenue.js";
import type {
  HotelConfig,
  OpportunityCell,
  OpportunityGridInput,
  SimulateHotelOutput,
} from "./types.js";

export const DISCLAIMER =
  "All predicted metrics are simulation estimates and not real financial data.";

export interface SimulationEngine {
  simulateHotel(input: HotelConfig): Promise<SimulateHotelOutput>;
  computeOpportunityGrid(input: OpportunityGridInput): OpportunityCell[];
}

export function createSimulationEngine(
  config: LoadedConfig,
  logger: Logger,
  mlClient: MLClient,
): SimulationEngine {
  const log = logger.child({ component: "simulation-engine" });

  return {
    /**
     * Computation order (per CLAUDE.md — avoids circular dependencies):
     * Location/Quality → ADR → Occupancy → Revenue → Rating → CapEx → ROI → Payback.
     * Rating NEVER feeds back into ADR's quality multiplier.
     *
     * ADR, Occupancy, and Rating each try the trained ML model first
     * (ml/service/) and fall back to the deterministic formula below on any
     * failure (service down, timeout, not configured) — see ml/README.md
     * "ML service integration" for the fallback design and the known
     * approximations in the HotelConfig -> ML feature mapping. Revenue and
     * CapEx/ROI/Payback are always deterministic — there's no ML model for
     * either (see ml/README.md: no cost/investment dataset exists).
     */
    async simulateHotel(input: HotelConfig): Promise<SimulateHotelOutput> {
      // 1. Location & quality scores (user-set inputs only)
      const locMult = locationMultiplier(input.location.scores);
      const qualMult = qualityMultiplier(input.stars, input.modernity);

      // 2. Shared amenity aggregation — computed ONCE, reused by the
      // deterministic ADR/Rating fallback paths
      const amenityPctRaw = amenityImpact.aggregate(
        input.amenities,
        { hotelType: input.hotelType, locationType: input.location.type },
        config.amenityImpactTable,
      );
      const amenityPct = amenityImpact.cap(amenityPctRaw, config.amenityImpactCap);

      // 3. Shared segment-weighted competition pressure
      const competitionPP = competition.pressure(
        input,
        input.competitors,
        config.competitionWeighting,
      );

      // 4. ADR — ML primary, deterministic fallback.
      // The ML model is trained on USD-denominated Airbnb data; Innsight is
      // Canada-focused, so its output is converted to CAD immediately for
      // everything downstream (revenue, penalty, final output). The
      // occupancy model below still needs a USD-scale price feature
      // (matching its own training data) regardless of which path produced
      // `adr` — see `adrUsdForOccupancy`.
      let adrSource: "ml" | "deterministic" = "deterministic";
      let adr: number;
      let adrUsdForOccupancy: number;
      const mlAdrUsd = await mlClient.predictAdr(input);
      if (mlAdrUsd !== null) {
        adrSource = "ml";
        adrUsdForOccupancy = mlAdrUsd;
        adr = mlAdrUsd * config.usdToCadRate;
      } else {
        adr = adrFormula(input.basePrice, locMult, qualMult, amenityPct); // CAD-native (our own config)
        adrUsdForOccupancy = adr / config.usdToCadRate;
      }

      // 5. Occupancy — ML primary, deterministic fallback
      let occupancySource: "ml" | "deterministic" = "deterministic";
      let occupancy = await mlClient.predictOccupancy(input, adrUsdForOccupancy);
      if (occupancy !== null) {
        occupancy = Math.max(0, Math.min(100, occupancy));
        occupancySource = "ml";
      } else {
        const hotelQualityPP = (qualMult - 1) * 10; // quality multiplier → occupancy pp
        const amenityMatchPP = amenityPct * 0.3; // capped amenity % → occupancy pp
        occupancy = occupancyFormula(
          input.location.baseDemand,
          input.location.locationDemand,
          hotelQualityPP,
          amenityMatchPP,
          competitionPP,
        );
      }

      // 6. Revenue (always deterministic math on whichever adr/occupancy above)
      const revenue = revenueFormula(input.rooms, adr, occupancy);

      // 7. Rating — ML primary, deterministic fallback (uses ADR, never the reverse)
      let ratingSource: "ml" | "deterministic" = "deterministic";
      const amenitySatisfaction = amenityPct / 50; // same aggregation, rating points
      const penalty = priceExpectationPenalty(adr, input.segmentAdrNorm);
      let rating = await mlClient.predictRating(input);
      if (rating !== null) {
        rating = Math.max(1.0, Math.min(5.0, rating));
        ratingSource = "ml";
      } else {
        rating = ratingFormula(
          input.baseRating,
          amenitySatisfaction,
          input.location.locationSatisfaction,
          penalty,
        );
      }

      // 8. CapEx / ROI / Payback — always deterministic, see docstring above
      const investment = investmentFormula(input, config.costTable);
      const annualOperatingProfit = revenue * config.operatingMargin;
      if (annualOperatingProfit === 0) {
        log.warn(
          { rooms: input.rooms, adr, occupancy },
          "annual operating profit is zero — payback is infinite, roi is zero",
        );
      }
      const roiValue = roi(annualOperatingProfit, investment);
      const paybackYears = payback(annualOperatingProfit, investment);

      const output: SimulateHotelOutput = {
        adr,
        occupancy,
        revenue,
        rating,
        investment,
        annualOperatingProfit,
        roi: roiValue,
        paybackYears,
        intermediates: {
          locationMultiplier: locMult,
          qualityMultiplier: qualMult,
          amenityImpactPct: amenityPct,
          competitionPressure: competitionPP,
          amenitySatisfaction,
          priceExpectationPenalty: penalty,
        },
        disclaimer: DISCLAIMER,
      };
      log.debug(
        {
          adr,
          occupancy,
          revenue,
          rating,
          investment,
          roi: roiValue,
          paybackYears,
          adrSource,
          occupancySource,
          ratingSource,
        },
        "simulateHotel computed",
      );
      return output;
    },

    computeOpportunityGrid(input: OpportunityGridInput): OpportunityCell[] {
      // Deliberately NOT ML-integrated: this fans out across every grid
      // cell (100+ per request) — calling the ML service that many times
      // per heatmap request would be slow. Stays fully deterministic.
      return computeOpportunityGrid(input, config, log);
    },
  };
}

export { SimulationError } from "./errors.js";
export type {
  CompetitorHotel,
  HotelConfig,
  HotelType,
  LocationScores,
  LocationType,
  OpportunityCell,
  OpportunityGridInput,
  SimulateHotelOutput,
} from "./types.js";
