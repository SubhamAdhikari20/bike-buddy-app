import { z } from "zod";

export const ownerListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    status: z.enum(["none", "pending", "verified", "rejected"]).optional(),
  })
  .strict();

export const ownerVerificationSchema = z
  .object({
    status: z.enum(["verified", "rejected"]),
  })
  .strict();

export const kycReviewSchema = z
  .object({
    status: z.enum(["approved", "rejected"]),
  })
  .strict();

export const kycListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z
      .enum(["unverified", "pending", "approved", "rejected"])
      .default("pending"),
  })
  .strict();

export const bikeStatusSchema = z
  .object({
    status: z.enum(["available", "unavailable", "maintenance", "inactive"]),
  })
  .strict();

export const bookingStatusSchema = z
  .object({
    status: z.enum([
      "pending",
      "confirmed",
      "cancelled",
      "completed",
      "rejected",
    ]),
  })
  .strict();
