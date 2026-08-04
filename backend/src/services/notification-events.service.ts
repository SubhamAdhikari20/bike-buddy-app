import mongoose from "mongoose";
import BikeModel from "../models/bike.model.ts";
import BookingModel from "../models/booking.model.ts";
import OwnerModel from "../models/owner.model.ts";
import RenterModel from "../models/renter.model.ts";
import UserModel from "../models/user.model.ts";
import type {
  NotificationAction,
  NotificationSeverity,
  NotificationType,
} from "../types/notification.type.ts";
import { toDocumentId } from "../utils/mongo-reference.ts";
import notificationService from "./notification.service.ts";

type EventContent = {
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  action: NotificationAction | null;
  dedupeKey: string;
};

const baseUserFromPopulatedProfile = (value: unknown) => {
  if (!value || typeof value !== "object" || !("baseUserId" in value)) {
    return null;
  }
  return toDocumentId((value as { baseUserId?: unknown }).baseUserId);
};

const profileBaseUserId = async (
  kind: "owner" | "renter",
  profile: unknown,
) => {
  const populated = baseUserFromPopulatedProfile(profile);
  if (populated) return populated;
  const profileId = toDocumentId(profile);
  if (!profileId || mongoose.connection.readyState !== 1) return null;
  const record =
    kind === "owner"
      ? await OwnerModel.findById(profileId).select("baseUserId").lean()
      : await RenterModel.findById(profileId).select("baseUserId").lean();
  return record ? toDocumentId((record as any).baseUserId) : null;
};

const emitTo = async (recipientId: string | null, content: EventContent) => {
  if (!recipientId) return null;
  return notificationService.emitBestEffort({ recipientId, ...content });
};

const emitToMany = async (
  recipientIds: Array<string | null>,
  content: EventContent,
) => {
  const unique = [...new Set(recipientIds.filter((id): id is string => !!id))];
  return notificationService.emitManyBestEffort(
    unique.map((recipientId) => ({ recipientId, ...content })),
  );
};

const adminUserIds = async () => {
  if (mongoose.connection.readyState !== 1) return [];
  const admins = await UserModel.find({ role: "admin" }).select("_id").lean();
  return admins
    .map((admin) => toDocumentId(admin._id))
    .filter((id): id is string => !!id);
};

const bookingRecord = async (booking: unknown) => {
  if (booking && typeof booking === "object" && "ownerId" in booking) {
    return booking as any;
  }
  const bookingId = toDocumentId(booking);
  return bookingId && mongoose.connection.readyState === 1
    ? BookingModel.findById(bookingId).select("ownerId renterId bikeId").lean()
    : null;
};

const bookingRecipients = async (booking: unknown) => {
  const record = await bookingRecord(booking);
  if (!record) return { record: null, ownerUserId: null, renterUserId: null };
  const [ownerUserId, renterUserId] = await Promise.all([
    profileBaseUserId("owner", record.ownerId),
    profileBaseUserId("renter", record.renterId),
  ]);
  return { record, ownerUserId, renterUserId };
};

const actionFor = (
  resource: NotificationAction["resource"],
  value: unknown,
): NotificationAction | null => {
  const id = toDocumentId(value);
  return id ? { resource, id } : null;
};

