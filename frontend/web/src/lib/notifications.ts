import { api, apiUrl, type Role } from "@/lib/api";

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

export type NotificationType = (typeof notificationTypes)[number];

export const notificationSeverities = [
  "info",
  "success",
  "warning",
  "error",
] as const;

export type NotificationSeverity = (typeof notificationSeverities)[number];

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

export type NotificationResource = (typeof notificationResources)[number];

export type NotificationAction = {
  resource: NotificationResource;
  id: string;
};

export type NotificationItem = {
  _id: string;
  sequence: number;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  action: NotificationAction | null;
  readAt: string | null;
  createdAt: string;
};

export type NotificationPage = {
  items: NotificationItem[];
  pageInfo: {
    nextCursor: number | null;
    hasMore: boolean;
  };
  unreadCount: number;
};

export type NotificationReadyEvent = {
  latestSequence: number;
  unreadCount: number;
};

export type NotificationResyncEvent = {
  reason: "replay_limit_exceeded";
  latestSequence: number;
};

const typeSet = new Set<string>(notificationTypes);
const severitySet = new Set<string>(notificationSeverities);
const resourceSet = new Set<string>(notificationResources);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isPositiveSequence = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0;

const isNonNegativeSequence = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

const isNotificationAction = (value: unknown): value is NotificationAction =>
  isRecord(value) &&
  typeof value.resource === "string" &&
  resourceSet.has(value.resource) &&
  typeof value.id === "string" &&
  value.id.length > 0;

export const isNotificationItem = (value: unknown): value is NotificationItem =>
  isRecord(value) &&
  typeof value._id === "string" &&
  value._id.length > 0 &&
  isPositiveSequence(value.sequence) &&
  typeof value.type === "string" &&
  typeSet.has(value.type) &&
  typeof value.severity === "string" &&
  severitySet.has(value.severity) &&
  typeof value.title === "string" &&
  value.title.length > 0 &&
  typeof value.message === "string" &&
  (value.action === null || isNotificationAction(value.action)) &&
  (value.readAt === null || typeof value.readAt === "string") &&
  typeof value.createdAt === "string";

export const isNotificationReadyEvent = (
  value: unknown,
): value is NotificationReadyEvent =>
  isRecord(value) &&
  isNonNegativeSequence(value.latestSequence) &&
  typeof value.unreadCount === "number" &&
  Number.isSafeInteger(value.unreadCount) &&
  value.unreadCount >= 0;

export const isNotificationResyncEvent = (
  value: unknown,
): value is NotificationResyncEvent =>
  isRecord(value) &&
  value.reason === "replay_limit_exceeded" &&
  isNonNegativeSequence(value.latestSequence);

export function parseServerEvent<T>(
  event: MessageEvent<string>,
  guard: (value: unknown) => value is T,
): T | null {
  try {
    const value: unknown = JSON.parse(event.data);
    return guard(value) ? value : null;
  } catch {
    return null;
  }
}

export const notificationsApi = {
  list: ({
    before,
    limit = 20,
    unreadOnly = false,
  }: {
    before?: number;
    limit?: number;
    unreadOnly?: boolean;
  } = {}) => {
    const query = new URLSearchParams({
      limit: String(Math.min(50, Math.max(1, limit))),
      unreadOnly: String(unreadOnly),
    });
    if (before !== undefined && before > 0) {
      query.set("before", String(before));
    }
    return api.get<NotificationPage>(`/notifications?${query.toString()}`);
  },
  unreadCount: () =>
    api.get<{ unreadCount: number }>("/notifications/unread-count"),
  markRead: (notificationId: string) =>
    api.patchEmpty<NotificationItem>(
      `/notifications/${encodeURIComponent(notificationId)}/read`,
    ),
  markAllRead: () =>
    api.patchEmpty<{ updatedCount: number; readAt: string }>(
      "/notifications/read-all",
    ),
};

export const notificationStreamUrl = (after: number) => {
  const query = new URLSearchParams({ after: String(Math.max(0, after)) });
  return apiUrl(`/notifications/stream?${query.toString()}`);
};

const mongoIdPattern = /^[a-f\d]{24}$/i;

export function notificationHref(
  action: NotificationAction | null,
  role: Role,
): string | null {
  if (!action || role === "renter" || !mongoIdPattern.test(action.id)) {
    return null;
  }

  const id = encodeURIComponent(action.id);
  if (role === "admin") {
    switch (action.resource) {
      case "bike":
        return `/admin/bikes/${id}`;
      case "booking":
      case "payment":
        return "/admin/bookings";
      case "support_ticket":
        return "/admin/tickets";
      case "profile":
        return "/profile";
      default:
        return null;
    }
  }

  switch (action.resource) {
    case "bike":
      return `/owner/bikes/${id}`;
    case "booking":
    case "payment":
      return "/owner/bookings";
    case "damage_report":
      return "/owner/damages";
    case "profile":
      return "/profile";
    default:
      return null;
  }
}

export const notificationTypeLabel = (type: NotificationType) =>
  type
    .split(".")
    .map((part) => part.replaceAll("_", " "))
    .join(" · ");
