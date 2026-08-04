import mongoose, { Schema } from "mongoose";
import type { Payment } from "./../types/payment.type.ts";

export interface IPayment extends Omit<Payment, "bookingId" | "payerId"> {
  bookingId: Schema.Types.ObjectId | string;
  payerId: Schema.Types.ObjectId | string;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema: Schema<IPayment> = new Schema(
  {
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: "bookings",
      required: true,
      index: true,
      immutable: true,
    },
    payerId: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: true,
      index: true,
      immutable: true,
    },
    provider: {
      type: String,
      required: true,
      enum: ["khalti", "esewa", "manual"],
      immutable: true,
    },
    mode: {
      type: String,
      required: true,
      enum: ["demo", "sandbox", "live"],
      default: "demo",
      immutable: true,
    },
    amount: { type: Number, required: true, immutable: true },
    amountMinor: { type: Number, required: true, min: 1, immutable: true },
    currency: {
      type: String,
      required: true,
      default: "NPR",
      immutable: true,
    },
    status: {
      type: String,
      required: true,
      enum: ["pending", "succeeded", "failed", "refunded"],
      default: "pending",
      index: true,
    },
    transactionRef: {
      type: String,
      required: true,
      unique: true,
      index: true,
      immutable: true,
    },
    providerPaymentId: {
      type: String,
    },
    providerTransactionId: { type: String, default: null },
    providerStatus: { type: String, default: null },
    providerExpiresAt: { type: Date, default: null },
    verifiedAt: { type: Date, default: null },
    paymentUrl: { type: String, default: null },
    checkoutTokenHash: { type: String, default: null, select: false },
    checkoutExpiresAt: { type: Date, default: null },
    checkoutOpenedAt: { type: Date, default: null },
    lastLookupAt: { type: Date, default: null },
    reconciliationRequired: { type: Boolean, default: false },
    reconciliationMessage: { type: String, default: null },
    gatewayMessage: { type: String, default: null },
    receiptUrl: { type: String, default: null },
  },
  {
    timestamps: true,
  },
);

// A booking may have historical attempts, but never two active wallet attempts.
paymentSchema.index(
  { bookingId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "pending" },
    name: "one_pending_payment_per_booking",
  },
);
paymentSchema.index(
  { providerPaymentId: 1 },
  {
    unique: true,
    partialFilterExpression: { providerPaymentId: { $type: "string" } },
    name: "unique_provider_payment_id",
  },
);

const PaymentModel =
  (mongoose.models.payments as mongoose.Model<IPayment>) ??
  mongoose.model<IPayment>("payments", paymentSchema);

export default PaymentModel;
