import AppError from "../errors/AppError.ts";
import { bookingRepository } from "../repositories/booking.repository.ts";
import { paymentRepository } from "../repositories/payment.repository.ts";
import type { AuthRole } from "../interfaces/auth.interface.ts";

const ensurePaymentAccess = (auth: { userId: string; role: AuthRole; profileId?: string }, booking: any) => {
    if (auth.role === "admin") {
        return;
    }

    if (booking.renterId?.toString() === auth.profileId) {
        return;
    }

    throw new AppError(403, "You do not have access to this payment", "FORBIDDEN");
};

const paymentService = {
    // Starts a payment for a booking. The amount always comes from the
    // locked booking total, never from the client (PR-07), and a booking
    // that is already paid cannot be charged twice (PR-05).
    async initiatePayment(auth: { userId: string; role: AuthRole; profileId?: string }, payload: { bookingId: string; provider: "khalti" | "esewa" | "manual" }) {
        const booking = await bookingRepository.findById(payload.bookingId);
        if (!booking) {
            throw new AppError(404, "Booking not found", "NOT_FOUND");
        }

        ensurePaymentAccess(auth, booking);

        if (booking.paymentStatus === "paid") {
            throw new AppError(409, "This booking is already paid. You were not charged again.", "CONFLICT");
        }

        const transactionRef = `BB-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        const payment = await paymentRepository.create({
            bookingId: payload.bookingId,
            payerId: auth.userId,
            provider: payload.provider,
            amount: booking.totalAmount,
            currency: booking.currency ?? "NPR",
            status: "pending",
            transactionRef,
            gatewayMessage: null,
            receiptUrl: null,
        });

        await bookingRepository.updateById(payload.bookingId, { paymentStatus: "pending" });

        return {
            paymentId: payment._id.toString(),
            transactionRef,
            amount: booking.totalAmount,
            currency: booking.currency ?? "NPR",
            provider: payload.provider,
            // Sandbox gateway page; swap for the live eSewa/Khalti URLs
            // with real merchant credentials.
            paymentUrl: payload.provider === "manual"
                ? null
                : `https://sandbox.${payload.provider}.com.np/pay?ref=${transactionRef}`,
        };
    },

    // Confirms or fails a pending payment. A failed attempt keeps the
    // booking intact so retrying never re-enters details (PR-05).
    async verifyPayment(auth: { userId: string; role: AuthRole; profileId?: string }, paymentId: string, payload: { status: "succeeded" | "failed"; gatewayMessage?: string }) {
        const payment = await paymentRepository.findById(paymentId);
        if (!payment) {
            throw new AppError(404, "Payment not found", "NOT_FOUND");
        }

        const booking = payment.bookingId as any;
        ensurePaymentAccess(auth, booking);

        if (payment.status === "succeeded") {
            throw new AppError(409, "This payment already went through. No extra charge was made.", "CONFLICT");
        }

        const updated = await paymentRepository.updateById(paymentId, {
            status: payload.status,
            gatewayMessage: payload.gatewayMessage ?? null,
        });

        await bookingRepository.updateById(booking._id.toString(), {
            paymentStatus: payload.status === "succeeded" ? "paid" : "failed",
            status: payload.status === "succeeded" && booking.status === "pending" ? "confirmed" : booking.status,
        });

        return {
            payment: updated,
            charged: payload.status === "succeeded",
            message: payload.status === "succeeded"
                ? "Payment successful. Your booking is confirmed."
                : "Payment failed. You were NOT charged - you can try again with the same details.",
        };
    },

    async createPayment(auth: { userId: string; role: AuthRole; profileId?: string }, payload: { bookingId: string; provider: "khalti" | "esewa" | "manual"; amount: number; currency?: string; transactionRef: string; receiptUrl?: string }) {
        const booking = await bookingRepository.findById(payload.bookingId);
        if (!booking) {
            throw new AppError(404, "Booking not found", "NOT_FOUND");
        }

        ensurePaymentAccess(auth, booking);

        if (Number(payload.amount) !== Number(booking.totalAmount)) {
            throw new AppError(400, "Payment amount does not match the booking total", "BAD_REQUEST");
        }

        const existingPayment = await paymentRepository.findByTransactionRef(payload.transactionRef);
        if (existingPayment) {
            throw new AppError(409, "Transaction reference already exists", "CONFLICT");
        }

        const payment = await paymentRepository.create({
            bookingId: payload.bookingId,
            payerId: auth.userId,
            provider: payload.provider,
            amount: payload.amount,
            currency: payload.currency ?? booking.currency ?? "NPR",
            status: "pending",
            transactionRef: payload.transactionRef,
            gatewayMessage: null,
            receiptUrl: payload.receiptUrl ?? null,
        });

        await bookingRepository.updateById(payload.bookingId, { paymentStatus: "pending" });
        return payment;
    },

    async getPayment(auth: { userId: string; role: AuthRole; profileId?: string }, paymentId: string) {
        const payment = await paymentRepository.findById(paymentId);
        if (!payment) {
            throw new AppError(404, "Payment not found", "NOT_FOUND");
        }

        const booking = payment.bookingId as any;
        ensurePaymentAccess(auth, booking);
        return payment;
    },

    async updatePaymentStatus(auth: { userId: string; role: AuthRole; profileId?: string }, paymentId: string, payload: { status: "pending" | "succeeded" | "failed" | "refunded"; gatewayMessage?: string }) {
        const payment = await paymentRepository.findById(paymentId);
        if (!payment) {
            throw new AppError(404, "Payment not found", "NOT_FOUND");
        }

        const booking = payment.bookingId as any;
        ensurePaymentAccess(auth, booking);

        const updated = await paymentRepository.updateById(paymentId, {
            status: payload.status,
            gatewayMessage: payload.gatewayMessage ?? null,
        });

        await bookingRepository.updateById(booking._id.toString(), {
            paymentStatus: payload.status === "succeeded" ? "paid" : payload.status,
            status: payload.status === "succeeded" && booking.status === "pending" ? "confirmed" : booking.status,
        });

        return updated;
    },
};

export default paymentService;