const notificationEventHandlers = {
  async bookingCreated(booking: unknown) {
    const { record, ownerUserId } = await bookingRecipients(booking);
    const id = toDocumentId(record?._id ?? booking);
    if (!id) return null;
    return emitTo(ownerUserId, {
      type: "booking.created",
      severity: "info",
      title: "New booking request",
      message: "A renter submitted a booking request for one of your bikes.",
      action: actionFor("booking", id),
      dedupeKey: `booking:${id}:created`,
    });
  },

  async bookingApproved(booking: unknown) {
    const { record, renterUserId } = await bookingRecipients(booking);
    const id = toDocumentId(record?._id ?? booking);
    if (!id) return null;
    return emitTo(renterUserId, {
      type: "booking.approved",
      severity: "success",
      title: "Booking approved",
      message:
        "The owner approved your booking request. Review the handover details before pickup.",
      action: actionFor("booking", id),
      dedupeKey: `booking:${id}:approved`,
    });
  },

  async bookingRejected(booking: unknown) {
    const { record, renterUserId } = await bookingRecipients(booking);
    const id = toDocumentId(record?._id ?? booking);
    if (!id) return null;
    return emitTo(renterUserId, {
      type: "booking.rejected",
      severity: "warning",
      title: "Booking not approved",
      message:
        "Your booking request was not approved. Open it to review the current status.",
      action: actionFor("booking", id),
      dedupeKey: `booking:${id}:rejected`,
    });
  },

  async bookingCancelled(booking: unknown, actorUserId?: string) {
    const { record, ownerUserId, renterUserId } =
      await bookingRecipients(booking);
    const id = toDocumentId(record?._id ?? booking);
    if (!id) return null;
    const recipients = [ownerUserId, renterUserId].filter(
      (recipient) => recipient !== actorUserId,
    );
    return emitToMany(recipients, {
      type: "booking.cancelled",
      severity: "warning",
      title: "Booking cancelled",
      message:
        "A booking was cancelled. Open the booking to review its final state.",
      action: actionFor("booking", id),
      dedupeKey: `booking:${id}:cancelled`,
    });
  },

  async bookingCompleted(booking: unknown) {
    const { record, renterUserId } = await bookingRecipients(booking);
    const id = toDocumentId(record?._id ?? booking);
    if (!id) return null;
    return emitTo(renterUserId, {
      type: "booking.completed",
      severity: "success",
      title: "Ride completed",
      message:
        "Your ride is marked complete. You can now review the bike from the booking details.",
      action: actionFor("booking", id),
      dedupeKey: `booking:${id}:completed`,
    });
  },

  async cashReceived(booking: unknown) {
    const { record, renterUserId } = await bookingRecipients(booking);
    const id = toDocumentId(record?._id ?? booking);
    if (!id) return null;
    return emitTo(renterUserId, {
      type: "booking.cash_received",
      severity: "success",
      title: "Cash receipt recorded",
      message:
        "The owner recorded the cash payment. Your test receipt is now available.",
      action: actionFor("booking", id),
      dedupeKey: `booking:${id}:cash-received`,
    });
  },

  async bookingRescheduled(booking: unknown) {
    const { record, ownerUserId } = await bookingRecipients(booking);
    const id = toDocumentId(record?._id ?? booking);
    if (!id) return null;
    const start = record?.startDate
      ? new Date(record.startDate).toISOString()
      : "updated";
    return emitTo(ownerUserId, {
      type: "booking.rescheduled",
      severity: "info",
      title: "Booking dates updated",
      message: "A renter changed the dates for an upcoming booking.",
      action: actionFor("booking", id),
      dedupeKey: `booking:${id}:rescheduled:${start}`,
    });
  },

  async paymentState(payment: any, booking: unknown) {
    const { record, ownerUserId, renterUserId } =
      await bookingRecipients(booking);
    const paymentId = toDocumentId(payment?._id);
    const bookingId = toDocumentId(record?._id ?? booking);
    if (!paymentId || !bookingId) return null;
    const action = actionFor("booking", bookingId);

    if (payment.reconciliationRequired) {
      return emitToMany(await adminUserIds(), {
        type: "payment.reconciliation_required",
        severity: "error",
        title: "Payment needs review",
        message:
          "A test payment could not be safely matched to its booking state.",
        action,
        dedupeKey: `payment:${paymentId}:reconciliation`,
      });
    }
    if (payment.status === "succeeded") {
      return emitToMany([renterUserId, ownerUserId], {
        type: "payment.succeeded",
        severity: "success",
        title: "Test payment verified",
        message:
          "The wallet test payment was verified. Owner approval is still required.",
        action,
        dedupeKey: `payment:${paymentId}:succeeded`,
      });
    }
    if (payment.status === "failed") {
      return emitTo(renterUserId, {
        type: "payment.failed",
        severity: "warning",
        title: "Payment was not completed",
        message:
          "The test payment was not completed. Open the booking to review safe retry options.",
        action,
        dedupeKey: `payment:${paymentId}:failed`,
      });
    }
    if (payment.status === "refunded") {
      return emitTo(renterUserId, {
        type: "payment.refunded",
        severity: "info",
        title: "Test refund status updated",
        message: "The provider reported a refund state for this test payment.",
        action,
        dedupeKey: `payment:${paymentId}:refunded`,
      });
    }
    return null;
  },

  async ownerDecision(owner: unknown, status: "verified" | "rejected") {
    const ownerId = toDocumentId(owner);
    const userId = await profileBaseUserId("owner", owner);
    if (!ownerId) return null;
    return emitTo(userId, {
      type: status === "verified" ? "owner.approved" : "owner.rejected",
      severity: status === "verified" ? "success" : "warning",
      title:
        status === "verified"
          ? "Owner profile approved"
          : "Owner profile needs attention",
      message:
        status === "verified"
          ? "Your owner profile is approved and can publish eligible bike listings."
          : "Your owner profile was not approved. Review your profile before contacting support.",
      action: actionFor("profile", ownerId),
      dedupeKey: `owner:${ownerId}:${status}`,
    });
  },

  async kycDecision(renter: unknown, status: "approved" | "rejected") {
    const renterId = toDocumentId(renter);
    const userId = await profileBaseUserId("renter", renter);
    if (!renterId) return null;
    return emitTo(userId, {
      type: status === "approved" ? "kyc.approved" : "kyc.rejected",
      severity: status === "approved" ? "success" : "warning",
      title:
        status === "approved"
          ? "ID verification approved"
          : "ID verification needs attention",
      message:
        status === "approved"
          ? "Your demo ID verification is approved and booking access is enabled."
          : "Your demo ID verification was not approved. Review the verification page before resubmitting.",
      action: actionFor("profile", renterId),
      dedupeKey: `kyc:${renterId}:${status}`,
    });
  },

  async bikeStatus(bike: unknown, status: string) {
    const bikeId = toDocumentId(bike);
    const record =
      bikeId && mongoose.connection.readyState === 1
        ? await BikeModel.findById(bikeId).select("ownerId").lean()
        : null;
    const ownerUserId = record
      ? await profileBaseUserId("owner", record.ownerId)
      : null;
    if (!bikeId) return null;
    const accepted = status === "available";
    return emitTo(ownerUserId, {
      type: accepted ? "bike.approved" : "bike.rejected",
      severity: accepted ? "success" : "warning",
      title: accepted
        ? "Bike listing available"
        : "Bike listing status changed",
      message: accepted
        ? "An administrator made your bike listing available."
        : "An administrator changed a bike listing status. Open it to review the current state.",
      action: actionFor("bike", bikeId),
      dedupeKey: `bike:${bikeId}:admin-status:${status}`,
    });
  },

  async reviewCreated(review: any, bike: unknown) {
    const reviewId = toDocumentId(review?._id);
    const bikeId = toDocumentId(bike);
    const record =
      bikeId && mongoose.connection.readyState === 1
        ? await BikeModel.findById(bikeId).select("ownerId").lean()
        : null;
    const ownerUserId = record
      ? await profileBaseUserId("owner", record.ownerId)
      : null;
    if (!reviewId || !bikeId) return null;
    return emitTo(ownerUserId, {
      type: "review.created",
      severity: "info",
      title: "New verified-ride review",
      message: "A renter added a review after a completed booking.",
      action: actionFor("bike", bikeId),
      dedupeKey: `review:${reviewId}:created`,
    });
  },

  async supportCreated(ticket: any) {
    const id = toDocumentId(ticket?._id);
    if (!id) return null;
    return emitToMany(await adminUserIds(), {
      type: "support.created",
      severity: ticket.priority === "high" ? "error" : "info",
      title:
        ticket.priority === "high"
          ? "High-priority support ticket"
          : "New support ticket",
      message: "A user submitted a support ticket for administrator review.",
      action: actionFor("support_ticket", id),
      dedupeKey: `support:${id}:created`,
    });
  },

  async supportUpdated(ticket: any) {
    const id = toDocumentId(ticket?._id);
    const userId = toDocumentId(ticket?.userId);
    if (!id) return null;
    return emitTo(userId, {
      type: "support.updated",
      severity: ticket.status === "resolved" ? "success" : "info",
      title: "Support ticket updated",
      message: "An administrator updated your support ticket status.",
      action: actionFor("support_ticket", id),
      dedupeKey: `support:${id}:status:${String(ticket.status)}`,
    });
  },

  async damageCreated(report: any, booking: unknown) {
    const id = toDocumentId(report?._id);
    const { ownerUserId } = await bookingRecipients(booking);
    if (!id) return null;
    return emitToMany([ownerUserId, ...(await adminUserIds())], {
      type: "damage_report.created",
      severity: "warning",
      title: "New damage report",
      message:
        "A ride has a new damage report for owner and administrator review.",
      action: actionFor("damage_report", id),
      dedupeKey: `damage:${id}:created`,
    });
  },

  async damageUpdated(report: any) {
    const id = toDocumentId(report?._id);
    const reporterId = toDocumentId(report?.reportedBy);
    if (!id) return null;
    return emitTo(reporterId, {
      type: "damage_report.updated",
      severity: report.status === "resolved" ? "success" : "info",
      title: "Damage report updated",
      message: "The status of your damage report changed.",
      action: actionFor("damage_report", id),
      dedupeKey: `damage:${id}:status:${String(report.status)}`,
    });
  },

  async sosCreated(alert: any) {
    const id = toDocumentId(alert?._id);
    if (!id) return null;
    return emitToMany(await adminUserIds(), {
      type: "sos.created",
      severity: "error",
      title: "New in-app SOS record",
      message:
        "A renter created an SOS record. Review it without assuming emergency dispatch.",
      action: actionFor("sos_alert", id),
      dedupeKey: `sos:${id}:created`,
    });
  },

  async sosUpdated(alert: any) {
    const id = toDocumentId(alert?._id);
    const userId = toDocumentId(alert?.userId);
    if (!id) return null;
    return emitTo(userId, {
      type: "sos.updated",
      severity: alert.status === "closed" ? "success" : "info",
      title: "SOS record updated",
      message: "An administrator updated your in-app SOS record status.",
      action: actionFor("sos_alert", id),
      dedupeKey: `sos:${id}:status:${String(alert.status)}`,
    });
  },
};

const notificationEvents = new Proxy(notificationEventHandlers, {
  get(target, property, receiver) {
    const handler = Reflect.get(target, property, receiver);
    if (typeof handler !== "function") return handler;
    return async (...args: unknown[]) => {
      try {
        return await handler.apply(target, args);
      } catch (error) {
        // Recipient lookup is also best-effort: a notification outage must
        // never roll back the booking, payment, support, or safety action.
        console.error("Notification event preparation failed", {
          event: String(property),
          error: error instanceof Error ? error.name : "UnknownError",
        });
        return null;
      }
    };
  },
});

export default notificationEvents;
