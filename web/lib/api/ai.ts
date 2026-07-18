import { fetchJson } from "./client";
import { aiConsultResponseSchema } from "./schemas";

export const aiApi = {
  consult(params: { sessionId: string; prompt: string; context?: unknown }) {
    return fetchJson(
      "/ai/consult",
      { method: "POST", body: JSON.stringify(params) },
      aiConsultResponseSchema,
    );
  },
};
