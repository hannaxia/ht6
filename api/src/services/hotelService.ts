import type { Logger } from "pino";
import type { Stay22Client } from "../stay22/client.js";
import type { Stay22Hotel } from "../stay22/schemas.js";

export interface HotelSearchParams {
  city?: string;
  bbox?: string; // "west,south,east,north"
  lat?: number;
  lng?: number;
  radiusKm?: number;
}

/**
 * Thin orchestration over the Stay22 client. Records are already validated by
 * the client; this never fabricates data — empty results stay empty.
 */
export async function searchHotels(
  stay22: Stay22Client,
  params: HotelSearchParams,
  logger: Logger,
): Promise<Stay22Hotel[]> {
  if (params.city) {
    return stay22.searchByCity(params.city);
  }
  if (params.bbox) {
    const [west, south, east, north] = params.bbox.split(",").map(Number);
    return stay22.searchByBoundingBox({
      west: west!,
      south: south!,
      east: east!,
      north: north!,
    });
  }
  if (
    params.lat !== undefined &&
    params.lng !== undefined &&
    params.radiusKm !== undefined
  ) {
    return stay22.searchByRadius(
      { lat: params.lat, lng: params.lng },
      params.radiusKm,
    );
  }
  logger.warn({ params }, "hotel search called without usable parameters");
  return [];
}
