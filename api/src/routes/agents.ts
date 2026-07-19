import { Router } from "express";
import type { AppDependencies } from "../app.js";
import { DiscussionNotConfiguredError } from "../ai/discussionService.js";
import { discussionTurnRequestSchema } from "../schemas/discussion.js";

export function agentsRouter(deps: AppDependencies): Router {
  const router = Router();

  // Generates exactly ONE of the 4 discussion turns per call. The client
  // fires all 4 as separate, parallel requests to this endpoint (see
  // discussionService.ts's runTurn doc comment for why this replaced a
  // single request that generated all 4 turns internally).
  router.post("/discussion", async (req, res, next) => {
    const parsed = discussionTurnRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        errorCode: "invalid_request",
        message: "Request body failed validation.",
        details: { issues: parsed.error.issues },
      });
      return;
    }
    if (deps.discussion.readiness !== "ready") {
      res.status(503).json({
        errorCode: "ai_not_configured",
        message: "Gemini is not configured. See the README setup checklist.",
      });
      return;
    }
    try {
      const { turn, ...request } = parsed.data;
      const message = await deps.discussion.runTurn(turn, request, req.log);
      res.json({ message });
    } catch (err) {
      if (err instanceof DiscussionNotConfiguredError) {
        res.status(503).json({
          errorCode: "ai_not_configured",
          message: "Gemini is not configured. See the README setup checklist.",
        });
        return;
      }
      next(err);
    }
  });

  return router;
}
