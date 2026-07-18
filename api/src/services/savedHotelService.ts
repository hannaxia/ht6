import mongoose from "mongoose";
import type { Logger } from "pino";
import type { SavedHotelDoc } from "../db/models/SavedHotel.js";
import type { MongoConnection } from "../db/mongo.js";
import type {
  SavedHotelResponse,
  SavedHotelUpsert,
} from "../schemas/savedHotel.js";

function toResponse(doc: SavedHotelDoc): SavedHotelResponse {
  const [lng, lat] = doc.coordinates.coordinates;
  return {
    id: String(doc._id),
    name: doc.name,
    // Persisted config was validated by hotelConfigSchema on write; the DB
    // stores it as a loose document, so restore the response's typed shape.
    config: doc.config as SavedHotelResponse["config"],
    metrics: doc.metrics ?? null,
    coordinates: { lat: lat!, lng: lng! },
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

/**
 * Extracts [lng, lat] from a config's location coordinates for the GeoJSON
 * Point index. Falls back to [0, 0] only if somehow absent (schema validation
 * upstream should prevent that).
 */
function coordsFromConfig(config: Record<string, unknown>): [number, number] {
  const location = config.location as
    | { coordinates?: { lat?: number; lng?: number } }
    | undefined;
  const lat = location?.coordinates?.lat ?? 0;
  const lng = location?.coordinates?.lng ?? 0;
  return [lng, lat];
}

/** Create a new saved hotel, or update an existing one owned by the caller. */
export async function upsertSavedHotel(
  input: SavedHotelUpsert,
  mongo: MongoConnection,
  logger: Logger,
): Promise<SavedHotelResponse | null> {
  const coordinates = {
    type: "Point" as const,
    coordinates: coordsFromConfig(input.config),
  };

  if (input.id) {
    if (!mongoose.Types.ObjectId.isValid(input.id)) return null;
    const updated = await mongo.models.SavedHotel.findOneAndUpdate(
      { _id: input.id, userId: input.sessionId },
      {
        $set: {
          name: input.name,
          config: input.config,
          metrics: input.metrics ?? null,
          coordinates,
        },
      },
      { new: true },
    )
      .lean<SavedHotelDoc>()
      .exec();
    if (!updated) return null; // not found or not owned by caller
    logger.info(
      { savedHotelId: input.id, userId: input.sessionId },
      "saved hotel updated",
    );
    return toResponse(updated);
  }

  const created = await mongo.models.SavedHotel.create({
    userId: input.sessionId,
    name: input.name,
    config: input.config,
    metrics: input.metrics ?? null,
    coordinates,
  });
  logger.info(
    { savedHotelId: String(created._id), userId: input.sessionId },
    "saved hotel created",
  );
  return toResponse(created.toObject() as SavedHotelDoc);
}

export async function listSavedHotels(
  sessionId: string,
  mongo: MongoConnection,
  logger: Logger,
): Promise<SavedHotelResponse[]> {
  const docs = await mongo.models.SavedHotel.find({ userId: sessionId })
    .sort({ updatedAt: -1 })
    .lean<SavedHotelDoc[]>()
    .exec();
  logger.info({ userId: sessionId, count: docs.length }, "saved hotels listed");
  return docs.map(toResponse);
}

export async function getSavedHotel(
  id: string,
  sessionId: string,
  mongo: MongoConnection,
): Promise<SavedHotelResponse | null> {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  const doc = await mongo.models.SavedHotel.findOne({
    _id: id,
    userId: sessionId,
  })
    .lean<SavedHotelDoc>()
    .exec();
  return doc ? toResponse(doc) : null;
}

export async function deleteSavedHotel(
  id: string,
  sessionId: string,
  mongo: MongoConnection,
  logger: Logger,
): Promise<boolean> {
  if (!mongoose.Types.ObjectId.isValid(id)) return false;
  const res = await mongo.models.SavedHotel.deleteOne({
    _id: id,
    userId: sessionId,
  }).exec();
  const deleted = res.deletedCount === 1;
  if (deleted) {
    logger.info({ savedHotelId: id, userId: sessionId }, "saved hotel deleted");
  }
  return deleted;
}
