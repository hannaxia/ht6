import type { Logger } from "pino";
import type { HotelDoc } from "../db/models/Hotel.js";
import type { LocationDoc } from "../db/models/Location.js";
import type { MongoConnection } from "../db/mongo.js";
import { opportunityCellSchema } from "../schemas/grid.js";
import type {
  OpportunityCell,
  SimulationEngine,
} from "../simulation/index.js";
import type { CompetitorHotel } from "../simulation/types.js";
import type { Stay22Client } from "../stay22/client.js";

/**
 * City bounding boxes for the demo. Extend as cities are added. Geographic
 * constants, not market data.
 */
const CITY_BBOXES: Record<
  string,
  { north: number; south: number; east: number; west: number }
> = {
  toronto: { north: 43.85, south: 43.58, east: -79.12, west: -79.64 },
};

/** City-level baseline economics. */
// placeholder — tune later
const CITY_BASELINES: Record<
  string,
  { basePrice: number; segmentAdrNorm: number; baseDemand: number }
> = {
  toronto: { basePrice: 180, segmentAdrNorm: 200, baseDemand: 68 },
};

export class UnknownCityError extends Error {
  constructor(city: string) {
    super(`city "${city}" has no configured bounding box`);
    this.name = "UnknownCityError";
  }
}

function nearestLocation(
  locations: LocationDoc[],
  coord: { lat: number; lng: number },
): LocationDoc | undefined {
  let best: LocationDoc | undefined;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const loc of locations) {
    const [lng, lat] = loc.coordinates.coordinates;
    const d = (lat! - coord.lat) ** 2 + (lng! - coord.lng) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = loc;
    }
  }
  return best;
}

/**
 * Builds the opportunity grid for a city. Location scores come from the
 * Locations collection (nearest doc per cell); cells with no Location data
 * fall back to neutral scores — clearly model inputs, not fabricated hotels.
 * Competitors come from validated Stay22 records only.
 */
export async function computeCityOpportunityGrid(
  city: string,
  gridSize: number,
  engine: SimulationEngine,
  mongo: MongoConnection,
  stay22: Stay22Client,
  logger: Logger,
): Promise<OpportunityCell[]> {
  const cityKey = city.toLowerCase();
  const bbox = CITY_BBOXES[cityKey];
  const baseline = CITY_BASELINES[cityKey];
  if (!bbox || !baseline) throw new UnknownCityError(city);

  const [locations, stay22Hotels] = await Promise.all([
    mongo.models.Location.find({ city: new RegExp(`^${cityKey}$`, "i") })
      .lean<LocationDoc[]>()
      .exec(),
    stay22.searchByBoundingBox(bbox),
  ]);
  logger.info(
    { city, locations: locations.length, competitors: stay22Hotels.length },
    "opportunity grid inputs loaded",
  );

  const competitors: CompetitorHotel[] = stay22Hotels.map((h) => ({
    stars: h.stars,
    pricePerNight: h.price?.per === "night" ? h.price.amount : undefined,
    coordinates: h.coordinates,
  }));

  const cells = engine.computeOpportunityGrid({
    city,
    gridSize,
    cityBbox: bbox,
    competitors,
    cellContextResolver: (coord) => {
      const near = nearestLocation(locations, coord);
      const scores = near
        ? {
            transit: near.transit_score,
            airport: 0.3,
            tourism: near.tourism_score,
            business: near.business_score,
          }
        : { transit: 0.5, airport: 0.3, tourism: 0.5, business: 0.5 };
      const hotelDensity = near?.hotel_density ?? 0;
      return {
        basePrice: baseline.basePrice,
        segmentAdrNorm: baseline.segmentAdrNorm,
        location: {
          type: "downtown",
          scores,
          coordinates: coord,
          baseDemand: baseline.baseDemand,
          locationDemand:
            10 * (scores.tourism + scores.business) - 5,
          locationSatisfaction: 0.3 * scores.transit - 0.1,
        },
        volatility: 0.4,
        relConstructionCost: 1,
        demandConcentration: Math.min(1, hotelDensity / 20),
      };
    },
  });

  // Discard any out-of-bounds cell before it leaves the backend.
  const valid: OpportunityCell[] = [];
  for (const cell of cells) {
    const parsed = opportunityCellSchema.safeParse(cell);
    if (parsed.success) {
      valid.push(cell);
    } else {
      logger.warn(
        { cell: cell.coordinates, issues: parsed.error.issues },
        "opportunity cell failed bounds validation; discarded",
      );
    }
  }
  return valid;
}

/** Generic baseline economics for areas without seeded Location data. */
const GENERIC_BASELINE = { basePrice: 140, segmentAdrNorm: 160, baseDemand: 55 };

