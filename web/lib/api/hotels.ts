import { fetchJson } from "./client";
import { hotelsListResponseSchema } from "./schemas";

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
};
