import { z } from "zod";

export const createPaymentSchema = z.object({
    bookingId: z.string().min(1),
    provider: z.enum(["khalti", "esewa", "manual"]),
    amount: z.number().positive(),
    currency: z.string().min(3).max(3).default("NPR"),
    transactionRef: z.string().min(1),
    receiptUrl: z.string().url().optional(),
});

export const updatePaymentStatusSchema = z.object({
    status: z.enum(["pending", "succeeded", "failed", "refunded"]),
    gatewayMessage: z.string().max(2000).optional(),
});
