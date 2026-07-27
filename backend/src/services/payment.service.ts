import crypto from "node:crypto";
import AppError from "../errors/AppError.ts";
import { PAYMENT_MODE } from "../config/index.ts";
import { bookingRepository } from "../repositories/booking.repository.ts";
import { paymentRepository } from "../repositories/payment.repository.ts";
import type { AuthRole } from "../interfaces/auth.interface.ts";
import { referencesDocument, toDocumentId } from "../utils/mongo-reference.ts";

const ensurePaymentAccess = (
  auth: { userId: string; role: AuthRole; profileId?: string },
  booking: any,
) => {
  if (auth.role === "admin") return;
  if (
    auth.role === "renter" &&
    referencesDocument(booking.renterId, auth.profileId)
  ) {
    return;
  }

  throw new AppError(
    403,
    "You do not have access to this payment",
    "FORBIDDEN",
  );
};

const createTransactionReference = () =>
  `BB-${crypto.randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`;

const toPaymentSession = (payment: any) => ({
  paymentId: payment._id.toString(),
  transactionRef: payment.transactionRef,
  amount: payment.amount,
  currency: payment.currency,
  provider: payment.provider,
  mode: payment.mode,
  paymentUrl: null,
  demoConfirmationRequired: payment.mode === "demo",
  notice:
    payment.mode === "demo"
      ? "Coursework demo only — no money will be charged."
      : null,
});

const paymentService = {
  async initiatePayment(
    auth: { userId: string; role: AuthRole; profileId?: string },
    payload: { bookingId: string; provider: "khalti" | "esewa" },
  ) {
    if (auth.role !== "renter") {
      throw new AppError(403, "Only renters can start payments", "FORBIDDEN");
    }

    const booking = await bookingRepository.findById(payload.bookingId);
    if (!booking) {
      throw new AppError(404, "Booking not found", "NOT_FOUND");
    }
    ensurePaymentAccess(auth, booking);

    if (booking.paymentStatus === "paid") {
      throw new AppError(
        409,
        "This booking is already paid. No second payment was created.",
        "CONFLICT",
      );
    }
    if (!["pending", "confirmed"].includes(booking.status)) {
      throw new AppError(
        409,
        "Payments are not accepted for this booking state",
        "CONFLICT",
      );
    }

    if (PAYMENT_MODE === "live") {
      throw new AppError(
        501,
        "Live payment processing is not configured. Add a verified provider adapter before accepting money.",
        "PAYMENT_PROVIDER_NOT_CONFIGURED",
      );
    }

    const existing = await paymentRepository.findPendingByBookingAndProvider(
      payload.bookingId,
      payload.provider,
    );
    if (existing) {
      return toPaymentSession(existing);
    }

    const payment = await paymentRepository.create({
      bookingId: payload.bookingId,
      payerId: auth.userId,
      provider: payload.provider,
      mode: "demo",
      amount: booking.totalAmount,
      currency: booking.currency ?? "NPR",
      status: "pending",
      transactionRef: createTransactionReference(),
      gatewayMessage: "Awaiting demo confirmation",
      receiptUrl: null,
    });
    await bookingRepository.updateById(payload.bookingId, {
      paymentStatus: "pending",
      paymentMethod: "wallet",
    });

    return toPaymentSession(payment);
  },

  async confirmDemoPayment(
    auth: { userId: string; role: AuthRole; profileId?: string },
    paymentId: string,
    payload: { outcome: "succeeded" | "failed" },
  ) {
    if (PAYMENT_MODE !== "demo") {
      throw new AppError(
        404,
        "Demo payment confirmation is disabled",
        "NOT_FOUND",
      );
    }

    const payment = await paymentRepository.findById(paymentId);
    if (!payment) {
      throw new AppError(404, "Payment not found", "NOT_FOUND");
    }
    const booking = payment.bookingId as any;
    ensurePaymentAccess(auth, booking);

    if (payment.mode !== "demo") {
      throw new AppError(
        400,
        "Only demo payments can use this endpoint",
        "BAD_REQUEST",
      );
    }
    if (payment.status !== "pending") {
      throw new AppError(
        409,
        "This demo payment has already been resolved",
        "CONFLICT",
      );
    }

    const updated = await paymentRepository.transitionPendingById(paymentId, {
      status: payload.outcome,
      gatewayMessage:
        payload.outcome === "succeeded"
          ? "Demo payment approved — no money was charged"
          : "Demo payment declined — no money was charged",
    });
    if (!updated) {
      throw new AppError(
        409,
        "This demo payment was resolved by another request",
        "CONFLICT",
      );
    }

    const succeeded = payload.outcome === "succeeded";
    await bookingRepository.updateById(toDocumentId(booking) ?? "", {
      paymentStatus: succeeded ? "paid" : "failed",
      paymentMode: "demo",
      paymentMethod: "wallet",
      status:
        succeeded && booking.status === "pending"
          ? "confirmed"
          : booking.status,
    });

    return {
      payment: updated,
      simulated: true,
      succeeded,
      charged: false,
      message: succeeded
        ? "Demo payment completed. No money was charged; the booking is confirmed for coursework testing."
        : "Demo payment failed. No money was charged and your booking details are saved.",
    };
  },

  async getPayment(
    auth: { userId: string; role: AuthRole; profileId?: string },
    paymentId: string,
  ) {
    const payment = await paymentRepository.findById(paymentId);
    if (!payment) {
      throw new AppError(404, "Payment not found", "NOT_FOUND");
    }
    ensurePaymentAccess(auth, payment.bookingId);
    return payment;
  },

  async updatePaymentStatus(
    auth: { userId: string; role: AuthRole; profileId?: string },
    paymentId: string,
    payload: { status: "failed" | "refunded"; note?: string },
  ) {
    if (auth.role !== "admin") {
      throw new AppError(
        403,
        "Only administrators can moderate payment states",
        "FORBIDDEN",
      );
    }

    const payment = await paymentRepository.findById(paymentId);
    if (!payment) {
      throw new AppError(404, "Payment not found", "NOT_FOUND");
    }
    if (payload.status === "refunded" && payment.status !== "succeeded") {
      throw new AppError(
        409,
        "Only a successful payment can be marked as refunded",
        "CONFLICT",
      );
    }

    const booking = payment.bookingId as any;
    const updated = await paymentRepository.updateById(paymentId, {
      status: payload.status,
      gatewayMessage: payload.note ?? `Marked ${payload.status} by admin`,
    });
    await bookingRepository.updateById(toDocumentId(booking) ?? "", {
      paymentStatus: payload.status,
    });
    return updated;
  },
};

export default paymentService;
