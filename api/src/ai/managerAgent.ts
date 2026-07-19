import { SchemaType, type GenerativeModel } from "@google/generative-ai";
import type { DiscussionRequest } from "../schemas/discussion.js";

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

/**
 * The manager's opening turn — independent of the guest's turns (no shared
 * transcript; see guestAgent.ts for why). Plain text, no recommendation yet.
 */
export async function runManagerOpening(
  model: GenerativeModel,
  state: DiscussionRequest,
): Promise<string> {
  const prompt =
    `Simulation snapshot (JSON):\n${buildManagerContext(state)}\n\n` +
    "Give your initial assessment of this hotel's financial setup, tying it to the projected metrics.";
  const result = await model.generateContent(
    { contents: [{ role: "user", parts: [{ text: prompt }] }] },
    { timeout: 10_000 },
  );
  return result.response.text().trim();
}

export interface ManagerClosing {
  text: string;
  recommendation: string;
}

/**
 * The manager's closing turn — independent of the guest's turns and of
 * runManagerOpening (no shared transcript). Returns structured JSON so the
 * UI can surface the recommendation separately from the analysis text.
 */
export async function runManagerClosing(
  model: GenerativeModel,
  state: DiscussionRequest,
): Promise<ManagerClosing> {
  const prompt =
    `Simulation snapshot (JSON):\n${buildManagerContext(state)}\n\n` +
    `Give a brief 1-2 sentence closing analysis of this hotel configuration that references the relevant projected metrics. ` +
    `In "recommendation", give ONE concise, actionable next step for this hotel configuration (a single sentence).`;

  const result = await model.generateContent(
    {
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
    },
    { timeout: 10_000 },
  );

  const raw = result.response.text().trim();
  const parsed = JSON.parse(raw) as Partial<ManagerClosing>;
  const text = (parsed.text ?? "").trim();
  const recommendation = (parsed.recommendation ?? "").trim();
  if (!text || !recommendation) {
    throw new Error("manager closing turn returned incomplete JSON");
  }
  return { text, recommendation };
}
