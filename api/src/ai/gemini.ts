import {
  FunctionCallingMode,
  GoogleGenerativeAI,
  SchemaType,
  type FunctionDeclaration,
  type GenerativeModel,
} from "@google/generative-ai";
import type { Logger } from "pino";
import type { Env } from "../env.js";
import { SYSTEM_INSTRUCTION } from "./systemInstruction.js";

/**
 * Gemini function declarations for the five Innsight tools. Gemini requires
 * OpenAPI-style schemas; the zod schemas in tools/ are the enforcement layer —
 * these declarations only describe intent to the model.
 */
const hotelConfigDescription =
  "Full hotel configuration object: hotelType (budget|midscale|upscale|luxury|resort|extended_stay), rooms (int), stars (1-5), modernity (0-1), renovationDelta (0-1), amenities (string[]), targetSegment (leisure|business|mixed), basePrice (USD), segmentAdrNorm (USD), location {type, scores{transit,airport,tourism,business 0-1}, coordinates{lat,lng}, baseDemand, locationDemand, locationSatisfaction}, competitors[], baseRating";

export const TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "simulateHotelChange",
    description:
      "Simulate a hotel before and after a set of configuration changes. Returns before/after estimated metrics (ADR, occupancy, revenue, rating, investment, ROI, payback).",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        base: { type: SchemaType.OBJECT, description: hotelConfigDescription },
        changes: {
          type: SchemaType.OBJECT,
          description:
            "Partial hotel configuration — only the fields being changed.",
        },
      },
      required: ["base", "changes"],
    },
  },
  {
    name: "calculateRevenue",
    description:
      "Compute estimated annual room revenue and its breakdown (ADR, occupancy) for a hotel configuration.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        config: { type: SchemaType.OBJECT, description: hotelConfigDescription },
      },
      required: ["config"],
    },
  },
  {
    name: "analyzeLocation",
    description:
      "Analyze a city's opportunity grid (estimated opportunity scores per cell). Optionally focus near given coordinates.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        city: { type: SchemaType.STRING, description: "City name, e.g. toronto" },
        coordinates: {
          type: SchemaType.OBJECT,
          description: "Optional {lat, lng} focus point.",
          properties: {
            lat: { type: SchemaType.NUMBER },
            lng: { type: SchemaType.NUMBER },
          },
        },
      },
      required: ["city"],
    },
  },
  {
    name: "compareCompetitors",
    description:
      "List nearby Stay22 competitor hotels and the estimated segment-weighted competition pressure on the given hotel.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        hotel: { type: SchemaType.OBJECT, description: hotelConfigDescription },
        radiusKm: { type: SchemaType.NUMBER, description: "Search radius in km" },
      },
      required: ["hotel", "radiusKm"],
    },
  },
  {
    name: "generateInvestmentReport",
    description:
      "Produce an estimated investment report (investment, ROI, payback years, narrative summary) for a hotel configuration.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        config: { type: SchemaType.OBJECT, description: hotelConfigDescription },
      },
      required: ["config"],
    },
  },
];

export type GeminiClient = GenerativeModel;

export function createGeminiClient(
  env: Env,
  logger: Logger,
): GeminiClient | null {
  if (!env.GEMINI_API_KEY) {
    logger.warn(
      { variable: "GEMINI_API_KEY" },
      "GEMINI_API_KEY is not set — AI consultant runs in degraded mode",
    );
    return null;
  }
  const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  return genAI.getGenerativeModel({
    model: env.GEMINI_MODEL ?? "gemini-1.5-pro",
    systemInstruction: SYSTEM_INSTRUCTION,
    tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
    toolConfig: {
      functionCallingConfig: { mode: FunctionCallingMode.AUTO },
    },
  });
}
