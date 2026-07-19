import { Schema, type Model, type Types } from "mongoose";

export interface HotelDoc {
  _id: Types.ObjectId;
  stayId: string;
  name: string;
  supplier: string;
  city?: string;
  country?: string;
  stars?: number;
  rating?: number;
  price?: { amount: number; currency: string; per: "night" | "stay" };
  amenities: string[];
  images: string[];
  coordinates: { type: "Point"; coordinates: [number, number] };
  /**
   * Total room/unit count. Stay22 does not provide this (verified — not in
   * its accommodations response), so it's populated lazily on first
   * "Configure" click via a one-shot Gemini lookup (api/src/ai/roomLookup.ts)
   * and cached here to avoid repeat LLM calls. Undefined until looked up;
   * a failed/unconfident lookup is never cached (left undefined) so it can
   * be retried later rather than permanently stuck on a guess.
   */
  rooms?: number;
  createdAt: Date;
  updatedAt: Date;
}

export const HotelSchema = new Schema<HotelDoc>(
  {
    stayId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    supplier: { type: String, required: true },
    city: String,
    country: String,
    stars: { type: Number, min: 1, max: 5 },
    rating: { type: Number, min: 0, max: 5 },
    price: {
      amount: { type: Number, min: 0 },
      currency: { type: String, minlength: 3, maxlength: 3 },
      per: { type: String, enum: ["night", "stay"], default: "night" },
    },
    amenities: { type: [String], default: [] },
    images: { type: [String], default: [] },
    rooms: { type: Number, min: 1 },
    coordinates: {
      type: { type: String, enum: ["Point"], required: true },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: (v: number[]) =>
            v.length === 2 &&
            v[0]! >= -180 &&
            v[0]! <= 180 &&
            v[1]! >= -90 &&
            v[1]! <= 90,
          message: "coordinates must be [lng, lat] within valid bounds",
        },
      },
    },
  },
  { timestamps: true },
);
HotelSchema.index({ coordinates: "2dsphere" });

export type HotelModel = Model<HotelDoc>;
