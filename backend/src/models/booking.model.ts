import mongoose, { Schema, Document } from "mongoose";
import type { Booking } from "./../types/booking.type.ts";

export interface IBooking extends Omit<Booking, "bikeId" | "renterId" | "ownerId"> {
    bikeId: Schema.Types.ObjectId | string;
    renterId: Schema.Types.ObjectId | string;
    ownerId: Schema.Types.ObjectId | string;
    createdAt: Date;
    updatedAt: Date;
}

const bookingSchema: Schema<IBooking> = new Schema({
    bikeId: { type: Schema.Types.ObjectId, ref: "bikes", required: true, index: true },
    renterId: { type: Schema.Types.ObjectId, ref: "renters", required: true, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "owners", required: true, index: true },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },
    pickupLocation: { type: String, required: true },
    dropoffLocation: { type: String, default: null },
    notes: { type: String, default: null },
    status: { type: String, required: true, enum: ["pending", "confirmed", "cancelled", "completed", "rejected"], default: "pending", index: true },
    paymentStatus: { type: String, required: true, enum: ["unpaid", "pending", "paid", "failed", "refunded"], default: "unpaid", index: true },
    totalAmount: { type: Number, required: true },
    currency: { type: String, required: true, default: "NPR" },
    cancellationReason: { type: String, default: null },
}, {
    timestamps: true,
});

bookingSchema.index({ bikeId: 1, startDate: 1, endDate: 1, status: 1 });

const BookingModel = (mongoose.models.bookings as mongoose.Model<IBooking>) ?? mongoose.model<IBooking>("bookings", bookingSchema);

export default BookingModel;
