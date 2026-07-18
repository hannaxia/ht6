/**
 * Context-dependent amenity impact, in percentage points.
 * Keys inside each entry are hotel types or location types; `_default` is the
 * fallback when neither the hotel type nor the location type has an entry.
 */
export interface AmenityImpactEntry {
  _default?: number;
  [contextKey: string]: number | undefined;
}

// placeholder — tune later
export const amenityImpactTable: Record<string, AmenityImpactEntry> = {
  pool: { _default: 3, resort: 15, business_district: 2, luxury: 6 },
  spa: { _default: 2, resort: 10, luxury: 8, upscale: 5 },
  gym: { _default: 2, business_district: 5, upscale: 3 },
  restaurant: { _default: 3, luxury: 6, resort: 5 },
  bar: { _default: 2, luxury: 4, resort: 3 },
  wifi: { _default: 1, business_district: 3 },
  parking: { _default: 2, suburban: 5, airport: 6 },
  breakfast: { _default: 2, midscale: 4, business_district: 4 },
  coworking: { _default: 1, business_district: 10, downtown: 6, resort: 0 },
  ev_charging: { _default: 2, suburban: 4, airport: 3 },
  conference_rooms: { _default: 1, business_district: 8, downtown: 5 },
  rooftop_bar: { _default: 2, downtown: 6, luxury: 5 },
  airport_shuttle: { _default: 1, airport: 8 },
  smart_rooms: { _default: 2, luxury: 4, business_district: 3 },
  pet_friendly: { _default: 2, suburban: 3 },
};

/** Aggregated amenity impact is clamped to ±this many percentage points. */
export const amenityImpactCap = 25;
