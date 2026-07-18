import { Schema, type Model, type Types } from "mongoose";

export interface SimulationDoc {
  _id: Types.ObjectId;
  sessionId: string;
  startingHotelId: Types.ObjectId | null;
  changes: Record<string, unknown>;
  beforeMetrics: Record<string, unknown> | null;
  afterMetrics: Record<string, unknown>;
  createdAt: Date;
}

export const SimulationSchema = new Schema<SimulationDoc>(
  {
    sessionId: { type: String, required: true },
    startingHotelId: {
      type: Schema.Types.ObjectId,
      ref: "Hotel",
      default: null,
    },
    changes: { type: Schema.Types.Mixed, default: {} },
    beforeMetrics: { type: Schema.Types.Mixed, default: null },
    afterMetrics: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
SimulationSchema.index({ sessionId: 1, createdAt: -1 });

export type SimulationModel = Model<SimulationDoc>;
