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
// Stay22 paginates at DEFAULT_PAGE_SIZE per request; a single page only
// covers whichever subset of the bounding box the API returns first, which
// clusters markers in one area instead of spreading them across the map.
// Fetch multiple pages (up to this many results) so the full search area is
// represented.
const MAX_RESULTS = 300;
// Stay22 only returns availability for the requested stay window; a single
// window misses hotels that are booked out or not listed for those exact
// dates. Querying multiple 30-night windows and merging by id surfaces more
// of the total inventory in an area while still deriving a nightly average
// from each hotel's own 30-day rate data.
const STAY_WINDOW_OFFSETS_DAYS = [30, 60];
const STAY_WINDOW_LENGTH_DAYS = 30;

// Stay22's standard tier caps at 150 req/min on a sliding window (see
// https://dev.stay22.com/docs/api/rate-limits). A fixed per-item delay in
// caller loops (e.g. the scrape script) isn't reliable — pages-per-item
// varies, so the real request rate can still exceed the limit and start
// returning 429s. This module-level limiter enforces a hard cap on actual
// requests sent, shared across every call made through this client within
// the process, regardless of caller. Kept below 150 for headroom.
const MAX_REQUESTS_PER_WINDOW = 120;
const RATE_WINDOW_MS = 60_000;
const requestTimestamps: number[] = [];

async function waitForRateLimitSlot(): Promise<void> {
  for (;;) {
    const now = Date.now();
    while (
      requestTimestamps.length > 0 &&
      now - requestTimestamps[0]! >= RATE_WINDOW_MS
    ) {
      requestTimestamps.shift();
    }
    if (requestTimestamps.length < MAX_REQUESTS_PER_WINDOW) {
      requestTimestamps.push(now);
      return;
    }
    const waitMs = RATE_WINDOW_MS - (now - requestTimestamps[0]!) + 50;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}

const RETRY_DELAYS_MS = [1_000, 3_000, 8_000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface Stay22SearchOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
  /**
   * Caps how many of STAY_WINDOW_OFFSETS_DAYS are queried (default: all).
   * Bulk/scrape callers pass a low value to keep per-call request volume
   * small — live/interactive callers should leave this unset.
   */
  maxWindows?: number;
  /** Caps pages fetched per stay window (default: unlimited, up to MAX_RESULTS). */
  maxPagesPerWindow?: number;
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

/** A 30-night stay window `offsetDays` out; keeps pricing in results. */
function stayDates(offsetDays: number): { checkin: string; checkout: string } {
  const checkin = new Date();
  checkin.setDate(checkin.getDate() + offsetDays);
  const checkout = new Date(checkin);
  checkout.setDate(checkout.getDate() + STAY_WINDOW_LENGTH_DAYS);
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

  async function fetchPage(
    params: Record<string, string>,
    page: number,
    checkin: string,
    checkout: string,
    opts?: Stay22SearchOptions,
  ): Promise<{
    results: unknown[];
    meta: { nights?: number | null; currency?: string; hasMore?: boolean };
  } | null> {
    const url = new URL(`${STAY22_BASE_URL}/accommodations`);
    url.searchParams.set("checkin", checkin);
    url.searchParams.set("checkout", checkout);
    url.searchParams.set("pageSize", String(DEFAULT_PAGE_SIZE));
    url.searchParams.set("page", String(page));
    // Innsight is a Canada-focused product — ask Stay22 for CAD directly
    // (their own live FX) rather than converting USD ourselves.
    url.searchParams.set("currency", "CAD");
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

    let raw: unknown;
    for (let attempt = 0; ; attempt++) {
      await waitForRateLimitSlot();

      const controller = new AbortController();
      const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      opts?.signal?.addEventListener("abort", () => controller.abort());

      try {
        const res = await fetch(url, {
          // Confirmed 2026-07-18 against https://dev.stay22.com/docs/api/authentication.
          headers: { "X-API-KEY": apiKey!, Accept: "application/json" },
          signal: controller.signal,
        });
        if (res.status === 429 && attempt < RETRY_DELAYS_MS.length) {
          const delay = RETRY_DELAYS_MS[attempt]!;
          log.warn(
            { url: url.toString(), attempt, delay },
            "Stay22 rate-limited (429); retrying with backoff",
          );
          await sleep(delay);
          continue;
        }
        if (!res.ok) {
          log.warn(
            { url: url.toString(), status: res.status },
            "Stay22 returned non-2xx; returning []",
          );
          return null;
        }
        raw = await res.json();
        break;
      } catch (err) {
        if (controller.signal.aborted) {
          log.warn({ timeoutMs }, "Stay22 request timed out; returning []");
        } else {
          log.warn({ err }, "Stay22 request failed; returning []");
        }
        return null;
      } finally {
        clearTimeout(timer);
      }
    }

    const envelope = stay22EnvelopeSchema.safeParse(raw);
    if (!envelope.success) {
      log.error(
        { issues: envelope.error.issues },
        "Stay22 response envelope failed validation; returning []",
      );
      return null;
    }
    return { results: envelope.data.results, meta: envelope.data.meta };
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

    const byId = new Map<string, Stay22Hotel>();
    let totalReceived = 0;
    let totalDiscarded = 0;
    let totalPages = 0;

    const windows = opts?.maxWindows
      ? STAY_WINDOW_OFFSETS_DAYS.slice(0, opts.maxWindows)
      : STAY_WINDOW_OFFSETS_DAYS;

    for (const offsetDays of windows) {
      const { checkin, checkout } = stayDates(offsetDays);
      const windowRecords: unknown[] = [];
      let nights: number | null | undefined;
      let currency: string | undefined;
      let page = 1;
      for (;;) {
        const pageResult = await fetchPage(
          params,
          page,
          checkin,
          checkout,
          opts,
        );
        if (pageResult === null) break;
        windowRecords.push(...pageResult.results);
        nights = pageResult.meta.nights;
        currency = pageResult.meta.currency;
        totalPages += 1;
        const gotFullPage = pageResult.results.length === DEFAULT_PAGE_SIZE;
        const hitPageCap =
          opts?.maxPagesPerWindow !== undefined &&
          page >= opts.maxPagesPerWindow;
        if (
          !pageResult.meta.hasMore ||
          !gotFullPage ||
          hitPageCap ||
          windowRecords.length >= MAX_RESULTS
        ) {
          break;
        }
        page += 1;
      }

      totalReceived += windowRecords.length;
      windowRecords.forEach((record, index) => {
        const parsed = stay22AccommodationSchema.safeParse(record);
        if (!parsed.success) {
          log.warn(
            { index, issues: parsed.error.issues },
            "Stay22 record failed validation; discarded",
          );
          totalDiscarded += 1;
          return;
        }
        const mapped = mapAccommodationToHotel(parsed.data, nights, currency);
        if (mapped === null) {
          log.warn(
            { index, id: parsed.data.id },
            "Stay22 record has no usable coordinates; discarded",
          );
          totalDiscarded += 1;
          return;
        }
        // Merge across windows: keep the first occurrence (earliest, closest
        // date window) rather than overwriting with later-window pricing.
        if (!byId.has(mapped.id)) byId.set(mapped.id, mapped);
      });

      if (byId.size >= MAX_RESULTS) break;
    }

    const valid = [...byId.values()];
    log.info(
      {
        windowsSearched: windows.length,
        pagesFetched: totalPages,
        received: totalReceived,
        uniqueValid: valid.length,
        discarded: totalDiscarded,
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
