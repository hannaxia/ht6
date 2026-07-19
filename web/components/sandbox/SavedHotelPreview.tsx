"use client";

import dynamic from "next/dynamic";
import type { HotelConfigPayload } from "../../lib/api/schemas";

// WebGL only runs in the browser — load the model client-side only, same as
// the Sandbox page itself.
const SandboxModel = dynamic(
  () => import("./SandboxModel").then((m) => m.SandboxModel),
  { ssr: false },
);

/**
 * Small rotating 3D building preview for a saved-hotel card — the same
 * Three.js model/turntable as the Hotel Sandbox, just sized to whatever the
 * parent container gives it (fills h-full/w-full) instead of the Sandbox's
 * large viewport.
 */
export function SavedHotelPreview({ config }: { config: HotelConfigPayload }) {
  return (
    <SandboxModel
      hotelType={config.hotelType}
      hasPool={config.amenities.includes("pool")}
      petFriendly={config.amenities.includes("pet_friendly")}
      airportShuttle={config.amenities.includes("airport_shuttle")}
      parking={config.amenities.includes("parking")}
      evCharging={config.amenities.includes("ev_charging")}
    />
  );
}
