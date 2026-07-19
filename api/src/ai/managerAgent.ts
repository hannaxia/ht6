import { SchemaType, type GenerativeModel } from "@google/generative-ai";
import type { DiscussionRequest, DiscussionTurn } from "../schemas/discussion.js";
import { formatTranscript } from "./discussionShared.js";

/**
 * Hotel Revenue Manager Agent — speaks purely from an operations/revenue
 * standpoint. It receives the full set of predicted metrics and must ground
 * every figure it cites in those provided values; it never invents numbers.
 */
export const MANAGER_SYSTEM_INSTRUCTION = `You are an experienced hotel operations and revenue manager.
Only discuss profitability, ADR, occupancy, annual revenue, investment, operational tradeoffs, pricing, and renovation ROI.
Evaluate the change using the prediction metrics provided in the context. Reference the actual simulation values when appropriate (for example: "our projected ADR increased about 9%, which makes this attractive").
Never invent statistics — only cite numbers supplied in the context. Every figure is a simulation estimate, not real financial data.
Speak concisely and professionally. Respond in 1-2 sentences. No markdown.`;

/**
 * Manager-facing context: the full predictions payload. Deltas that weren't
 * supplied (e.g. a hotel's first simulation) are simply omitted so the model
 * never sees — and therefore never cites — a fabricated change figure.
 */
export function buildManagerContext(state: DiscussionRequest): string {
  return JSON.stringify({
    hotel_name: state.hotel_name,
    location: state.location,
    hotel_type: state.hotel_type,
    amenities: state.amenities,
    recent_changes: state.recent_changes,
    predictions: state.predictions,
  });
}

export async function runManagerTurn(
  model: GenerativeModel,
  state: DiscussionRequest,
  transcript: DiscussionTurn[],
  turnInstruction: string,
): Promise<string> {
  const prompt =
    `Simulation snapshot (JSON):\n${buildManagerContext(state)}\n\n` +
    (transcript.length > 0
      ? `Conversation so far:\n${formatTranscript(transcript)}\n\n`
      : "") +
    turnInstruction;

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });
  return result.response.text().trim();
}

export interface ManagerFinal {
  text: string;
  recommendation: string;
}

/**
 * The manager's closing turn returns structured JSON so the UI can surface the
 * single actionable recommendation separately from the analysis. Uses Gemini's
 * JSON response mode for reliable parsing.
 */
export async function runManagerFinalTurn(
  model: GenerativeModel,
  state: DiscussionRequest,
  transcript: DiscussionTurn[],
): Promise<ManagerFinal> {
  const prompt =
    `Simulation snapshot (JSON):\n${buildManagerContext(state)}\n\n` +
    `Conversation so far:\n${formatTranscript(transcript)}\n\n` +
    `This is your closing turn. In "text", give a brief 1-2 sentence wrap-up that references the relevant projected metrics. ` +
    `In "recommendation", give ONE concise, actionable next step for this hotel configuration (a single sentence).`;

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          text: { type: SchemaType.STRING },
          recommendation: { type: SchemaType.STRING },
        },
        required: ["text", "recommendation"],
      },
    },
  });

  const raw = result.response.text().trim();
  const parsed = JSON.parse(raw) as Partial<ManagerFinal>;
  const text = (parsed.text ?? "").trim();
  const recommendation = (parsed.recommendation ?? "").trim();
  if (!text || !recommendation) {
    throw new Error("manager final turn returned incomplete JSON");
  }
  return { text, recommendation };
}
