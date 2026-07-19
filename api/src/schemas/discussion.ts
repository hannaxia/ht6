import { z } from "zod";

/**
 * Structured simulation snapshot the frontend sends to POST /agents/discussion.
 * Predictions are the values already computed by our models — the agents only
 * interpret them, they never predict. Deltas are optional (a hotel's first
 * simulation has no "before" to compare against).
 */
export const discussionPredictionsSchema = z.object({
  adr: z.number().finite(),
  adr_delta_percent: z.number().finite().optional(),
  occupancy: z.number().finite(),
  occupancy_delta_percent: z.number().finite().optional(),
  annual_revenue: z.number().finite(),
  revenue_delta_percent: z.number().finite().optional(),
  guest_rating: z.number().finite(),
  rating_delta: z.number().finite().optional(),
  opportunity_score: z.number().finite().optional(),
});

export const discussionRequestSchema = z.object({
  hotel_name: z.string().min(1).max(200).optional(),
  location: z.string().min(1).max(200).optional(),
  hotel_type: z.string().min(1).max(100).optional(),
  amenities: z.array(z.string()).max(100).default([]),
  recent_changes: z.array(z.string().max(200)).max(50).default([]),
  predictions: discussionPredictionsSchema,
});

export const discussionMessageSchema = z.object({
  speaker: z.enum(["guest", "manager"]),
  text: z.string().min(1),
  /** Only present on the final manager message. */
  recommendation: z.string().min(1).optional(),
});

export const discussionResponseSchema = z.object({
  messages: z.array(discussionMessageSchema).length(4),
});

export type DiscussionPredictions = z.infer<typeof discussionPredictionsSchema>;
export type DiscussionRequest = z.infer<typeof discussionRequestSchema>;
export type DiscussionMessage = z.infer<typeof discussionMessageSchema>;
export type DiscussionResponse = z.infer<typeof discussionResponseSchema>;

/** One turn in the running transcript passed between agents. */
export interface DiscussionTurn {
  speaker: "guest" | "manager";
  text: string;
}
