import type { LoadedConfig } from "@innsight/config";
import type { HotelType, LocationType } from "./types.js";

type AmenityImpactTable = LoadedConfig["amenityImpactTable"];

/**
 * Shared amenity aggregation: sums each active amenity's context-dependent
 * percentage-point impact (hotelType → locationType → _default → 0).
 * Order-independent by construction.
 */
export function aggregate(
  amenities: string[],
  context: { hotelType: HotelType; locationType: LocationType },
  table: AmenityImpactTable,
): number {
  return amenities.reduce((sum, amenity) => {
    const entry = table[amenity];
    const pp =
      entry?.[context.hotelType] ??
      entry?.[context.locationType] ??
      entry?.["_default"] ??
      0;
    return sum + pp;
  }, 0);
}

/** Clamp aggregated impact to [-capPP, +capPP] — a single multiplier, never compounding. */
export function cap(raw: number, capPP: number): number {
  return Math.max(-capPP, Math.min(capPP, raw));
}
