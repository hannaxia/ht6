import type { CompetitionWeighting } from "@innsight/config";
import type { CompetitorHotel, HotelConfig } from "./types.js";

const EARTH_RADIUS_KM = 6371;

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/**
 * Segment-weighted competition pressure in occupancy percentage points.
 * A competitor contributes more the closer it is in star level, hotel type,
 * and price band to the subject, and the closer it is geographically.
 */
export function pressure(
  subject: Pick<
    HotelConfig,
    "stars" | "hotelType" | "segmentAdrNorm" | "location"
  >,
  competitors: CompetitorHotel[],
  weights: CompetitionWeighting,
): number {
  let total = 0;
  for (const competitor of competitors) {
    const distanceKm = haversineKm(
      subject.location.coordinates,
      competitor.coordinates,
    );
    if (distanceKm > weights.radiusKm) continue;

    // 1 at distance 0, linear falloff to 0 at radiusKm
    const distanceFactor = 1 - distanceKm / weights.radiusKm;

    // Star proximity: 1 when equal, falls off per star of difference
    const starDiff =
      competitor.stars !== undefined
        ? Math.abs(subject.stars - competitor.stars)
        : 2; // unknown stars → assume moderately distant
    const starFactor = Math.max(0, 1 - (starDiff / 4) * weights.starLevelWeight);

    // Type match bonus
    const typeFactor =
      competitor.hotelType !== undefined &&
      competitor.hotelType === subject.hotelType
        ? 1
        : 1 - weights.typeMatchWeight * 0.5;

    // Price band proximity
    let priceFactor = 0.75; // unknown price → assume moderately close
    if (
      competitor.pricePerNight !== undefined &&
      subject.segmentAdrNorm > 0
    ) {
      const bandDiff =
        Math.abs(competitor.pricePerNight - subject.segmentAdrNorm) /
        weights.priceBandUsd;
      priceFactor = Math.max(0, 1 - (bandDiff / 4) * weights.priceBandWeight);
    }

    total +=
      weights.pressurePerCompetitor *
      distanceFactor *
      starFactor *
      typeFactor *
      priceFactor;
  }
  return total;
}