// Grid resolution (NxN cells) generated per place. Toronto gets a much
// finer grid since it has real per-neighbourhood Location data to show;
// other places get a coarser (but still solidly tiled) grid since
// GENERIC_BASELINE has no spatial variation to resolve anyway, and there
// are ~300+ places to cover — raised from the original 16/6 because at
// low resolution, even edge-to-edge square cells read as sparse dots
// rather than a filled region once rendered on the map.
const TORONTO_GRID_RESOLUTION = 40;
const PLACE_GRID_RESOLUTION = 14;
// Minimum half-padding (degrees) around a place's hotel bounding box, so a
// single-hotel town still gets a small tiled area instead of one point.
const MIN_PADDING_DEG = 0.02;

/** Generates an NxN grid of cell-center coordinates (with size) over a bbox. */
function gridCoordinates(
  bbox: { north: number; south: number; east: number; west: number },
  n: number,
): { lat: number; lng: number; cellHalfDegLat: number; cellHalfDegLng: number }[] {
  const cellHalfDegLat = (bbox.north - bbox.south) / n / 2;
  const cellHalfDegLng = (bbox.east - bbox.west) / n / 2;
  const coords: {
    lat: number;
    lng: number;
    cellHalfDegLat: number;
    cellHalfDegLng: number;
  }[] = [];
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      coords.push({
        lat: bbox.south + ((row + 0.5) / n) * (bbox.north - bbox.south),
        lng: bbox.west + ((col + 0.5) / n) * (bbox.east - bbox.west),
        cellHalfDegLat,
        cellHalfDegLng,
      });
    }
  }
  return coords;
}

/**
 * Builds an opportunity grid covering every area where the Hotels
 * collection has inventory, instead of a single hardcoded city. For each
 * distinct scraped place (grouped by the `city` field written by
 * scrapeCanadianHotels.ts), generates a tiled NxN grid over that place's
 * hotel bounding box (padded so cells are contiguous, not a single point) —
 * a fine even grid over a whole-country bbox would be almost entirely
 * empty land/water, so cells are anchored to where hotels actually exist,
 * but each place still gets full local coverage rather than one dot.
 *
 * Toronto keeps its real Location-collection-backed scores (tourism,
 * business, transit, density) from computeCityOpportunityGrid's usual
 * path. Every other place uses GENERIC_BASELINE / neutral location scores
 * since no per-neighbourhood data has been seeded for them — those scores
 * are more likely to end up flat/uniform within a given town, which
 * correctly reflects the lack of real local input data rather than
 * fabricating variation that isn't there.
 */
const NATIONWIDE_CACHE_SCOPE = "nationwide";
// Recompute if the cache is older than this — the underlying hotel data
// only changes when scrapeCanadianHotels.ts is re-run, but a soft TTL
// guards against a cache silently going stale forever if that's forgotten.
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h

/**
 * Computing the nationwide grid means scanning the full Hotels collection
 * and running the simulation engine over thousands of cells — reading it
 * back from a cache document is much cheaper than recomputing on every
 * page load. Pass forceRecompute=true to bypass the cache (e.g. after a
 * fresh scrape).
 */
