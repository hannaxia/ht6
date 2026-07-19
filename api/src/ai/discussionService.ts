import { GoogleGenerativeAI, type GenerativeModel } from "@google/generative-ai";
import type { Logger } from "pino";
import type { Readiness } from "../db/mongo.js";
import type { Env } from "../env.js";
import {
  discussionMessageSchema,
  type DiscussionMessage,
  type DiscussionRequest,
  type DiscussionTurnName,
} from "../schemas/discussion.js";
import {
  GUEST_SYSTEM_INSTRUCTION,
  runGuestFollowUp,
  runGuestOpening,
} from "./guestAgent.js";
import {
  MANAGER_SYSTEM_INSTRUCTION,
  runManagerClosing,
  runManagerOpening,
} from "./managerAgent.js";

export class DiscussionNotConfiguredError extends Error {
  constructor() {
    super("Gemini is not configured");
    this.name = "DiscussionNotConfiguredError";
  }
}

export interface DiscussionService {
  readonly readiness: Readiness;
  /**
   * Generates exactly ONE of the 4 discussion messages (guest1, manager1,
   * guest2, or manager2) — a single, self-contained Gemini call, no shared
   * transcript with the other 3. The route (routes/agents.ts) is called 4
   * times, once per turn, as 4 independent HTTP requests fired in parallel
   * from the client — deliberately NOT chained within one request.
   *
   * Why: an earlier design generated all 4 turns inside one request/response
   * (first sequentially with a real shared transcript, then — after removing
   * that dependency — still sequentially with independent prompts). In both
   * cases, the SECOND-OR-LATER Gemini call made from within an already-open
   * Express response reproducibly never settled: not just slow, but stuck
   * even past a hard client-side setTimeout independent of the SDK's own
   * promise — while the exact same call made as the FIRST Gemini call of a
   * fresh request always succeeded quickly. So each turn now gets its own
   * fresh request, sidestepping whatever that was rather than continuing to
   * chase it.
   */
  runTurn(
    turn: DiscussionTurnName,
    request: DiscussionRequest,
    logger: Logger,
  ): Promise<DiscussionMessage>;
}

export function createDiscussionService(
  env: Env,
  logger: Logger,
): DiscussionService {
  const log = logger.child({ component: "discussion-service" });
  const genAI = env.GEMINI_API_KEY
    ? new GoogleGenerativeAI(env.GEMINI_API_KEY)
    : null;

  if (!genAI) {
    log.warn(
      { variable: "GEMINI_API_KEY" },
      "GEMINI_API_KEY is not set — AI discussion runs in degraded mode",
    );
  }

  // Dedicated, independently-overridable model for this feature specifically
  // — more latency-sensitive than the tool-calling consultant
  // (env.GEMINI_MODEL), so it isn't tied to that setting. gemini-2.5-flash is
  // a fast, current, explicitly-pinned model (not a "-latest" rolling alias)
  // chosen for this conversational task.
  const modelName = env.GEMINI_DISCUSSION_MODEL ?? "gemini-2.5-flash";

  function buildModels(): { guest: GenerativeModel; manager: GenerativeModel } {
    if (!genAI) throw new DiscussionNotConfiguredError();
    return {
      guest: genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: GUEST_SYSTEM_INSTRUCTION,
      }),
      manager: genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: MANAGER_SYSTEM_INSTRUCTION,
      }),
    };
  }

  return {
    get readiness(): Readiness {
      return genAI ? "ready" : "not_configured";
    },

    async runTurn(turn, request, requestLogger): Promise<DiscussionMessage> {
      if (!genAI) throw new DiscussionNotConfiguredError();
      const turnLog = requestLogger.child({ component: "discussion-service", turn });
      const { guest, manager } = buildModels();

      let message: DiscussionMessage;
      switch (turn) {
        case "guest1":
          message = { speaker: "guest", text: await runGuestOpening(guest, request) };
          break;
        case "manager1":
          message = { speaker: "manager", text: await runManagerOpening(manager, request) };
          break;
        case "guest2":
          message = { speaker: "guest", text: await runGuestFollowUp(guest, request) };
          break;
        case "manager2": {
          const closing = await runManagerClosing(manager, request);
          message = {
            speaker: "manager",
            text: closing.text,
            recommendation: closing.recommendation,
          };
          break;
        }
      }

      const parsed = discussionMessageSchema.safeParse(message);
      if (!parsed.success) {
        turnLog.error(
          { issues: parsed.error.issues },
          "discussion message failed schema validation",
        );
        throw new Error("discussion message failed validation");
      }
      turnLog.info("discussion turn completed");
      return parsed.data;
    },
  };
}
