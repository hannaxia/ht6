import type { Logger } from "pino";
import type { MongoConnection } from "../db/mongo.js";
import type { LocationDoc } from "../db/models/Location.js";
import { opportunityCellSchema } from "../schemas/grid.js";
import type {
  OpportunityCell,
  SimulationEngine,
} from "../simulation/index.js";
import type { Stay22Client } from "../stay22/client.js";
import type { CompetitorHotel } from "../simulation/types.js";

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
