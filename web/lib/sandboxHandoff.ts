import type {
  HotelConfigPayload,
  LocationContext,
  Stay22Hotel,
} from "./api/schemas";
import { AMENITIES } from "../components/sandbox/amenities";

/**
 * Handoff from Market Discovery → Hotel Sandbox.
 *
 * When a user selects an existing hotel or drops a pin to place a new one on
 * the map and clicks "Configure", we stash a starting HotelConfigPayload (plus
 * a display label) in sessionStorage and route to /sandbox, which reads it once
 * on mount. sessionStorage keeps large configs out of the URL and survives the
 * client-side navigation without a global store.
 */
const HANDOFF_KEY = "innsight:sandbox-handoff";

export interface SandboxHandoff {
  label: string;
  /**
   * "existing" = cloned from a Stay22 hotel; "new" = user-placed pin;
   * "saved" = reopened from the user's saved hotels (profile or map).
   */
  origin: "existing" | "new" | "saved";
  config: HotelConfigPayload;
  /** Set when reopening a saved hotel, so Save updates it instead of forking. */
  savedHotelId?: string;
}

/** Baseline config used for a freshly placed hotel and as a mapping fallback. */
export const DEFAULT_CONFIG: HotelConfigPayload = {
  hotelType: "midscale",
  rooms: 150,
  stars: 4,
  modernity: 0.7,
  amenities: ["wifi", "breakfast"],
  targetSegment: "mixed",
  basePrice: 180,
  segmentAdrNorm: 200,
  location: {
    type: "downtown",
    scores: { transit: 0.8, airport: 0.4, tourism: 0.7, business: 0.7 },
    coordinates: { lat: 43.6532, lng: -79.3832 },
    baseDemand: 68,
    locationDemand: 6,
    locationSatisfaction: 0.15,
  },
  competitors: [],
  baseRating: 3.5,
};

const AMENITY_SET = new Set<string>(AMENITIES);

/** Map arbitrary Stay22 amenity strings onto the sandbox's known amenity set. */
function normalizeAmenities(raw: string[]): string[] {
  const matched = raw
    .map((a) => a.trim().toLowerCase().replace(/[\s-]+/g, "_"))
    .filter((a) => AMENITY_SET.has(a));
  // De-dupe while preserving order.
  return Array.from(new Set(matched));
}

/** Stars (or guest rating) → hotel type bucket. */
function starsToHotelType(stars?: number): HotelConfigPayload["hotelType"] {
  if (stars === undefined) return "midscale";
  if (stars <= 2) return "budget";
  if (stars < 4) return "midscale";
  if (stars < 5) return "upscale";
  return "luxury";
}

function clampStars(stars?: number): HotelConfigPayload["stars"] {
  const s = Math.round(stars ?? 4);
  const bounded = Math.min(5, Math.max(1, s));
  return bounded as HotelConfigPayload["stars"];
}

/**
 * Build a starting sandbox config that mirrors an existing Stay22 hotel as
 * closely as the available fields allow. Fields Stay22 does not provide
 * (demand, location scores, operating assumptions) fall back to the baseline.
 */
export function hotelToConfig(hotel: Stay22Hotel): HotelConfigPayload {
  const stars = clampStars(hotel.stars ?? hotel.rating);
  const basePrice = hotel.price?.amount ?? DEFAULT_CONFIG.basePrice;
  return {
    ...DEFAULT_CONFIG,
    hotelType: starsToHotelType(hotel.stars ?? hotel.rating),
    stars,
    basePrice,
    segmentAdrNorm: Math.round(basePrice * 1.1),
    amenities: normalizeAmenities(hotel.amenities),
    baseRating: hotel.rating ?? DEFAULT_CONFIG.baseRating,
    location: {
      ...DEFAULT_CONFIG.location,
      coordinates: { lat: hotel.coordinates.lat, lng: hotel.coordinates.lng },
    },
  };
}

/** Build a starting config for a brand-new hotel dropped at a map location. */
export function placedHotelConfig(coords: {
  lat: number;
  lng: number;
}): HotelConfigPayload {
  return {
    ...DEFAULT_CONFIG,
    location: {
      ...DEFAULT_CONFIG.location,
      coordinates: { lat: coords.lat, lng: coords.lng },
    },
  };
}

/**
 * Merge a resolved location context (real nearby inventory + seeded location
 * scores) into a config, so the sandbox starts from the actual market rather
 * than defaults. `keepBasePrice` preserves an existing hotel's own nightly
 * rate as its ADR baseline while still adopting the area's segment norm and
 * competitor set; a placed pin leaves it false to take the area median.
 */
export function applyLocationContext(
  config: HotelConfigPayload,
  ctx: LocationContext,
  { keepBasePrice = false }: { keepBasePrice?: boolean } = {},
): HotelConfigPayload {
  return {
    ...config,
    basePrice: keepBasePrice ? config.basePrice : ctx.basePrice,
    segmentAdrNorm: ctx.segmentAdrNorm,
    competitors: ctx.competitors,
    location: {
      ...config.location,
      type: ctx.location.type,
      scores: ctx.location.scores,
      coordinates: ctx.location.coordinates,
      baseDemand: ctx.location.baseDemand,
      locationDemand: ctx.location.locationDemand,
      locationSatisfaction: ctx.location.locationSatisfaction,
    },
  };
}

export function storeSandboxHandoff(handoff: SandboxHandoff): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(handoff));
  } catch {
    // sessionStorage may be unavailable (private mode / quota); the sandbox
    // simply falls back to its default config.
  }
}

/** Read and clear the handoff so a later direct visit to /sandbox is clean. */
export function consumeSandboxHandoff(): SandboxHandoff | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(HANDOFF_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(HANDOFF_KEY);
    return JSON.parse(raw) as SandboxHandoff;
  } catch {
    return null;
  }
}
