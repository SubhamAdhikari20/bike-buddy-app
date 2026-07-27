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

const checklistKeys = ["brakes", "lights", "fuel", "body"] as const;

export const checklistSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            key: z.enum(checklistKeys),
            ok: z.boolean(),
            note: z.string().trim().min(3).max(300).nullish(),
          })
          .strict(),
      )
      .length(checklistKeys.length),
    photos: z
      .array(z.string().url())
      .min(1, "Add at least one handover photo")
      .max(5),
    acknowledged: z.literal(true),
  })
  .strict()
  .superRefine((value, context) => {
    const keys = new Set(value.items.map((item) => item.key));
    if (keys.size !== checklistKeys.length) {
      context.addIssue({
        code: "custom",
        path: ["items"],
        message: "Submit every checklist item exactly once",
      });
    }
    value.items.forEach((item, index) => {
      if (!item.ok && !item.note) {
        context.addIssue({
          code: "custom",
          path: ["items", index, "note"],
          message: "Describe any item that is not okay",
        });
      }
    });
  });

export const extendBookingSchema = z
  .object({
    extraHours: z.number().int().min(1).max(24),
  })
  .strict();
