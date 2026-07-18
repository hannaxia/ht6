import type { Logger } from "pino";
import type { HotelDoc } from "../db/models/Hotel.js";
import type { MongoConnection } from "../db/mongo.js";
import type { Stay22Client } from "../stay22/client.js";
import type { Stay22Hotel } from "../stay22/schemas.js";

export interface HotelSearchParams {
  city?: string;
  bbox?: string; // "west,south,east,north"
  lat?: number;
  lng?: number;
  radiusKm?: number;
}

function hotelDocToStay22Hotel(doc: HotelDoc): Stay22Hotel {
  const [lng, lat] = doc.coordinates.coordinates;
  return {
    id: doc.stayId,
    name: doc.name,
    supplier: doc.supplier,
    coordinates: { lat: lat!, lng: lng! },
    city: doc.city,
    country: doc.country,
    stars: doc.stars,
    rating: doc.rating,
    price: doc.price,
    amenities: doc.amenities,
    images: doc.images,
  };
}

/**
 * Serves hotel markers from the `Hotels` collection instead of calling
 * Stay22 live. Stay22's standard tier caps at 150 req/min, and a discover
 * page fanning out to many regions on every load would burn through that
 * quickly; instead `scrapeCanadianHotels.ts` populates the collection
 * out-of-band (run manually or on a schedule), and this just reads it back.
 * Never fabricates data — an empty collection stays empty.
 */
export async function searchHotelsFromDb(
  mongo: MongoConnection,
  params: HotelSearchParams,
  logger: Logger,
): Promise<Stay22Hotel[]> {
  const query: Record<string, unknown> = {};
  if (params.city) {
    query.city = new RegExp(`^${params.city}$`, "i");
  } else if (params.bbox) {
    const [west, south, east, north] = params.bbox.split(",").map(Number);
    query.coordinates = {
      $geoWithin: {
        $box: [
          [west, south],
          [east, north],
        ],
      },
    };
  } else if (
    params.lat !== undefined &&
    params.lng !== undefined &&
    params.radiusKm !== undefined
  ) {
    query.coordinates = {
      $nearSphere: {
        $geometry: { type: "Point", coordinates: [params.lng, params.lat] },
        $maxDistance: params.radiusKm * 1000,
      },
    };
  } else {
    logger.warn({ params }, "hotel search called without usable parameters");
    return [];
  }

  const docs = await mongo.models.Hotel.find(query).lean<HotelDoc[]>().exec();
  return docs.map(hotelDocToStay22Hotel);
}

/**
 * Thin orchestration over the Stay22 client for live (non-DB-backed) calls
 * — used by the opportunity grid's competitor lookup, and by scrape
 * scripts. Records are already validated by the client; this never
 * fabricates data — empty results stay empty.
 */
export async function searchHotelsLive(
  stay22: Stay22Client,
  params: HotelSearchParams,
  logger: Logger,
): Promise<Stay22Hotel[]> {
  if (params.city) {
    return stay22.searchByCity(params.city);
  }
  if (params.bbox) {
    const [west, south, east, north] = params.bbox.split(",").map(Number);
    return stay22.searchByBoundingBox({
      west: west!,
      south: south!,
      east: east!,
      north: north!,
    });
  }
  if (
    params.lat !== undefined &&
    params.lng !== undefined &&
    params.radiusKm !== undefined
  ) {
    return stay22.searchByRadius(
      { lat: params.lat, lng: params.lng },
      params.radiusKm,
    );
  }
  logger.warn({ params }, "hotel search called without usable parameters");
  return [];
}
