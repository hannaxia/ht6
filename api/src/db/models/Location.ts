import { Schema, type Model, type Types } from "mongoose";

export interface LocationDoc {
  _id: Types.ObjectId;
  city: string;
  country: string;
  coordinates: { type: "Point"; coordinates: [number, number] };
  tourism_score: number;
  business_score: number;
  transit_score: number;
  population_density: number;
  hotel_density: number;
  createdAt: Date;
  updatedAt: Date;
}

export const LocationSchema = new Schema<LocationDoc>(
  {
    city: { type: String, required: true },
    country: { type: String, required: true },
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
    tourism_score: { type: Number, required: true, min: 0, max: 1 },
    business_score: { type: Number, required: true, min: 0, max: 1 },
    transit_score: { type: Number, required: true, min: 0, max: 1 },
    population_density: { type: Number, required: true, min: 0 },
    hotel_density: { type: Number, required: true, min: 0 },
  },
  { timestamps: true },
);
LocationSchema.index({ coordinates: "2dsphere" });

export type LocationModel = Model<LocationDoc>;
