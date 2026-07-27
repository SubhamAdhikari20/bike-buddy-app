import { z } from "zod";

export const quoteBookingSchema = z
  .object({
    bikeId: z.string().min(1),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
  })
  .strict();

export const createBookingSchema = quoteBookingSchema
  .extend({
    pickupLocation: z.string().trim().min(3).max(255),
    dropoffLocation: z.string().trim().min(3).max(255).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .strict();

export const bookingListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    status: z
      .enum(["pending", "confirmed", "cancelled", "completed", "rejected"])
      .optional(),
    paymentStatus: z
      .enum(["unpaid", "pending", "paid", "failed", "refunded"])
      .optional(),
  })
  .strict();

export const cancelBookingSchema = z
  .object({
    reason: z.string().trim().min(3).max(500),
  })
  .strict();
