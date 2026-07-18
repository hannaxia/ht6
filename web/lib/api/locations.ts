import { fetchJson } from "./client";
import { opportunityGridResponseSchema } from "./schemas";

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
};
