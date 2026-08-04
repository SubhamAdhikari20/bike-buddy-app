import { z } from "zod";
import type { IPayment } from "./../models/payment.model.ts";

const paymentTypeSchema = z.object({
  bookingId: z.string(),
  payerId: z.string(),
  provider: z.enum(["khalti", "esewa", "manual"]),
  mode: z.enum(["demo", "sandbox", "live"]),
  amount: z.number(),
  amountMinor: z.number().int(),
  currency: z.string(),
  status: z.enum(["pending", "succeeded", "failed", "refunded"]),
  transactionRef: z.string(),
  providerPaymentId: z.string().nullish(),
  providerTransactionId: z.string().nullish(),
  providerStatus: z.string().nullish(),
  providerExpiresAt: z.date().nullish(),
  verifiedAt: z.date().nullish(),
  paymentUrl: z.string().nullish(),
  checkoutTokenHash: z.string().nullish(),
  checkoutExpiresAt: z.date().nullish(),
  checkoutOpenedAt: z.date().nullish(),
  lastLookupAt: z.date().nullish(),
  reconciliationRequired: z.boolean().optional(),
  reconciliationMessage: z.string().nullish(),
  gatewayMessage: z.string().nullish(),
  receiptUrl: z.string().nullish(),
});

export type Payment = z.infer<typeof paymentTypeSchema>;
export type PaymentDocument = IPayment;
