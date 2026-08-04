import AppError from "../errors/AppError.ts";
import {
  NOTIFICATION_MAX_CONNECTIONS_PER_USER,
  NOTIFICATION_MAX_CONNECTIONS_TOTAL,
} from "../config/index.ts";
import type { NotificationDto } from "../types/notification.type.ts";

export type NotificationSubscriber = {
  send: (notification: NotificationDto) => void;
  close: () => void;
};

class NotificationHub {
  private readonly recipients = new Map<string, Set<NotificationSubscriber>>();

  private connectionCount = 0;

  subscribe(recipientId: string, subscriber: NotificationSubscriber) {
    const recipientConnections = this.recipients.get(recipientId);
    if (
      (recipientConnections?.size ?? 0) >= NOTIFICATION_MAX_CONNECTIONS_PER_USER
    ) {
      throw new AppError(
        429,
        "Too many notification streams are open for this account",
        "NOTIFICATION_STREAM_LIMIT",
      );
    }
    if (this.connectionCount >= NOTIFICATION_MAX_CONNECTIONS_TOTAL) {
      throw new AppError(
        503,
        "Notification streaming is at capacity. Retry shortly.",
        "NOTIFICATION_STREAM_CAPACITY",
      );
    }

    const connections = recipientConnections ?? new Set();
    connections.add(subscriber);
    this.recipients.set(recipientId, connections);
    this.connectionCount += 1;
    let active = true;

    return () => {
      if (!active) return;
      active = false;
      if (connections.delete(subscriber)) this.connectionCount -= 1;
      if (connections.size === 0) this.recipients.delete(recipientId);
    };
  }

  publish(recipientId: string, notification: NotificationDto) {
    const connections = this.recipients.get(recipientId);
    if (!connections) return;
    for (const subscriber of [...connections]) {
      try {
        subscriber.send(notification);
      } catch {
        if (connections.delete(subscriber)) this.connectionCount -= 1;
        if (connections.size === 0) this.recipients.delete(recipientId);
        subscriber.close();
      }
    }
  }

  disconnectRecipient(recipientId: string) {
    const connections = this.recipients.get(recipientId);
    if (!connections) return;
    for (const subscriber of [...connections]) {
      if (connections.delete(subscriber)) this.connectionCount -= 1;
      subscriber.close();
    }
    this.recipients.delete(recipientId);
  }

  getConnectionCount(recipientId?: string) {
    return recipientId
      ? (this.recipients.get(recipientId)?.size ?? 0)
      : this.connectionCount;
  }
}

export const notificationHub = new NotificationHub();
