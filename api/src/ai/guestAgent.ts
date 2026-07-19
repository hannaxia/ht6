import type { GenerativeModel } from "@google/generative-ai";
import type { DiscussionRequest, DiscussionTurn } from "../schemas/discussion.js";
import { formatTranscript } from "./discussionShared.js";

/**
 * Guest Experience Agent — speaks purely from a realistic guest's point of
 * view (comfort, convenience, perceived value, willingness to stay). It is
 * deliberately never given the business metrics, so it structurally cannot
 * cite revenue/ADR/occupancy even if asked.
 */
export const GUEST_SYSTEM_INSTRUCTION = `You are an experienced hotel guest evaluating a hotel after design changes.
Only discuss the guest experience — comfort, convenience, perceived value, willingness to stay, expectations, satisfaction, and the vacation or business traveler perspective.
Never discuss revenue, ADR, occupancy, ROI, investment, or business strategy.
Speak naturally and conversationally. Respond in 1-2 short sentences. No markdown, no stage directions, no quotation marks around your reply.`;

/**
 * Guest-facing context: what the hotel *is* and what just changed — no
 * predicted numbers. The guest reacts to the experience, not the spreadsheet.
 */
export function buildGuestContext(state: DiscussionRequest): string {
  return JSON.stringify({
    hotel_name: state.hotel_name,
    location: state.location,
    hotel_type: state.hotel_type,
    amenities: state.amenities,
    recent_changes: state.recent_changes,
  });
}

export async function runGuestTurn(
  model: GenerativeModel,
  state: DiscussionRequest,
  transcript: DiscussionTurn[],
  turnInstruction: string,
): Promise<string> {
  const prompt =
    `Hotel details (JSON):\n${buildGuestContext(state)}\n\n` +
    (transcript.length > 0
      ? `Conversation so far:\n${formatTranscript(transcript)}\n\n`
      : "") +
    turnInstruction;

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });
  return result.response.text().trim();
}
