// backend/src/models/damage-report.model.ts
import mongoose, { Schema, Document } from "mongoose";

export interface IDamageReport extends Document {
    bookingId: Schema.Types.ObjectId | string;
    bikeId: Schema.Types.ObjectId | string;
    reportedBy: Schema.Types.ObjectId | string;
    photos: string[];
    description: string;
    status: "open" | "reviewed" | "resolved";
    resolvedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

const damageReportSchema: Schema<IDamageReport> = new Schema({
    bookingId: { type: Schema.Types.ObjectId, ref: "bookings", required: true, index: true },
    bikeId: { type: Schema.Types.ObjectId, ref: "bikes", required: true, index: true },
    reportedBy: { type: Schema.Types.ObjectId, ref: "users", required: true, index: true },
    photos: { type: [String], default: [], validate: [(photos: string[]) => photos.length >= 1, "At least one photo is required"] },
    description: { type: String, required: true, maxlength: 2000 },
    status: { type: String, enum: ["open", "reviewed", "resolved"], default: "open", index: true },
    resolvedAt: { type: Date, default: null },
}, {
    timestamps: true,
});

const DamageReportModel = (mongoose.models.damage_reports as mongoose.Model<IDamageReport>) ?? mongoose.model<IDamageReport>("damage_reports", damageReportSchema);

export default DamageReportModel;
