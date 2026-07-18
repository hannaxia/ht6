/**
 * Price expectation penalty in rating points, monotone non-decreasing in ADR.
 * Overpriced vs segment norm → growing penalty; underpriced → small bonus
 * (bounded at −0.25). Guarded when the norm is unknown.
 */
export function priceExpectationPenalty(
  adr: number,
  segmentAdrNorm: number,
): number {
  if (segmentAdrNorm <= 0) return 0;
  const ratio = adr / segmentAdrNorm;
  return Math.max(-0.25, 0.5 * Math.log(ratio));
}

/**
 * Rating = clamp[1.0, 5.0](base + amenitySatisfaction + locationSatisfaction − penalty)
 * amenitySatisfaction derives from the SAME capped amenity aggregation as ADR.
 */
export function ratingFormula(
  baseRating: number,
  amenitySatisfaction: number,
  locationSatisfaction: number,
  penalty: number,
): number {
  const raw = baseRating + amenitySatisfaction + locationSatisfaction - penalty;
  return Math.max(1.0, Math.min(5.0, raw));
}
