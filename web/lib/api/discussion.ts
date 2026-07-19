import { z } from "zod";
import { fetchJson } from "./client";

export const discussionMessageSchema = z.object({
  speaker: z.enum(["guest", "manager"]),
  text: z.string(),
  recommendation: z.string().optional(),
});

export type DiscussionMessage = z.infer<typeof discussionMessageSchema>;

/** The 4 independent discussion turns, in display order. */
export const DISCUSSION_TURNS = [
  "guest1",
  "manager1",
  "guest2",
  "manager2",
] as const;
export type DiscussionTurnName = (typeof DISCUSSION_TURNS)[number];

export interface DiscussionPredictions {
  adr: number;
  adr_delta_percent?: number;
  occupancy: number;
  occupancy_delta_percent?: number;
  annual_revenue: number;
  revenue_delta_percent?: number;
  guest_rating: number;
  rating_delta?: number;
  opportunity_score?: number;
}

export interface DiscussionRequest {
  hotel_name?: string;
  location?: string;
  hotel_type?: string;
  amenities: string[];
  recent_changes: string[];
  predictions: DiscussionPredictions;
}

const turnResponseSchema = z.object({ message: discussionMessageSchema });

/**
 * Generates a single discussion turn. Each of the 4 turns is deliberately
 * its own independent HTTP request rather than one request that generates
 * all 4 — see api/src/ai/discussionService.ts's doc comment: a second
 * sequential Gemini call made from inside an already-open Express response
 * reproducibly hung, so the 4 turns are now fired as 4 separate requests
 * (see DiscussionPanel.tsx, which runs them in parallel).
 */
export function runDiscussionTurn(
  turn: DiscussionTurnName,
  payload: DiscussionRequest,
  signal?: AbortSignal,
): Promise<DiscussionMessage> {
  return fetchJson(
    "/agents/discussion",
    {
      method: "POST",
      body: JSON.stringify({ ...payload, turn }),
      signal,
    },
    turnResponseSchema,
  ).then((res) => res.message);
}
