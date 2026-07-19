import { z } from "zod";
import { fetchJson } from "./client";

export const discussionMessageSchema = z.object({
  speaker: z.enum(["guest", "manager"]),
  text: z.string(),
  recommendation: z.string().optional(),
});

export const discussionResponseSchema = z.object({
  messages: z.array(discussionMessageSchema),
});

export type DiscussionMessage = z.infer<typeof discussionMessageSchema>;
export type DiscussionResponse = z.infer<typeof discussionResponseSchema>;

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

/**
 * Kicks off the two-agent discussion for the current simulation snapshot.
 * Pass an AbortSignal so a fresh edit can cancel an in-flight discussion.
 */
export const discussionApi = {
  create(
    payload: DiscussionRequest,
    signal?: AbortSignal,
  ): Promise<DiscussionResponse> {
    return fetchJson(
      "/agents/discussion",
      { method: "POST", body: JSON.stringify(payload), signal },
      discussionResponseSchema,
    );
  },
};
