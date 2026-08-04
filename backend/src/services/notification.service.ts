import AppError from "../errors/AppError.ts";
import { NOTIFICATION_REPLAY_LIMIT } from "../config/index.ts";
import { notificationRepository } from "../repositories/notification.repository.ts";
import { notificationEmissionSchema } from "../schemas/notification.schema.ts";
import {
  type NotificationDto,
  type NotificationEmission,
} from "../types/notification.type.ts";
import { toDocumentId } from "../utils/mongo-reference.ts";
import { notificationHub } from "./notification-hub.service.ts";

const isDuplicateKeyError = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === 11000;

export const toNotificationDto = (notification: any): NotificationDto => ({
  _id: toDocumentId(notification._id) ?? String(notification._id),
  sequence: Number(notification.sequence),
  type: notification.type,
  severity: notification.severity,
  title: notification.title,
  message: notification.message,
  action: notification.action
    ? {
        resource: notification.action.resource,
        id:
          toDocumentId(notification.action.id) ??
          String(notification.action.id),
      }
    : null,
  readAt: notification.readAt ? new Date(notification.readAt) : null,
  createdAt: new Date(notification.createdAt),
});

const notificationService = {
  async emit(input: NotificationEmission) {
    const payload = notificationEmissionSchema.parse(input);
    const existing = await notificationRepository.findByDedupeKey(
      payload.recipientId,
      payload.dedupeKey,
    );
    if (existing) return toNotificationDto(existing);

    const counter = await notificationRepository.nextSequence(
      payload.recipientId,
    );
    if (!counter) {
      throw new AppError(
        503,
        "Notification sequence could not be allocated",
        "NOTIFICATION_SEQUENCE_UNAVAILABLE",
      );
    }

    try {
      const created = await notificationRepository.create({
        ...payload,
        sequence: counter.lastSequence,
      });
      const dto = toNotificationDto(created);
      notificationHub.publish(payload.recipientId, dto);
      return dto;
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      const raced = await notificationRepository.findByDedupeKey(
        payload.recipientId,
        payload.dedupeKey,
      );
      if (!raced) throw error;
      return toNotificationDto(raced);
    }
  },

  async emitBestEffort(input: NotificationEmission) {
    try {
      return await this.emit(input);
    } catch (error) {
      // Deliberately omit recipient IDs, dedupe keys, domain content, and
      // stack traces from routine notification-failure logs.
      console.error("Notification delivery failed", {
        type: input.type,
        error: error instanceof Error ? error.name : "UnknownError",
      });
      return null;
    }
  },

  async emitManyBestEffort(inputs: NotificationEmission[]) {
    return Promise.all(inputs.map((input) => this.emitBestEffort(input)));
  },

  async list(
    recipientId: string,
    query: { before?: number; limit: number; unreadOnly: boolean },
  ) {
    const rows = await notificationRepository.listByRecipient(recipientId, {
      ...query,
      limit: query.limit + 1,
    });
    const hasMore = rows.length > query.limit;
    const pageRows = hasMore ? rows.slice(0, query.limit) : rows;
    const items = pageRows.map(toNotificationDto);
    const unreadCount = await notificationRepository.unreadCount(recipientId);
    return {
      items,
      pageInfo: {
        nextCursor:
          hasMore && items.length > 0
            ? items[items.length - 1]!.sequence
            : null,
        hasMore,
      },
      unreadCount,
    };
  },

  async unreadCount(recipientId: string) {
    return {
      unreadCount: await notificationRepository.unreadCount(recipientId),
    };
  },

  async markRead(recipientId: string, notificationId: string) {
    let updated = await notificationRepository.markRead(
      recipientId,
      notificationId,
      new Date(),
    );
    if (!updated) {
      updated = await notificationRepository.findScoped(
        recipientId,
        notificationId,
      );
    }
    if (!updated) {
      // A scoped 404 does not disclose whether another user owns the ID.
      throw new AppError(404, "Notification not found", "NOT_FOUND");
    }
    return toNotificationDto(updated);
  },

  async markAllRead(recipientId: string) {
    const readAt = new Date();
    const result = await notificationRepository.markAllRead(
      recipientId,
      readAt,
    );
    return { updatedCount: result.modifiedCount, readAt };
  },

  async replay(recipientId: string, after: number) {
    const rows = await notificationRepository.replayAfter(
      recipientId,
      after,
      NOTIFICATION_REPLAY_LIMIT + 1,
    );
    if (rows.length > NOTIFICATION_REPLAY_LIMIT) {
      const latest = await notificationRepository.latest(recipientId);
      return {
        resync: true as const,
        latestSequence: latest?.sequence ?? after,
        items: [] as NotificationDto[],
      };
    }
    const items = rows.map(toNotificationDto);
    return {
      resync: false as const,
      latestSequence:
        items.length > 0 ? items[items.length - 1]!.sequence : after,
      items,
    };
  },

  async latestSequence(recipientId: string) {
    const latest = await notificationRepository.latest(recipientId);
    return latest?.sequence ?? 0;
  },

  async deleteInbox(recipientId: string) {
    notificationHub.disconnectRecipient(recipientId);
    return notificationRepository.deleteInbox(recipientId);
  },
};

export default notificationService;
