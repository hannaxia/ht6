import { Router } from "express";
import type { AppDependencies } from "../app.js";
import { buildHealthResponse } from "../services/healthService.js";

export function healthRouter(deps: AppDependencies): Router {
  const router = Router();
  router.get("/", (_req, res) => {
    res.json(
      buildHealthResponse(deps.mongo, deps.stay22, deps.ai.readiness),
    );
  });
  return router;
}
