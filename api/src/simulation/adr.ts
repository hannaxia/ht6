import { SimulationError } from "./errors.js";

/**
 * ADR = basePrice × locationMultiplier × qualityMultiplier × (1 + cappedAmenityPct/100)
 * cappedAmenityPct is percentage points, e.g. 18 for +18%.
 */
export function adrFormula(
  basePrice: number,
  locationMultiplier: number,
  qualityMultiplier: number,
  cappedAmenityPct: number,
): number {
  const adr =
    basePrice *
    locationMultiplier *
    qualityMultiplier *
    (1 + cappedAmenityPct / 100);
  if (!Number.isFinite(adr) || adr <= 0) {
    throw new SimulationError("adr_non_positive", {
      basePrice,
      locationMultiplier,
      qualityMultiplier,
      cappedAmenityPct,
    });
  }
  return adr;
}
