import { z } from "zod";
import { fetchJson } from "./client";
import {
  savedHotelListResponseSchema,
  savedHotelResponseSchema,
  type HotelConfigPayload,
  type SimulateHotelOutput,
} from "./schemas";

export const savedHotelsApi = {
  /** List the caller's saved hotels. */
  list(sessionId: string) {
    const search = new URLSearchParams({ sessionId });
    return fetchJson(
      `/saved-hotels?${search.toString()}`,
      { method: "GET" },
      savedHotelListResponseSchema,
    );
  },

  /** Create a new saved hotel, or update an existing one when `id` is set. */
  save(params: {
    sessionId: string;
    id?: string;
    name: string;
    isCustom?: boolean;
    config: HotelConfigPayload;
    metrics?: SimulateHotelOutput | null;
  }) {
    return fetchJson(
      "/saved-hotels",
      {
        method: "POST",
        body: JSON.stringify({
          sessionId: params.sessionId,
          id: params.id,
          name: params.name,
          isCustom: params.isCustom,
          config: params.config,
          metrics: params.metrics ?? null,
        }),
      },
      savedHotelResponseSchema,
    );
  },

  /** Delete a saved hotel owned by the caller. */
  remove(id: string, sessionId: string) {
    const search = new URLSearchParams({ sessionId });
    return fetchJson(
      `/saved-hotels/${encodeURIComponent(id)}?${search.toString()}`,
      { method: "DELETE" },
      z.object({ deleted: z.boolean() }),
    );
  },
};
