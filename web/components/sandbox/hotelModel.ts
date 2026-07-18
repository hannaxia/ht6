import type { HotelConfigPayload } from "../../lib/api/schemas";

/**
 * Maps a hotel configuration to one of the low-poly building models that ship
 * with the app (assets/3D_models/Buildings Low Poly Pack, copied into
 * web/public/models). The pack's models are generic — none are labelled by
 * hotel class — so this is a deliberate, tunable visual mapping rather than
 * data pulled from the models themselves. The car-service model
 * (Autoservice.fbx) is intentionally excluded as it isn't hotel-appropriate.
 *
 * The mapping is keyed on hotel type, with a couple of star-rating nudges so a
 * top-tier build reads as grander than an entry-level one. It only affects the
 * 3D preview; it has no bearing on any simulated metric.
 */

export type BuildingModel = `Building_${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`;

const BY_TYPE: Record<HotelConfigPayload["hotelType"], BuildingModel> = {
  budget: "Building_1",
  midscale: "Building_6",
  upscale: "Building_4",
  luxury: "Building_2",
  resort: "Building_5",
  extended_stay: "Building_3",
};

/** Resolve the model file (without extension) for a given hotel config. */
export function modelForConfig(config: {
  hotelType: HotelConfigPayload["hotelType"];
  stars?: number;
}): BuildingModel {
  const base = BY_TYPE[config.hotelType] ?? "Building_6";
  // A 5-star build of a non-luxury type still deserves a grander silhouette;
  // a 1-star luxury (unusual) reads plainer.
  if (config.hotelType !== "luxury" && (config.stars ?? 0) >= 5) {
    return "Building_7";
  }
  return base;
}

/** Public URL Next.js serves the model from (see web/public/models). */
export function modelUrl(model: BuildingModel): string {
  return `/models/${model}.fbx`;
}

/** Shared texture atlas the whole pack uses. */
export const TEXTURE_URL = "/models/Texture.png";
