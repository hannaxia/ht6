import { SimulationError } from "./errors.js";

/**
 * Occupancy (pp, 0..100) = clamp(baseDemand + locationDemand + hotelQuality
 *                                + amenityMatch − competitionPressure)
 */
export function occupancyFormula(
  baseDemand: number,
  locationDemand: number,
  hotelQuality: number,
  amenityMatch: number,
  competitionPressure: number,
): number {
  const raw =
    baseDemand + locationDemand + hotelQuality + amenityMatch - competitionPressure;
  if (!Number.isFinite(raw)) {
    throw new SimulationError("occupancy_non_finite", {
      baseDemand,
      locationDemand,
      hotelQuality,
      amenityMatch,
      competitionPressure,
    });
  }
  return Math.max(0, Math.min(100, raw));
}
