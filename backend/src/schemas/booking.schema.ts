import { z } from "zod";

export const createBookingSchema = z.object({
    bikeId: z.string().min(1),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    pickupLocation: z.string().min(3).max(255),
    dropoffLocation: z.string().min(3).max(255).optional(),
    notes: z.string().max(2000).optional(),
});

export const bookingListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    status: z.enum(["pending", "confirmed", "cancelled", "completed", "rejected"]).optional(),
    paymentStatus: z.enum(["unpaid", "pending", "paid", "failed", "refunded"]).optional(),
});

export const cancelBookingSchema = z.object({
    reason: z.string().min(3).max(500),
});
