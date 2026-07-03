import mongoose, { Schema, Document } from "mongoose";
import type { Bike } from "./../types/bike.type.ts";

export interface IBike extends Omit<Bike, "ownerId"> {
    ownerId: Schema.Types.ObjectId | string;
    createdAt: Date;
    updatedAt: Date;
}

const bikeSchema: Schema<IBike> = new Schema({
    ownerId: {
        type: Schema.Types.ObjectId,
        ref: "owners",
        required: true,
        index: true,
    },
    title: { type: String, required: true, trim: true },
    brand: { type: String, required: true, trim: true, index: true },
    model: { type: String, required: true, trim: true, index: true },
    year: { type: Number, required: true, index: true },
    engineCc: { type: Number, required: true },
    fuelType: { type: String, required: true, enum: ["petrol", "diesel", "electric", "hybrid"] },
    transmission: { type: String, required: true, enum: ["manual", "automatic"] },
    condition: { type: String, required: true, enum: ["excellent", "good", "fair", "needs_service"] },
    description: { type: String, default: null },
    pricePerDay: { type: Number, required: true },
    pricePerHour: { type: Number, default: null },
    securityDeposit: { type: Number, default: 0 },
    serviceFee: { type: Number, default: 0 },
    location: {
        label: { type: String, required: true },
        address: { type: String, required: true },
        city: { type: String, required: true, index: true },
        area: { type: String, default: null },
        latitude: { type: Number, default: null },
        longitude: { type: Number, default: null },
    },
    images: {
        type: [{ url: { type: String, required: true }, alt: { type: String, default: null } }],
        default: [],
    },
    status: { type: String, required: true, enum: ["available", "unavailable", "maintenance", "inactive"], default: "available", index: true },
    verifiedBike: { type: Boolean, default: false },
    safetyScore: { type: Number, default: 0, min: 0, max: 100 },
    inspectionNotes: { type: String, default: null },
    tags: { type: [String], default: [] },
    averageRating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
}, {
    timestamps: true,
});

bikeSchema.index({ title: "text", brand: "text", model: "text", "location.city": "text", tags: "text" });

const BikeModel = (mongoose.models.bikes as mongoose.Model<IBike>) ?? mongoose.model<IBike>("bikes", bikeSchema);

export default BikeModel;
