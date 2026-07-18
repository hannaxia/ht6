/**
 * City reference data for the demo — shared by hotel search (radius/bbox)
 * and the opportunity grid. Geographic/economic constants, not market data.
 *
 * Stay22's `address=` free-text search and plain bounding-box search are
 * NOT distance-sorted — the first page of a city-wide box can land
 * anywhere within it (confirmed live: an unbounded "toronto" address
 * search returned only listings 9-26km from downtown, and a bbox reaching
 * north to Vaughan returned mostly Vaughan listings). `lat/lng/radius`
 * search IS distance-sorted from the center point, which is why hotel
 * lookups below use `center`, not the wider `bbox`.
 */
export interface CityDef {
  /** Distance-sorted searches (hotel markers) anchor here. */
  center: { lat: number; lng: number };
  /** Default radius for center-anchored hotel search, in km. */
  defaultRadiusKm: number;
  /**
   * Wider box for the opportunity grid — intentionally kept inside the
   * city's actual boundary (e.g. Toronto's north edge is Steeles Ave,
   * ~43.78; going further north pulls in Vaughan/Markham/Richmond Hill).
   */
  bbox: { north: number; south: number; east: number; west: number };
  // placeholder — tune later
  basePrice: number;
  segmentAdrNorm: number;
  baseDemand: number;
}

export const CITIES: Record<string, CityDef> = {
  toronto: {
    center: { lat: 43.6532, lng: -79.3832 },
    defaultRadiusKm: 8,
    bbox: { north: 43.78, south: 43.58, east: -79.12, west: -79.64 },
    basePrice: 180,
    segmentAdrNorm: 200,
    baseDemand: 68,
  },
};

export function lookupCity(city: string): CityDef | undefined {
  return CITIES[city.toLowerCase()];
}
