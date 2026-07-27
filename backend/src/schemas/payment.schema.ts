import { z } from "zod";

export const initiatePaymentSchema = z
  .object({
    bookingId: z.string().min(1),
    provider: z.enum(["khalti", "esewa"]),
  })
  .strict();

export const demoPaymentConfirmationSchema = z
  .object({
    outcome: z.enum(["succeeded", "failed"]),
  })
  .strict();

export const adminPaymentStatusSchema = z
  .object({
    status: z.enum(["failed", "refunded"]),
    note: z.string().trim().max(500).optional(),
  })
  .strict();
