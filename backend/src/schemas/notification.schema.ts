import { z } from "zod";
import {
  notificationResources,
  notificationSeverities,
  notificationTypes,
} from "../types/notification.type.ts";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "A valid ID is required");
const safeNotificationText = (maximum: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(maximum)
    .refine(
      (value) => !/https?:\/\/|\/uploads\//i.test(value),
      "Notification text cannot contain URLs or private media paths",
    );

export const notificationEmissionSchema = z
  .object({
    recipientId: objectId,
    type: z.enum(notificationTypes),
    severity: z.enum(notificationSeverities),
    title: safeNotificationText(80),
    message: safeNotificationText(240),
    action: z
      .object({
        resource: z.enum(notificationResources),
        id: objectId,
      })
      .strict()
      .nullable(),
    dedupeKey: z
      .string()
      .min(3)
      .max(200)
      .regex(/^[a-z0-9][a-z0-9:._-]*$/i),
  })
  .strict();

export const notificationListQuerySchema = z
  .object({
    before: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    unreadOnly: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .default(false),
  })
  .strict();

export const notificationStreamQuerySchema = z
  .object({
    after: z.coerce.number().int().min(0).optional(),
  })
  .strict();

export const notificationIdParamsSchema = z
  .object({ notificationId: objectId })
  .strict();
