import { z } from "zod";
import type { IPayment } from "./../models/payment.model.ts";

const paymentTypeSchema = z.object({
    bookingId: z.string(),
    payerId: z.string(),
    provider: z.enum(["khalti", "esewa", "manual"]),
    amount: z.number(),
    currency: z.string(),
    status: z.enum(["pending", "succeeded", "failed", "refunded"]),
    transactionRef: z.string(),
    gatewayMessage: z.string().nullish(),
    receiptUrl: z.string().nullish(),
});

export type Payment = z.infer<typeof paymentTypeSchema>;
export type PaymentDocument = IPayment;
