import { Router } from "express";
import type { AppDependencies } from "../app.js";
import { estimateRoomCount } from "../ai/roomLookup.js";
import { hotelsQuerySchema } from "../schemas/hotel.js";
import { searchHotelsFromDb } from "../services/hotelService.js";

export function hotelsRouter(deps: AppDependencies): Router {
  const router = Router();
  router.get("/", async (req, res, next) => {
    const parsed = hotelsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        errorCode: "invalid_request",
        message: "Query parameters failed validation.",
        details: { issues: parsed.error.issues },
      });
      return;
    }
    if (deps.mongo.readiness !== "ready") {
      res.status(503).json({
        errorCode: "database_unavailable",
        message: "MongoDB is not available.",
      });
      return;
    }
    try {
      // Served from the Hotels collection (populated by
      // `pnpm --filter @innsight/api scrape:hotels`), not a live Stay22
      // call — keeps page loads fast and off Stay22's rate limit.
      const hotels = await searchHotelsFromDb(deps.mongo, parsed.data, req.log);
      res.json({ hotels, source: "Stay22" });
    } catch (err) {
      next(err);
    }
  });

  // Lazily estimates and caches a hotel's total room/unit count — Stay22
  // doesn't provide it, so the first "Configure" click on a given hotel
  // triggers a one-shot Gemini lookup (see ai/roomLookup.ts); every
  // subsequent click for that same hotel is served from the cache with no
  // further LLM calls.
  router.post("/:stayId/estimate-rooms", async (req, res, next) => {
    if (deps.mongo.readiness !== "ready") {
      res.status(503).json({
        errorCode: "database_unavailable",
        message: "MongoDB is not available.",
      });
      return;
    }
    try {
      const doc = await deps.mongo.models.Hotel.findOne({
        stayId: req.params.stayId,
      }).exec();
      if (!doc) {
        res.status(404).json({
          errorCode: "not_found",
          message: "No hotel with that id.",
        });
        return;
      }
      if (doc.rooms !== undefined) {
        res.json({ rooms: doc.rooms, source: "cached" });
        return;
      }
      const [lng, lat] = doc.coordinates.coordinates;
      const rooms = await estimateRoomCount(deps.env, req.log, {
        name: doc.name,
        lat: lat!,
        lng: lng!,
      });
      if (rooms === null) {
        res.json({ rooms: null, source: "unknown" });
        return;
      }
      doc.rooms = rooms;
      await doc.save();
      res.json({ rooms, source: "estimated" });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
