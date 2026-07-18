/**
 * Segment-proximity weights for competition pressure. A nearby competitor
 * contributes more pressure the closer it is in star level, hotel type, and
 * price band to the subject hotel.
 */
// placeholder — tune later
export const competitionWeighting = {
  /** Pressure falloff per full star of difference (1.0 = full falloff weight). */
  starLevelWeight: 1.0,
  /** Extra pressure multiplier when hotel types match. */
  typeMatchWeight: 0.6,
  /** Pressure falloff per price band of difference. */
  priceBandWeight: 0.8,
  /** Only competitors within this radius contribute pressure. */
  radiusKm: 3,
  /** Percentage points of occupancy pressure contributed by a perfectly matched competitor. */
  pressurePerCompetitor: 1.5,
  /** Price band width in USD used when bucketing competitor nightly prices. */
  priceBandUsd: 50,
};

export type CompetitionWeighting = typeof competitionWeighting;
