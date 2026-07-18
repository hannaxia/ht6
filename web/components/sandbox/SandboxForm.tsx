"use client";

import type { HotelConfigPayload } from "../../lib/api/schemas";
import { FormField } from "../shared/FormField";
import { AMENITIES } from "./amenities";

const HOTEL_TYPES = [
  "budget",
  "midscale",
  "upscale",
  "luxury",
  "resort",
  "extended_stay",
] as const;

const SEGMENTS = ["leisure", "business", "mixed"] as const;

export { AMENITIES };

export function SandboxForm({
  config,
  onChange,
}: {
  config: HotelConfigPayload;
  onChange: (next: HotelConfigPayload) => void;
}) {
  function set<K extends keyof HotelConfigPayload>(
    key: K,
    value: HotelConfigPayload[K],
  ) {
    onChange({ ...config, [key]: value });
  }

  function toggleAmenity(amenity: string) {
    const has = config.amenities.includes(amenity);
    set(
      "amenities",
      has
        ? config.amenities.filter((a) => a !== amenity)
        : [...config.amenities, amenity],
    );
  }

  const inputClass =
    "w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Hotel type">
          <select
            className={inputClass}
            value={config.hotelType}
            onChange={(e) =>
              set("hotelType", e.target.value as HotelConfigPayload["hotelType"])
            }
          >
            {HOTEL_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace("_", " ")}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Target audience">
          <select
            className={inputClass}
            value={config.targetSegment}
            onChange={(e) =>
              set(
                "targetSegment",
                e.target.value as HotelConfigPayload["targetSegment"],
              )
            }
          >
            {SEGMENTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label={`Rooms: ${config.rooms}`}>
          <input
            type="range"
            min={50}
            max={500}
            step={10}
            value={config.rooms}
            onChange={(e) => set("rooms", Number(e.target.value))}
            className="w-full"
          />
        </FormField>
        <FormField label={`Stars: ${config.stars}`}>
          <input
            type="range"
            min={1}
            max={5}
            step={1}
            value={config.stars}
            onChange={(e) =>
              set("stars", Number(e.target.value) as HotelConfigPayload["stars"])
            }
            className="w-full"
          />
        </FormField>
        <FormField
          label={`Modernity: ${(config.modernity * 100).toFixed(0)}%`}
        >
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={config.modernity}
            onChange={(e) => set("modernity", Number(e.target.value))}
            className="w-full"
          />
        </FormField>
        <FormField
          label={`Renovation: ${(config.renovationDelta * 100).toFixed(0)}%`}
        >
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={config.renovationDelta}
            onChange={(e) => set("renovationDelta", Number(e.target.value))}
            className="w-full"
          />
        </FormField>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-slate-600">Amenities</p>
        <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3">
          {AMENITIES.map((amenity) => (
            <label
              key={amenity}
              className="flex items-center gap-2 rounded border border-slate-200 bg-white px-2 py-1.5 text-xs"
            >
              <input
                type="checkbox"
                checked={config.amenities.includes(amenity)}
                onChange={() => toggleAmenity(amenity)}
              />
              {amenity.replace(/_/g, " ")}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
