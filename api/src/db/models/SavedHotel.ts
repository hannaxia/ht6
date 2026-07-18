import { Schema, type Model, type Types } from "mongoose";

/**
 * A user's saved sandbox hotel — a named hotel configuration (plus its last
 * computed simulation metrics) that a logged-in user can return to from the
 * profile page or the map. `userId` is the caller's session identity (the
 * Auth0 subject when logged in), matching how Simulations are attributed.
 */
export interface SavedHotelDoc {
  _id: Types.ObjectId;
  userId: string;
  name: string;
  config: Record<string, unknown>;
  metrics: Record<string, unknown> | null;
  coordinates: { type: "Point"; coordinates: [number, number] };
  createdAt: Date;
  updatedAt: Date;
}

export const SavedHotelSchema = new Schema<SavedHotelDoc>(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    config: { type: Schema.Types.Mixed, required: true },
    metrics: { type: Schema.Types.Mixed, default: null },
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
SavedHotelSchema.index({ userId: 1, updatedAt: -1 });
SavedHotelSchema.index({ coordinates: "2dsphere" });

export type SavedHotelModel = Model<SavedHotelDoc>;
