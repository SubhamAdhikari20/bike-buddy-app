import { z } from "zod";
import type { IBooking } from "./../models/booking.model.ts";

const bookingTypeSchema = z.object({
  bikeId: z.string(),
  renterId: z.string(),
  ownerId: z.string(),
  startDate: z.date(),
  endDate: z.date(),
  pickupLocation: z.string(),
  dropoffLocation: z.string().nullish(),
  notes: z.string().nullish(),
  status: z.enum([
    "pending",
    "confirmed",
    "cancelled",
    "completed",
    "rejected",
    "expired",
  ]),
  paymentStatus: z.enum(["unpaid", "pending", "paid", "failed", "refunded"]),
  paymentMode: z.enum(["demo", "sandbox", "live"]).nullish(),
  paymentMethod: z.enum(["wallet", "cash"]).nullish(),
  cashReference: z.string().nullish(),
  cashReceivedAt: z.date().nullish(),
  totalAmount: z.number(),
  currency: z.string(),
  cancellationReason: z.string().nullish(),
  holdExpiresAt: z.date().nullish(),
  holdExpiredAt: z.date().nullish(),
  priceBreakdown: z
    .object({
      pricePerDay: z.number(),
      rentalDays: z.number(),
      baseAmount: z.number(),
      serviceFee: z.number(),
      securityDeposit: z.number(),
      total: z.number(),
    })
    .nullish(),
  priceLockedAt: z.date().nullish(),
  preRideChecklist: z
    .object({
      items: z.array(
        z.object({
          key: z.string(),
          ok: z.boolean(),
          note: z.string().nullish(),
        }),
      ),
      photos: z.array(z.string()),
      acknowledged: z.boolean(),
      completedAt: z.date().nullish(),
    })
    .nullish(),
  rideStartedAt: z.date().nullish(),
  returnedAt: z.date().nullish(),
  lateMinutes: z.number().nullish(),
  lateFeeAmount: z.number().nullish(),
  extensionHours: z.number().nullish(),
  extensionAmount: z.number().nullish(),
});

export type Booking = z.infer<typeof bookingTypeSchema>;
export type BookingDocument = IBooking;
