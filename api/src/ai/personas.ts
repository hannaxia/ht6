import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Logger } from "pino";
import type { Readiness } from "../db/mongo.js";
import type { Env } from "../env.js";

export type PersonaId = "guest" | "staff" | "resident" | "competitor";

export interface PersonaDef {
  id: PersonaId;
  label: string;
  systemInstruction: string;
}

const ESTIMATE_RULE =
  "Any specific number you cite (price, rating, occupancy, revenue) must be phrased as an estimate — e.g. 'looks like it's around $210 a night' not a stated fact. Keep it to 2-3 sentences, first person, in character. No stage directions, no markdown.";

export const PERSONAS: PersonaDef[] = [
  {
    id: "guest",
    label: "Hotel Guest",
    systemInstruction: `You are a prospective hotel guest reacting to a proposed change to a hotel you're considering booking. React based on amenities, price, and rating changes — would this make you more or less likely to book, and why. ${ESTIMATE_RULE}`,
  },
  {
    id: "staff",
    label: "Hotel Staff",
    systemInstruction: `You are a hotel front-desk or operations staff member reacting to a proposed change from a workload and day-to-day operations perspective — new amenities mean new training, new upkeep, new guest requests. ${ESTIMATE_RULE}`,
  },
  {
    id: "resident",
    label: "Local Resident",
    systemInstruction: `You are a resident who lives near this hotel, reacting to a proposed change from a neighborhood impact perspective — construction, traffic, noise, or how the property's character is changing. ${ESTIMATE_RULE}`,
  },
  {
    id: "competitor",
    label: "Competitor Hotel Manager",
    systemInstruction: `You are the general manager of a competing hotel nearby, reacting to how this change affects your business — are they now a bigger threat to your bookings, or not. ${ESTIMATE_RULE}`,
  },
];

export interface PersonaReactor {
  readonly readiness: Readiness;
  reactionStream(
    personaId: PersonaId,
    contextPrompt: string,
  ): AsyncGenerator<string>;
}

export function createPersonaReactor(
  env: Env,
  logger: Logger,
): PersonaReactor {
  const log = logger.child({ component: "persona-reactor" });
  const genAI = env.GEMINI_API_KEY
    ? new GoogleGenerativeAI(env.GEMINI_API_KEY)
    : null;

  if (!genAI) {
    log.warn(
      { variable: "GEMINI_API_KEY" },
      "GEMINI_API_KEY is not set — persona reactions run in degraded mode",
    );
  }

  return {
    get readiness(): Readiness {
      return genAI ? "ready" : "not_configured";
    },
    async *reactionStream(personaId, contextPrompt) {
      if (!genAI) throw new Error("Gemini not configured");
      const def = PERSONAS.find((p) => p.id === personaId);
      if (!def) throw new Error(`unknown persona: ${personaId}`);

      // Deliberately no tools attached — personas riff on the provided
      // before/after context, they don't call the simulation engine
      // themselves (that's the Consultant's job).
      const model = genAI.getGenerativeModel({
        model: env.GEMINI_MODEL ?? "gemini-flash-latest",
        systemInstruction: def.systemInstruction,
      });
      const result = await model.generateContentStream({
        contents: [{ role: "user", parts: [{ text: contextPrompt }] }],
      });
      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) yield text;
      }
    },
  };
}
