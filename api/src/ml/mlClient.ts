import type { Logger } from "pino";
import type { Readiness } from "../db/mongo.js";
import type { HotelConfig } from "../simulation/types.js";

const DEFAULT_TIMEOUT_MS = 5_000;

export interface MLClient {
  /** Predicted ADR in USD, or null on any failure — caller falls back to the deterministic formula. */
  predictAdr(config: HotelConfig): Promise<number | null>;
  /** Predicted occupancy as a 0-100 percentage (the service returns 0-1), or null on failure. */
  predictOccupancy(config: HotelConfig, predictedAdr: number): Promise<number | null>;
  /** Predicted rating on a 1.0-5.0 scale, or null on failure. */
  predictRating(config: HotelConfig): Promise<number | null>;
  /** For GET /health only — not on the hot prediction path. */
  checkHealth(): Promise<Readiness>;
}

function hotelConfigPayload(config: HotelConfig): Record<string, unknown> {
  return {
    hotelType: config.hotelType,
    rooms: config.rooms,
    stars: config.stars,
    modernity: config.modernity,
    renovationDelta: config.renovationDelta,
    amenities: config.amenities,
    location: {
      coordinates: config.location.coordinates,
      scores: config.location.scores,
    },
  };
}

/**
 * ML predictions are always optional — every method here returns null
 * instead of throwing on any failure (unset URL, timeout, non-2xx,
 * malformed response), so simulateHotel() can fall back to the
 * deterministic formula engine without a hard dependency on this service
 * being up. See ml/README.md "ML service integration".
 */
export function createMLClient(
  baseUrl: string | undefined,
  logger: Logger,
): MLClient {
  const log = logger.child({ component: "ml-client" });

  async function post(
    path: string,
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown> | null> {
    if (!baseUrl) return null; // not configured — expected, silent fallback path

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    try {
      const res = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        log.warn(
          { path, status: res.status },
          "ML service returned non-2xx; falling back to deterministic formula",
        );
        return null;
      }
      return (await res.json()) as Record<string, unknown>;
    } catch (err) {
      if (controller.signal.aborted) {
        log.warn(
          { path, timeoutMs: DEFAULT_TIMEOUT_MS },
          "ML service request timed out; falling back to deterministic formula",
        );
      } else {
        log.warn(
          { path, err },
          "ML service request failed; falling back to deterministic formula",
        );
      }
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async predictAdr(config) {
      const result = await post("/predict/adr", hotelConfigPayload(config));
      const value = result?.predicted_adr;
      return typeof value === "number" && Number.isFinite(value) && value > 0
        ? value
        : null;
    },

    async predictOccupancy(config, predictedAdr) {
      const result = await post("/predict/occupancy", {
        ...hotelConfigPayload(config),
        predicted_adr: predictedAdr,
      });
      const value = result?.predicted_occupancy;
      // Service returns a 0-1 fraction; the simulation engine works in 0-100.
      return typeof value === "number" && Number.isFinite(value)
        ? value * 100
        : null;
    },

    async predictRating(config) {
      const result = await post("/predict/rating", hotelConfigPayload(config));
      const value = result?.predicted_rating;
      return typeof value === "number" && Number.isFinite(value)
        ? value
        : null;
    },

    async checkHealth() {
      if (!baseUrl) return "not_configured";
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2_000);
      try {
        const res = await fetch(`${baseUrl}/health`, { signal: controller.signal });
        if (!res.ok) return "error";
        const body = (await res.json()) as { status?: string };
        return body.status === "ok" ? "ready" : "error";
      } catch {
        return "error";
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
