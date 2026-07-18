import type { Logger } from "pino";
import { amenityImpactCap, amenityImpactTable } from "./amenityImpact.js";
import { competitionWeighting } from "./competition.js";
import { costTable } from "./cost.js";
import { operatingMargin } from "./operating.js";
import { opportunityWeights } from "./opportunity.js";
import { riskWeights } from "./risk.js";
import { configSchema, type LoadedConfig } from "./schemas.js";

export { amenityImpactCap, amenityImpactTable } from "./amenityImpact.js";
export type { AmenityImpactEntry } from "./amenityImpact.js";
export { competitionWeighting } from "./competition.js";
export type { CompetitionWeighting } from "./competition.js";
export { costTable } from "./cost.js";
export type { CostTable } from "./cost.js";
export { operatingMargin } from "./operating.js";
export { opportunityWeights } from "./opportunity.js";
export type { OpportunityWeights } from "./opportunity.js";
export { riskWeights } from "./risk.js";
export type { RiskWeights } from "./risk.js";
export { configSchema } from "./schemas.js";
export type { LoadedConfig } from "./schemas.js";

/**
 * Assembles and validates every config table. Logs a structured `error`
 * entry and throws if any table fails its zod schema.
 */
export function loadConfig(logger: Logger): LoadedConfig {
  const config = {
    amenityImpactTable,
    amenityImpactCap,
    competitionWeighting,
    costTable,
    operatingMargin,
    riskWeights,
    opportunityWeights,
  };
  const parsed = configSchema.safeParse(config);
  if (!parsed.success) {
    logger.error(
      { issues: parsed.error.issues },
      "config package failed validation",
    );
    throw new Error("Invalid config package");
  }
  logger.info(
    {
      amenities: Object.keys(config.amenityImpactTable).length,
      amenityImpactCap: config.amenityImpactCap,
      operatingMargin: config.operatingMargin,
    },
    "config package loaded and validated",
  );
  return parsed.data;
}
