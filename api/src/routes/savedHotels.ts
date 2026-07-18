import { Router } from "express";
import type { AppDependencies } from "../app.js";
import {
  savedHotelIdQuerySchema,
  savedHotelListQuerySchema,
  savedHotelUpsertSchema,
} from "../schemas/savedHotel.js";
import {
  deleteSavedHotel,
  getSavedHotel,
  listSavedHotels,
  upsertSavedHotel,
} from "../services/savedHotelService.js";

export function savedHotelsRouter(deps: AppDependencies): Router {
  const router = Router();

  const dbUnavailable = {
    errorCode: "database_unavailable",
    message: "MongoDB is not available.",
  };

  // List the caller's saved hotels.
  router.get("/", async (req, res, next) => {
    const parsed = savedHotelListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        errorCode: "invalid_request",
        message: "Query parameters failed validation.",
        details: { issues: parsed.error.issues },
      });
      return;
    }
    if (deps.mongo.readiness !== "ready") {
      res.status(503).json(dbUnavailable);
      return;
    }
    try {
      const savedHotels = await listSavedHotels(
        parsed.data.sessionId,
        deps.mongo,
        req.log,
      );
      res.json({ savedHotels });
    } catch (err) {
      next(err);
    }
  });

  // Create or update a saved hotel.
  router.post("/", async (req, res, next) => {
    const parsed = savedHotelUpsertSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        errorCode: "invalid_request",
        message: "Request body failed validation.",
        details: { issues: parsed.error.issues },
      });
      return;
    }
    if (deps.mongo.readiness !== "ready") {
      res.status(503).json(dbUnavailable);
      return;
    }
    try {
      const savedHotel = await upsertSavedHotel(
        parsed.data,
        deps.mongo,
        req.log,
      );
      if (!savedHotel) {
        res.status(404).json({
          errorCode: "not_found",
          message: "Saved hotel not found or not owned by this user.",
        });
        return;
      }
      res.json({ savedHotel });
    } catch (err) {
      next(err);
    }
  });

  // Fetch a single saved hotel by id (scoped to the caller).
  router.get("/:id", async (req, res, next) => {
    const parsed = savedHotelIdQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        errorCode: "invalid_request",
        message: "Query parameters failed validation.",
        details: { issues: parsed.error.issues },
      });
      return;
    }
    if (deps.mongo.readiness !== "ready") {
      res.status(503).json(dbUnavailable);
      return;
    }
    try {
      const savedHotel = await getSavedHotel(
        req.params.id,
        parsed.data.sessionId,
        deps.mongo,
      );
      if (!savedHotel) {
        res.status(404).json({
          errorCode: "not_found",
          message: "Saved hotel not found.",
        });
        return;
      }
      res.json({ savedHotel });
    } catch (err) {
      next(err);
    }
  });

  // Delete a saved hotel (scoped to the caller).
  router.delete("/:id", async (req, res, next) => {
    const parsed = savedHotelIdQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        errorCode: "invalid_request",
        message: "Query parameters failed validation.",
        details: { issues: parsed.error.issues },
      });
      return;
    }
    if (deps.mongo.readiness !== "ready") {
      res.status(503).json(dbUnavailable);
      return;
    }
    try {
      const deleted = await deleteSavedHotel(
        req.params.id,
        parsed.data.sessionId,
        deps.mongo,
        req.log,
      );
      if (!deleted) {
        res.status(404).json({
          errorCode: "not_found",
          message: "Saved hotel not found.",
        });
        return;
      }
      res.json({ deleted: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