export async function computeNationwideOpportunityGrid(
  engine: SimulationEngine,
  mongo: MongoConnection,
  logger: Logger,
  forceRecompute = false,
): Promise<{ cells: OpportunityCell[]; cached: boolean }> {
  if (!forceRecompute) {
    const cached = await mongo.models.OpportunityGridCache.findOne({
      scope: NATIONWIDE_CACHE_SCOPE,
    })
      .lean<{ cells: OpportunityCell[]; computedAt: Date }>()
      .exec();
    if (
      cached &&
      Date.now() - new Date(cached.computedAt).getTime() < CACHE_MAX_AGE_MS
    ) {
      logger.info(
        { cells: cached.cells.length, computedAt: cached.computedAt },
        "nationwide opportunity grid served from cache",
      );
      return { cells: cached.cells, cached: true };
    }
  }

  const hotels = await mongo.models.Hotel.find({})
    .lean<HotelDoc[]>()
    .exec();
  if (hotels.length === 0) {
    logger.warn("no hotels in database; nationwide grid is empty");
    return { cells: [], cached: false };
  }

  const byPlace = new Map<string, HotelDoc[]>();
  for (const h of hotels) {
    const key = h.city ?? "unknown";
    const list = byPlace.get(key);
    if (list) list.push(h);
    else byPlace.set(key, [h]);
  }

  const torontoLocations = await mongo.models.Location.find({
    city: /^toronto$/i,
  })
    .lean<LocationDoc[]>()
    .exec();

  // Per place: a tiled grid over that place's hotel bounding box (padded
  // so cells are contiguous), instead of a single centroid point — a lone
  // point per place is why the map showed isolated dots instead of
  // continuous coverage.
  const cellCoordinates: {
    lat: number;
    lng: number;
    cellHalfDegLat: number;
    cellHalfDegLng: number;
  }[] = [];
  for (const [place, placeHotels] of byPlace) {
    if (place.toLowerCase() === "toronto" && CITY_BBOXES.toronto) {
      cellCoordinates.push(
        ...gridCoordinates(CITY_BBOXES.toronto, TORONTO_GRID_RESOLUTION),
      );
      continue;
    }

    let minLat = Number.POSITIVE_INFINITY;
    let maxLat = Number.NEGATIVE_INFINITY;
    let minLng = Number.POSITIVE_INFINITY;
    let maxLng = Number.NEGATIVE_INFINITY;
    for (const h of placeHotels) {
      const [lng, lat] = h.coordinates.coordinates;
      minLat = Math.min(minLat, lat!);
      maxLat = Math.max(maxLat, lat!);
      minLng = Math.min(minLng, lng!);
      maxLng = Math.max(maxLng, lng!);
    }
    const padLat = Math.max(MIN_PADDING_DEG, (maxLat - minLat) * 0.3);
    const padLng = Math.max(MIN_PADDING_DEG, (maxLng - minLng) * 0.3);
    const bbox = {
      north: maxLat + padLat,
      south: minLat - padLat,
      east: maxLng + padLng,
      west: minLng - padLng,
    };
    cellCoordinates.push(...gridCoordinates(bbox, PLACE_GRID_RESOLUTION));
  }

  const competitors: CompetitorHotel[] = hotels.map((h) => ({
    stars: h.stars,
    pricePerNight: h.price?.per === "night" ? h.price.amount : undefined,
    coordinates: { lat: h.coordinates.coordinates[1]!, lng: h.coordinates.coordinates[0]! },
  }));

  const cells = engine.computeOpportunityGrid({
    city: "canada",
    gridSize: 0, // unused when cellCoordinates is provided
    cityBbox: { north: 90, south: -90, east: 180, west: -180 },
    competitors,
    cellCoordinates,
    cellContextResolver: (coord) => {
      const isToronto =
        coord.lat >= 43.58 &&
        coord.lat <= 43.85 &&
        coord.lng >= -79.64 &&
        coord.lng <= -79.12;
      const torontoBaseline = CITY_BASELINES.toronto;
      if (isToronto && torontoBaseline) {
        const near = nearestLocation(torontoLocations, coord);
        const scores = near
          ? {
              transit: near.transit_score,
              airport: 0.3,
              tourism: near.tourism_score,
              business: near.business_score,
            }
          : { transit: 0.5, airport: 0.3, tourism: 0.5, business: 0.5 };
        const hotelDensity = near?.hotel_density ?? 0;
        return {
          basePrice: torontoBaseline.basePrice,
          segmentAdrNorm: torontoBaseline.segmentAdrNorm,
          location: {
            type: "downtown",
            scores,
            coordinates: coord,
            baseDemand: torontoBaseline.baseDemand,
            locationDemand: 10 * (scores.tourism + scores.business) - 5,
            locationSatisfaction: 0.3 * scores.transit - 0.1,
          },
          volatility: 0.4,
          relConstructionCost: 1,
          demandConcentration: Math.min(1, hotelDensity / 20),
        };
      }

      const scores = { transit: 0.5, airport: 0.3, tourism: 0.5, business: 0.5 };
      return {
        basePrice: GENERIC_BASELINE.basePrice,
        segmentAdrNorm: GENERIC_BASELINE.segmentAdrNorm,
        location: {
          type: "downtown",
          scores,
          coordinates: coord,
          baseDemand: GENERIC_BASELINE.baseDemand,
          locationDemand: 0,
          locationSatisfaction: 0,
        },
        volatility: 0.5,
        relConstructionCost: 1,
        demandConcentration: 0,
      };
    },
  });

  const valid: OpportunityCell[] = [];
  for (const cell of cells) {
    const parsed = opportunityCellSchema.safeParse(cell);
    if (parsed.success) {
      valid.push(cell);
    } else {
      logger.warn(
        { cell: cell.coordinates, issues: parsed.error.issues },
        "nationwide opportunity cell failed bounds validation; discarded",
      );
    }
  }
  logger.info(
    { places: byPlace.size, cells: valid.length },
    "nationwide opportunity grid computed",
  );

  await mongo.models.OpportunityGridCache.updateOne(
    { scope: NATIONWIDE_CACHE_SCOPE },
    { $set: { cells: valid, computedAt: new Date() } },
    { upsert: true },
  );
  logger.info({ scope: NATIONWIDE_CACHE_SCOPE }, "nationwide grid cache updated");

  return { cells: valid, cached: false };
}
