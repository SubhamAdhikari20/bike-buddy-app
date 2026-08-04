import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authenticate } from "../middlewares/auth.ts";
import validate from "../middlewares/validate.ts";
import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  streamNotifications,
} from "../controllers/notification.controller.ts";
import {
  notificationIdParamsSchema,
  notificationListQuerySchema,
  notificationStreamQuerySchema,
} from "../schemas/notification.schema.ts";

const streamLimiter = rateLimit({
  windowMs: 60_000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.auth!.userId,
  message: {
    success: false,
    message: "Too many notification stream connections. Retry shortly.",
    code: "NOTIFICATION_STREAM_RATE_LIMIT",
  },
});

const notificationRoutes = Router();
notificationRoutes.use(authenticate);
notificationRoutes.get(
  "/stream",
  streamLimiter,
  validate(notificationStreamQuerySchema, "query"),
  streamNotifications,
);
notificationRoutes.get("/unread-count", getUnreadNotificationCount);
notificationRoutes.patch("/read-all", markAllNotificationsRead);
notificationRoutes.patch(
  "/:notificationId/read",
  validate(notificationIdParamsSchema, "params"),
  markNotificationRead,
);
notificationRoutes.get(
  "/",
  validate(notificationListQuerySchema, "query"),
  listNotifications,
);

export default notificationRoutes;
