export const notificationTypes = [
  "booking.created",
  "booking.approved",
  "booking.rejected",
  "booking.cancelled",
  "booking.completed",
  "booking.cash_received",
  "booking.rescheduled",
  "payment.succeeded",
  "payment.failed",
  "payment.refunded",
  "payment.reconciliation_required",
  "owner.approved",
  "owner.rejected",
  "kyc.approved",
  "kyc.rejected",
  "bike.approved",
  "bike.rejected",
  "review.created",
  "support.created",
  "support.updated",
  "damage_report.created",
  "damage_report.updated",
  "sos.created",
  "sos.updated",
] as const;

export const notificationSeverities = [
  "info",
  "success",
  "warning",
  "error",
] as const;

export const notificationResources = [
  "booking",
  "bike",
  "payment",
  "review",
  "support_ticket",
  "damage_report",
  "sos_alert",
  "profile",
] as const;

export type NotificationType = (typeof notificationTypes)[number];
export type NotificationSeverity = (typeof notificationSeverities)[number];
export type NotificationResource = (typeof notificationResources)[number];

export type NotificationAction = {
  resource: NotificationResource;
  id: string;
};

export type NotificationDto = {
  _id: string;
  sequence: number;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  action: NotificationAction | null;
  readAt: Date | null;
  createdAt: Date;
};

export type NotificationEmission = {
  recipientId: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  action: NotificationAction | null;
  dedupeKey: string;
};
