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
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    note: { type: String, default: null },
    status: { type: String, enum: ["open", "responding", "closed"], default: "open", index: true },
}, {
    timestamps: true,
});

const SosAlertModel = (mongoose.models.sos_alerts as mongoose.Model<ISosAlert>) ?? mongoose.model<ISosAlert>("sos_alerts", sosAlertSchema);

export default SosAlertModel;
