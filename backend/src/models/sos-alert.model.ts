// backend/src/models/sos-alert.model.ts
import mongoose, { Schema, Document } from "mongoose";

export interface ISosAlert extends Document {
    userId: Schema.Types.ObjectId | string;
    bookingId: Schema.Types.ObjectId | string | null;
    latitude: number | null;
    longitude: number | null;
    note: string | null;
    status: "open" | "responding" | "closed";
    createdAt: Date;
    updatedAt: Date;
}

const sosAlertSchema: Schema<ISosAlert> = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: "users", required: true, index: true },
    bookingId: { type: Schema.Types.ObjectId, ref: "bookings", default: null },
    latitude: { type: Number, min: -90, max: 90, default: null },
    longitude: { type: Number, min: -180, max: 180, default: null },
    note: { type: String, maxlength: 500, default: null },
    status: { type: String, enum: ["open", "responding", "closed"], default: "open", index: true },
}, {
    timestamps: true,
});

// Emergency coordinates are sensitive and are automatically removed after
// 30 days. Operational incident records should be retained separately.
sosAlertSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 },
);

const SosAlertModel = (mongoose.models.sos_alerts as mongoose.Model<ISosAlert>) ?? mongoose.model<ISosAlert>("sos_alerts", sosAlertSchema);

export default SosAlertModel;
