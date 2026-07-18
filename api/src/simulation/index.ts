import type { LoadedConfig } from "@innsight/config";
import type { Logger } from "pino";
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
  simulateHotel(input: HotelConfig): SimulateHotelOutput;
  computeOpportunityGrid(input: OpportunityGridInput): OpportunityCell[];
}

export function createSimulationEngine(
  config: LoadedConfig,
  logger: Logger,
): SimulationEngine {
  const log = logger.child({ component: "simulation-engine" });

  return {
    /**
     * Computation order (per CLAUDE.md — avoids circular dependencies):
     * Location/Quality → ADR → Occupancy → Revenue → Rating → CapEx → ROI → Payback.
     * Rating NEVER feeds back into ADR's quality multiplier.
     */
    simulateHotel(input: HotelConfig): SimulateHotelOutput {
      // 1. Location & quality scores (user-set inputs only)
      const locMult = locationMultiplier(input.location.scores);
      const qualMult = qualityMultiplier(input.stars, input.modernity);

      // 2. Shared amenity aggregation — computed ONCE, reused by ADR and Rating
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

      // 4. ADR
      const adr = adrFormula(input.basePrice, locMult, qualMult, amenityPct);

      // 5. Occupancy
      const hotelQualityPP = (qualMult - 1) * 10; // quality multiplier → occupancy pp
      const amenityMatchPP = amenityPct * 0.3; // capped amenity % → occupancy pp
      const occupancy = occupancyFormula(
        input.location.baseDemand,
        input.location.locationDemand,
        hotelQualityPP,
        amenityMatchPP,
        competitionPP,
      );

      // 6. Revenue
      const revenue = revenueFormula(input.rooms, adr, occupancy);

      // 7. Rating (uses ADR, never the reverse)
      const amenitySatisfaction = amenityPct / 50; // same aggregation, rating points
      const penalty = priceExpectationPenalty(adr, input.segmentAdrNorm);
      const rating = ratingFormula(
        input.baseRating,
        amenitySatisfaction,
        input.location.locationSatisfaction,
        penalty,
      );

      // 8. CapEx / ROI / Payback
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
        },
        "simulateHotel computed",
      );
      return output;
    },

    computeOpportunityGrid(input: OpportunityGridInput): OpportunityCell[] {
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
