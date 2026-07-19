import type { GenerativeModel } from "@google/generative-ai";
import type { DiscussionRequest } from "../schemas/discussion.js";

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

/**
 * Two independent guest turns (no shared transcript — each is a self-
 * contained prompt reacting to the same hotel snapshot from a different
 * angle). The UI splices guest1/manager1/guest2/manager2 together in order
 * so it *reads* like a back-and-forth conversation, but none of the 4 calls
 * actually depends on another's output — deliberately, since a Gemini call
 * chained onto a prior turn's real text is what caused a reproducible hang
 * on the second+ sequential call in this request path (see
 * discussionService.ts). Each is a fixed, independent prompt instead.
 */
async function runGuestTurn(
  model: GenerativeModel,
  state: DiscussionRequest,
  instruction: string,
): Promise<string> {
  const prompt = `Hotel details (JSON):\n${buildGuestContext(state)}\n\n${instruction}`;
  const result = await model.generateContent(
    { contents: [{ role: "user", parts: [{ text: prompt }] }] },
    { timeout: 10_000 },
  );
  return result.response.text().trim();
}

export function runGuestOpening(
  model: GenerativeModel,
  state: DiscussionRequest,
): Promise<string> {
  return runGuestTurn(
    model,
    state,
    "React to this hotel and its recent changes as a guest would. Give your honest first impression.",
  );
}

export function runGuestFollowUp(
  model: GenerativeModel,
  state: DiscussionRequest,
): Promise<string> {
  return runGuestTurn(
    model,
    state,
    "As a guest, share one more specific thought about this hotel — something you'd still want, or a detail (comfort, amenities, value) worth calling out. Give a fresh angle, not a generic restatement.",
  );
}
