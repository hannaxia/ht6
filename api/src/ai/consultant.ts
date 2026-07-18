import type { Content, Part } from "@google/generative-ai";
import type { Logger } from "pino";
import type { Readiness } from "../db/mongo.js";
import {
  aiConsultResponseSchema,
  type AiConsultRequest,
  type AiConsultResponse,
} from "../schemas/ai.js";
import { DISCLAIMER } from "../simulation/index.js";
import type { GeminiClient } from "./gemini.js";
import type { Tool, ToolContext } from "./tools/index.js";

const MAX_TOOL_ROUNDS = 6;

export interface AIConsultant {
  readonly readiness: Readiness;
  consult(request: AiConsultRequest, logger: Logger): Promise<AiConsultResponse>;
}

export class AiNotConfiguredError extends Error {
  constructor() {
    super("Gemini is not configured");
    this.name = "AiNotConfiguredError";
  }
}

type Deltas = { hotel?: Record<string, unknown>; simulation?: Record<string, unknown> };

/** Pull any hotel/simulation deltas out of a tool result so views can apply them. */
function mergeDeltas(deltas: Deltas, toolName: string, result: unknown): void {
  if (toolName === "simulateHotelChange" && typeof result === "object" && result !== null) {
    const r = result as { after?: Record<string, unknown> };
    if (r.after) deltas.simulation = r.after;
  }
}

export function createAIConsultant(
  gemini: GeminiClient | null,
  tools: Tool[],
  ctx: Omit<ToolContext, "logger">,
): AIConsultant {
  return {
    get readiness(): Readiness {
      return gemini ? "ready" : "not_configured";
    },

    async consult(request, logger): Promise<AiConsultResponse> {
      if (!gemini) throw new AiNotConfiguredError();
      const log = logger.child({
        component: "ai-consultant",
        sessionId: request.sessionId,
      });
      const toolCtx: ToolContext = { ...ctx, logger: log };
      const deltas: Deltas = {};

      const contextText =
        request.context !== undefined
          ? `\n\nCurrent view context (JSON):\n${JSON.stringify(request.context)}`
          : "";
      const history: Content[] = [
        {
          role: "user",
          parts: [{ text: request.prompt + contextText }],
        },
      ];

      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const result = await gemini.generateContent({ contents: history });
        const response = result.response;
        const calls = response.functionCalls() ?? [];

        if (calls.length === 0) {
          const message = response.text().trim();
          const parsed = aiConsultResponseSchema.safeParse({
            message: message.length > 0 ? message : "I could not produce a recommendation for that request.",
            deltas,
            disclaimer: DISCLAIMER,
          });
          if (!parsed.success) {
            log.error(
              { issues: parsed.error.issues },
              "AI final response failed schema validation",
            );
            throw new Error("AI response failed validation");
          }
          log.info({ rounds: round }, "AI consult completed");
          return parsed.data;
        }

        const modelParts: Part[] = calls.map((call) => ({
          functionCall: call,
        }));
        history.push({ role: "model", parts: modelParts });

        const responseParts: Part[] = [];
        for (const call of calls) {
          const tool = tools.find((t) => t.name === call.name);
          if (!tool) {
            log.warn({ tool: call.name }, "Gemini called unknown tool");
            responseParts.push({
              functionResponse: {
                name: call.name,
                response: { error: "unknown_tool" },
              },
            });
            continue;
          }
          const args = tool.argsSchema.safeParse(call.args);
          if (!args.success) {
            log.warn(
              { tool: call.name, issues: args.error.issues },
              "tool args failed validation; handler not invoked",
            );
            responseParts.push({
              functionResponse: {
                name: call.name,
                response: {
                  error: "invalid_args",
                  issues: args.error.issues.map((i) => ({
                    path: i.path.join("."),
                    message: i.message,
                  })),
                },
              },
            });
            continue;
          }
          try {
            const raw = await tool.handler(args.data, toolCtx);
            const validated = tool.resultSchema.parse(raw);
            mergeDeltas(deltas, call.name, validated);
            responseParts.push({
              functionResponse: {
                name: call.name,
                response: validated as object,
              },
            });
          } catch (err) {
            log.error(
              { tool: call.name, err, input: args.data },
              "tool handler threw; returning tool error to Gemini",
            );
            responseParts.push({
              functionResponse: {
                name: call.name,
                response: { error: "tool_execution_failed" },
              },
            });
          }
        }
        history.push({ role: "user", parts: responseParts });
      }

      log.warn(
        { sessionId: request.sessionId, budget: MAX_TOOL_ROUNDS },
        "AI tool-call budget exhausted",
      );
      return aiConsultResponseSchema.parse({
        message:
          "I ran out of analysis budget before finishing that request. Try narrowing the question.",
        deltas,
        disclaimer: DISCLAIMER,
      });
    },
  };
}
