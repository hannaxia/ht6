import { fetchJson } from "./client";
import { hotelsListResponseSchema, roomEstimateResponseSchema } from "./schemas";

export const hotelsApi = {
  list(params: { city?: string; bbox?: string }) {
    const search = new URLSearchParams();
    if (params.city) search.set("city", params.city);
    if (params.bbox) search.set("bbox", params.bbox);
    return fetchJson(
      `/hotels?${search.toString()}`,
      { method: "GET" },
      hotelsListResponseSchema,
    );
  },
  /**
   * Lazily estimates (and server-side caches) a hotel's room count — Stay22
   * doesn't provide it. First call per hotel triggers a Gemini lookup;
   * later calls are served from cache. May return `rooms: null` if no
   * confident answer was found — callers should fall back to a default.
   */
  estimateRooms(stayId: string) {
    return fetchJson(
      `/hotels/${encodeURIComponent(stayId)}/estimate-rooms`,
      { method: "POST" },
      roomEstimateResponseSchema,
    );
  },
};
