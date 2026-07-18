import type { Logger } from "pino";
import type { Env } from "../env.js";
import type { Readiness } from "../db/mongo.js";
import {
  mapAccommodationToHotel,
  stay22AccommodationSchema,
  stay22EnvelopeSchema,
  type Stay22Hotel,
} from "./schemas.js";

const DEFAULT_TIMEOUT_MS = 10_000;
const STAY22_BASE_URL =
  process.env.STAY22_BASE_URL ?? "https://api.stay22.com/v2";
const DEFAULT_PAGE_SIZE = 50;

export interface Stay22SearchOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface Stay22Client {
  readonly readiness: Readiness;
  searchByCity(city: string, opts?: Stay22SearchOptions): Promise<Stay22Hotel[]>;
  searchByBoundingBox(
    bbox: BoundingBox,
    opts?: Stay22SearchOptions,
  ): Promise<Stay22Hotel[]>;
  searchByRadius(
    center: { lat: number; lng: number },
    radiusKm: number,
    opts?: Stay22SearchOptions,
  ): Promise<Stay22Hotel[]>;
}

/** A stay window far enough out to have availability; keeps pricing in results. */
function defaultStayDates(): { checkin: string; checkout: string } {
  const checkin = new Date();
  checkin.setDate(checkin.getDate() + 30);
  const checkout = new Date(checkin);
  checkout.setDate(checkout.getDate() + 1);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { checkin: fmt(checkin), checkout: fmt(checkout) };
}

export function createStay22Client(env: Env, logger: Logger): Stay22Client {
  const apiKey = env.STAY22_API_KEY;
  const log = logger.child({ component: "stay22-client" });

  if (!apiKey) {
    log.warn(
      { variable: "STAY22_API_KEY" },
      "STAY22_API_KEY is not set — Stay22 client returns empty results (no fabricated data)",
    );
  }

  async function request(
    params: Record<string, string>,
    opts?: Stay22SearchOptions,
  ): Promise<Stay22Hotel[]> {
    if (!apiKey) {
      log.warn(
        { params },
        "Stay22 request skipped: client is not_configured; returning []",
      );
      return [];
    }

    const { checkin, checkout } = defaultStayDates();
    const url = new URL(`${STAY22_BASE_URL}/accommodations`);
    url.searchParams.set("checkin", checkin);
    url.searchParams.set("checkout", checkout);
    url.searchParams.set("pageSize", String(DEFAULT_PAGE_SIZE));
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

    const controller = new AbortController();
    const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    opts?.signal?.addEventListener("abort", () => controller.abort());

    let raw: unknown;
    try {
      const res = await fetch(url, {
        // Confirmed 2026-07-18 against https://dev.stay22.com/docs/api/authentication.
        headers: { "X-API-KEY": apiKey, Accept: "application/json" },
        signal: controller.signal,
      });
      if (!res.ok) {
        log.warn(
          { url: url.toString(), status: res.status },
          "Stay22 returned non-2xx; returning []",
        );
        return [];
      }
      raw = await res.json();
    } catch (err) {
      if (controller.signal.aborted) {
        log.warn({ timeoutMs }, "Stay22 request timed out; returning []");
      } else {
        log.warn({ err }, "Stay22 request failed; returning []");
      }
      return [];
    } finally {
      clearTimeout(timer);
    }

    const envelope = stay22EnvelopeSchema.safeParse(raw);
    if (!envelope.success) {
      log.error(
        { issues: envelope.error.issues },
        "Stay22 response envelope failed validation; returning []",
      );
      return [];
    }

    const valid: Stay22Hotel[] = [];
    envelope.data.results.forEach((record, index) => {
      const parsed = stay22AccommodationSchema.safeParse(record);
      if (!parsed.success) {
        log.warn(
          { index, issues: parsed.error.issues },
          "Stay22 record failed validation; discarded",
        );
        return;
      }
      const mapped = mapAccommodationToHotel(
        parsed.data,
        envelope.data.meta.nights,
        envelope.data.meta.currency,
      );
      if (mapped === null) {
        log.warn(
          { index, id: parsed.data.id },
          "Stay22 record has no usable coordinates; discarded",
        );
        return;
      }
      valid.push(mapped);
    });
    log.info(
      {
        received: envelope.data.results.length,
        valid: valid.length,
        discarded: envelope.data.results.length - valid.length,
      },
      "Stay22 search completed",
    );
    return valid;
  }

  return {
    get readiness(): Readiness {
      return apiKey ? "ready" : "not_configured";
    },
    searchByCity(city, opts) {
      return request({ address: city }, opts);
    },
    searchByBoundingBox(bbox, opts) {
      return request(
        {
          swlat: String(bbox.south),
          swlng: String(bbox.west),
          nelat: String(bbox.north),
          nelng: String(bbox.east),
        },
        opts,
      );
    },
    searchByRadius(center, radiusKm, opts) {
      return request(
        {
          lat: String(center.lat),
          lng: String(center.lng),
          radius: String(Math.round(radiusKm * 1000)), // Stay22 radius is meters
        },
        opts,
      );
    },
  };
}
