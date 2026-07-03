import mongoose, { Schema, Document } from "mongoose";
import type { Payment } from "./../types/payment.type.ts";

export interface IPayment extends Omit<Payment, "bookingId" | "payerId"> {
    bookingId: Schema.Types.ObjectId | string;
    payerId: Schema.Types.ObjectId | string;
    createdAt: Date;
    updatedAt: Date;
}

const paymentSchema: Schema<IPayment> = new Schema({
    bookingId: { type: Schema.Types.ObjectId, ref: "bookings", required: true, index: true },
    payerId: { type: Schema.Types.ObjectId, ref: "users", required: true, index: true },
    provider: { type: String, required: true, enum: ["khalti", "esewa", "manual"] },
    amount: { type: Number, required: true },
    currency: { type: String, required: true, default: "NPR" },
    status: { type: String, required: true, enum: ["pending", "succeeded", "failed", "refunded"], default: "pending", index: true },
    transactionRef: { type: String, required: true, unique: true, index: true },
    gatewayMessage: { type: String, default: null },
    receiptUrl: { type: String, default: null },
}, {
    timestamps: true,
});

const PaymentModel = (mongoose.models.payments as mongoose.Model<IPayment>) ?? mongoose.model<IPayment>("payments", paymentSchema);

export default PaymentModel;
