import { fetchJson } from "./client";
import {
  locationContextResponseSchema,
  opportunityGridResponseSchema,
} from "./schemas";

export const locationsApi = {
  opportunityGrid(params: { city: string; gridSize?: number }) {
    const search = new URLSearchParams({ city: params.city });
    if (params.gridSize) search.set("gridSize", String(params.gridSize));
    return fetchJson(
      `/locations/opportunity-grid?${search.toString()}`,
      { method: "GET" },
      opportunityGridResponseSchema,
    );
  },

  /**
   * Resolves a coordinate's market/location context (real nearby inventory +
   * seeded location scores) to seed a sandbox hotel accurately.
   */
  context(params: { lat: number; lng: number; excludeHotelId?: string }) {
    const search = new URLSearchParams({
      lat: String(params.lat),
      lng: String(params.lng),
    });
    if (params.excludeHotelId) {
      search.set("excludeHotelId", params.excludeHotelId);
    }
    return fetchJson(
      `/locations/context?${search.toString()}`,
      { method: "GET" },
      locationContextResponseSchema,
    );
  },
};
