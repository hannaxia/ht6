import { GoogleGenerativeAI, SchemaType, type GenerativeModel } from "@google/generative-ai";
import type { Logger } from "pino";
import type { Env } from "../env.js";

/**
 * A separate, tool-free Gemini model instance dedicated to one-shot factual
 * lookups (room count) — deliberately NOT the tool-calling consultant model
 * in gemini.ts, which is hardwired with AUTO function-calling against the 5
 * simulation tools and would behave unpredictably for a plain factual query.
 *
 * Plain model recall, not web-search-grounded: the installed SDK
 * (@google/generative-ai 0.21.0) exposes a `googleSearchRetrieval` grounding
 * tool, but it's Gemini-1.5-era API surface, and this app deliberately runs
 * on the `gemini-flash-latest` rolling alias (chosen specifically to dodge
 * the 1.5 retirement that broke this app once already — see git history).
 * Pairing an old grounding-tool shape with a newer model alias risked the
 * same kind of silent 400 that bit this project before, so this is plain
 * (ungrounded) generation. Accuracy depends on the model's training-time
 * knowledge of the named property — solid for major chains, weaker for
 * small/independent listings. The prompt explicitly instructs the model to
 * say "unknown" rather than guess, and the caller still treats `null` (or
 * an implausible value) as "couldn't determine," falling back accordingly.
 */
let roomLookupModel: GenerativeModel | null | undefined; // undefined = not yet initialized

function getRoomLookupModel(env: Env, logger: Logger): GenerativeModel | null {
  if (roomLookupModel !== undefined) return roomLookupModel;
  if (!env.GEMINI_API_KEY) {
    logger.warn(
      { variable: "GEMINI_API_KEY" },
      "GEMINI_API_KEY not set — room-count lookup disabled",
    );
    roomLookupModel = null;
    return roomLookupModel;
  }
  const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  roomLookupModel = genAI.getGenerativeModel({
    model: env.GEMINI_MODEL ?? "gemini-flash-latest",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          rooms: {
            type: SchemaType.INTEGER,
            nullable: true,
            description:
              "Total number of rooms/units at this specific property, or null if genuinely unknown/unrecognized.",
          },
          confident: { type: SchemaType.BOOLEAN },
        },
        required: ["rooms", "confident"],
      },
    },
  });
  return roomLookupModel;
}

const MIN_PLAUSIBLE_ROOMS = 1;
const MAX_PLAUSIBLE_ROOMS = 5000;

/**
 * Estimates a property's total room/unit count via a one-shot Gemini query.
 * Never throws — returns null on any failure, missing config, or when the
 * model isn't confident, mirroring mlClient's degrade-gracefully pattern so
 * callers can always fall back to the deterministic default. Callers are
 * expected to cache a non-null result (see Hotel.rooms) so this only runs
 * once per property, not on every "Configure" click.
 */
export async function estimateRoomCount(
  env: Env,
  logger: Logger,
  hotel: { name: string; lat: number; lng: number },
): Promise<number | null> {
  const model = getRoomLookupModel(env, logger);
  if (!model) return null;

  const prompt = `How many total rooms (or units) does this property have?

Property name: "${hotel.name}"
Approximate coordinates: ${hotel.lat.toFixed(4)}, ${hotel.lng.toFixed(4)}

Two different cases, handled differently:

1. If the name reads as a small short-term rental — an apartment, condo,
house, suite, room, loft, or anything that sounds like a single listing on
a platform like Airbnb (as opposed to a branded hotel/inn/resort) — this is
just one rental unit. You do NOT need to recognize the specific listing:
confidently estimate rooms as 1-4 based on any bedroom count mentioned in
the name (e.g. "3 Bedroom House" → 3), or 1 if none is mentioned. Mark
confident: true — a small, low-stakes estimate like this is expected and
fine even without knowing the exact property.

2. If the name reads as an actual hotel, inn, resort, or branded
hospitality property (e.g. a chain name, "Hotel", "Inn", "Suites by
[Brand]"), only answer if you have real knowledge of that SPECIFIC
property's real room count from training data. Do not estimate a
plausible-sounding number for a hotel you don't actually recognize — return
rooms: null and confident: false instead. Hotels vary too widely in size to
guess safely, unlike a small rental.`;

  try {
    const result = await model.generateContent(prompt);
    const parsed = JSON.parse(result.response.text()) as {
      rooms: number | null;
      confident: boolean;
    };
    if (
      !parsed.confident ||
      parsed.rooms === null ||
      !Number.isFinite(parsed.rooms) ||
      parsed.rooms < MIN_PLAUSIBLE_ROOMS ||
      parsed.rooms > MAX_PLAUSIBLE_ROOMS
    ) {
      logger.info(
        { hotel: hotel.name, parsed },
        "room-count lookup: no confident answer",
      );
      return null;
    }
    return Math.round(parsed.rooms);
  } catch (err) {
    logger.warn({ err, hotel: hotel.name }, "room-count lookup failed");
    return null;
  }
}
