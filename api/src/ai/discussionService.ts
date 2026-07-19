import { GoogleGenerativeAI, type GenerativeModel } from "@google/generative-ai";
import type { Logger } from "pino";
import type { Readiness } from "../db/mongo.js";
import type { Env } from "../env.js";
import {
  discussionResponseSchema,
  type DiscussionMessage,
  type DiscussionRequest,
  type DiscussionResponse,
  type DiscussionTurn,
} from "../schemas/discussion.js";
import { GUEST_SYSTEM_INSTRUCTION, runGuestTurn } from "./guestAgent.js";
import {
  MANAGER_SYSTEM_INSTRUCTION,
  runManagerFinalTurn,
  runManagerTurn,
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
   * Orchestrates the fixed four-message exchange:
   *   Guest → Manager → Guest → Manager (final recommendation).
   */
  discuss(
    request: DiscussionRequest,
    logger: Logger,
    signal?: AbortSignal,
  ): Promise<DiscussionResponse>;
}

const GUEST_OPENING =
  "React to this hotel and its recent changes as a guest would. Give your first impression.";
const GUEST_FOLLOW_UP =
  "Continue the conversation as the guest. Add one more thought or a remaining wish about the guest experience — don't repeat what you already said.";
const MANAGER_OPENING =
  "Respond to the guest as the revenue manager, tying their point to the projected financial impact of the changes.";

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

  const modelName = env.GEMINI_MODEL ?? "gemini-flash-latest";

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

    async discuss(request, requestLogger, signal): Promise<DiscussionResponse> {
      if (!genAI) throw new DiscussionNotConfiguredError();
      const turnLog = requestLogger.child({ component: "discussion-service" });
      const { guest, manager } = buildModels();
      const transcript: DiscussionTurn[] = [];

      const ensureLive = () => {
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      };

      // 1. Guest — opening impression.
      ensureLive();
      const guest1 = await runGuestTurn(guest, request, transcript, GUEST_OPENING);
      transcript.push({ speaker: "guest", text: guest1 });

      // 2. Manager — financial response to the guest.
      ensureLive();
      const manager1 = await runManagerTurn(
        manager,
        request,
        transcript,
        MANAGER_OPENING,
      );
      transcript.push({ speaker: "manager", text: manager1 });

      // 3. Guest — one more thought.
      ensureLive();
      const guest2 = await runGuestTurn(
        guest,
        request,
        transcript,
        GUEST_FOLLOW_UP,
      );
      transcript.push({ speaker: "guest", text: guest2 });

      // 4. Manager — closing analysis + single actionable recommendation.
      ensureLive();
      const final = await runManagerFinalTurn(manager, request, transcript);

      const messages: DiscussionMessage[] = [
        { speaker: "guest", text: guest1 },
        { speaker: "manager", text: manager1 },
        { speaker: "guest", text: guest2 },
        {
          speaker: "manager",
          text: final.text,
          recommendation: final.recommendation,
        },
      ];

      const parsed = discussionResponseSchema.safeParse({ messages });
      if (!parsed.success) {
        turnLog.error(
          { issues: parsed.error.issues },
          "discussion response failed schema validation",
        );
        throw new Error("discussion response failed validation");
      }
      turnLog.info("AI discussion completed");
      return parsed.data;
    },
  };
}
