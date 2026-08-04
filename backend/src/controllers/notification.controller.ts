import type { RequestHandler, Response } from "express";
import {
  NOTIFICATION_AUTH_RECHECK_MS,
  NOTIFICATION_HEARTBEAT_MS,
} from "../config/index.ts";
import ApiResponse from "../utils/ApiResponse.ts";
import AppError from "../errors/AppError.ts";
import notificationService from "../services/notification.service.ts";
import { notificationHub } from "../services/notification-hub.service.ts";
import type { NotificationDto } from "../types/notification.type.ts";

const writeSse = (
  res: Response,
  event: "notification" | "ready" | "resync",
  data: unknown,
  id?: number,
) => {
  if (res.writableEnded || res.destroyed) return;
  if (id !== undefined) res.write(`id: ${id}\n`);
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
};

const parseReplaySequence = (
  headerValue: string | undefined,
  fallback: unknown,
) => {
  const raw = headerValue?.trim() || fallback;
  if (raw === undefined) return 0;
  if (
    (typeof raw !== "string" && typeof raw !== "number") ||
    String(raw).trim() === ""
  ) {
    throw new AppError(
      400,
      "Invalid notification replay cursor",
      "BAD_REQUEST",
    );
  }
  const sequence = Number(raw);
  if (!Number.isSafeInteger(sequence) || sequence < 0) {
    throw new AppError(
      400,
      "Invalid notification replay cursor",
      "BAD_REQUEST",
    );
  }
  return sequence;
};

export const listNotifications: RequestHandler = async (req, res, next) => {
  try {
    const query = req.query as unknown as {
      before?: number;
      limit: number;
      unreadOnly: boolean;
    };
    const result = await notificationService.list(req.auth!.userId, query);
    res.status(200).json(new ApiResponse(200, "Notifications fetched", result));
  } catch (error) {
    next(error);
  }
};

export const getUnreadNotificationCount: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const result = await notificationService.unreadCount(req.auth!.userId);
    res
      .status(200)
      .json(new ApiResponse(200, "Unread notification count fetched", result));
  } catch (error) {
    next(error);
  }
};

export const markNotificationRead: RequestHandler = async (req, res, next) => {
  try {
    const result = await notificationService.markRead(
      req.auth!.userId,
      String(req.params.notificationId),
    );
    res
      .status(200)
      .json(new ApiResponse(200, "Notification marked as read", result));
  } catch (error) {
    next(error);
  }
};

export const markAllNotificationsRead: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const result = await notificationService.markAllRead(req.auth!.userId);
    res
      .status(200)
      .json(new ApiResponse(200, "All notifications marked as read", result));
  } catch (error) {
    next(error);
  }
};

export const streamNotifications: RequestHandler = async (req, res, next) => {
  const recipientId = req.auth!.userId;
  let unsubscribe: () => void = () => undefined;
  let heartbeat: NodeJS.Timeout | undefined;
  let authRecheck: NodeJS.Timeout | undefined;
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    if (heartbeat) clearInterval(heartbeat);
    if (authRecheck) clearTimeout(authRecheck);
    unsubscribe();
  };
  const close = () => {
    cleanup();
    if (!res.writableEnded) res.end();
  };

  try {
    const after = parseReplaySequence(
      req.get("Last-Event-ID"),
      req.query.after,
    );
    let buffering = true;
    let bufferOverflow = false;
    const queued: NotificationDto[] = [];
    unsubscribe = notificationHub.subscribe(recipientId, {
      send: (notification) => {
        if (!buffering) {
          writeSse(res, "notification", notification, notification.sequence);
          return;
        }
        if (queued.length < 101) queued.push(notification);
        else bufferOverflow = true;
      },
      close,
    });
    res.once("close", cleanup);

    const replay = await notificationService.replay(recipientId, after);
    let emittedThrough = replay.latestSequence;
    const unread = await notificationService.unreadCount(recipientId);

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    res.write("retry: 5000\n\n");

    if (replay.resync || bufferOverflow) {
      if (bufferOverflow) {
        emittedThrough = await notificationService.latestSequence(recipientId);
      }
      writeSse(
        res,
        "resync",
        {
          reason: "replay_limit_exceeded",
          latestSequence: emittedThrough,
        },
        emittedThrough,
      );
    } else {
      for (const notification of replay.items) {
        writeSse(res, "notification", notification, notification.sequence);
      }
    }

    writeSse(res, "ready", {
      latestSequence: emittedThrough,
      unreadCount: unread.unreadCount,
    });
    buffering = false;
    for (const notification of queued.sort(
      (left, right) => left.sequence - right.sequence,
    )) {
      if (notification.sequence <= emittedThrough) continue;
      writeSse(res, "notification", notification, notification.sequence);
      emittedThrough = notification.sequence;
    }

    heartbeat = setInterval(() => {
      if (res.writableEnded || res.destroyed) {
        close();
        return;
      }
      res.write(": heartbeat\n\n");
    }, NOTIFICATION_HEARTBEAT_MS);
    heartbeat.unref();

    // A stream is deliberately short-lived. Reconnecting forces the normal
    // authentication middleware to re-check the token and account.
    authRecheck = setTimeout(() => {
      if (!res.writableEnded) res.write(": auth-recheck\n\n");
      close();
    }, NOTIFICATION_AUTH_RECHECK_MS);
    authRecheck.unref();
  } catch (error) {
    cleanup();
    if (res.headersSent) {
      if (!res.writableEnded) res.end();
      return;
    }
    next(error);
  }
};
