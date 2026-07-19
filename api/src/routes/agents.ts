import { Router } from "express";
import type { AppDependencies } from "../app.js";
import { DiscussionNotConfiguredError } from "../ai/discussionService.js";
import { discussionRequestSchema } from "../schemas/discussion.js";

export function agentsRouter(deps: AppDependencies): Router {
  const router = Router();

  router.post("/discussion", async (req, res, next) => {
    const parsed = discussionRequestSchema.safeParse(req.body);
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

    // If the client cancels (a new edit restarted the debounce), abort the
    // in-flight Gemini turns instead of finishing a discussion nobody wants.
    const controller = new AbortController();
    req.on("close", () => {
      if (!res.writableEnded) controller.abort();
    });

    try {
      const response = await deps.discussion.discuss(
        parsed.data,
        req.log,
        controller.signal,
      );
      res.json(response);
    } catch (err) {
      if (err instanceof DiscussionNotConfiguredError) {
        res.status(503).json({
          errorCode: "ai_not_configured",
          message: "Gemini is not configured. See the README setup checklist.",
        });
        return;
      }
      if (err instanceof Error && err.name === "AbortError") {
        // Client went away; nothing to send.
        return;
      }
      next(err);
    }
  });

  return router;
}
