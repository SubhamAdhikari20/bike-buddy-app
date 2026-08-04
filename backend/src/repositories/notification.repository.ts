import NotificationCounterModel from "../models/notification-counter.model.ts";
import NotificationModel from "../models/notification.model.ts";

export const notificationRepository = {
  nextSequence: async (recipientId: string) => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await NotificationCounterModel.findOneAndUpdate(
          { _id: recipientId },
          { $inc: { lastSequence: 1 } },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        );
      } catch (error) {
        const duplicateCounterUpsert =
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === 11000;
        if (!duplicateCounterUpsert || attempt === 2) throw error;
      }
    }
    return null;
  },
  create: (payload: Record<string, unknown>) =>
    NotificationModel.create(payload),
  findByDedupeKey: (recipientId: string, dedupeKey: string) =>
    NotificationModel.findOne({ recipientId, dedupeKey }),
  listByRecipient: (
    recipientId: string,
    options: { before?: number; unreadOnly: boolean; limit: number },
  ) =>
    NotificationModel.find({
      recipientId,
      expiresAt: { $gt: new Date() },
      ...(options.before ? { sequence: { $lt: options.before } } : {}),
      ...(options.unreadOnly ? { readAt: null } : {}),
    })
      .sort({ sequence: -1 })
      .limit(options.limit),
  replayAfter: (recipientId: string, sequence: number, limit: number) =>
    NotificationModel.find({
      recipientId,
      expiresAt: { $gt: new Date() },
      sequence: { $gt: sequence },
    })
      .sort({ sequence: 1 })
      .limit(limit),
  latest: (recipientId: string) =>
    NotificationModel.findOne({
      recipientId,
      expiresAt: { $gt: new Date() },
    }).sort({ sequence: -1 }),
  unreadCount: (recipientId: string) =>
    NotificationModel.countDocuments({
      recipientId,
      readAt: null,
      expiresAt: { $gt: new Date() },
    }),
  markRead: (recipientId: string, notificationId: string, readAt: Date) =>
    NotificationModel.findOneAndUpdate(
      {
        _id: notificationId,
        recipientId,
        readAt: null,
        expiresAt: { $gt: new Date() },
      },
      { $set: { readAt } },
      { new: true, runValidators: true },
    ),
  findScoped: (recipientId: string, notificationId: string) =>
    NotificationModel.findOne({
      _id: notificationId,
      recipientId,
      expiresAt: { $gt: new Date() },
    }),
  markAllRead: (recipientId: string, readAt: Date) =>
    NotificationModel.updateMany(
      { recipientId, readAt: null, expiresAt: { $gt: new Date() } },
      { $set: { readAt } },
      { runValidators: true },
    ),
  deleteInbox: async (recipientId: string) => {
    const [notifications] = await Promise.all([
      NotificationModel.deleteMany({ recipientId }),
      NotificationCounterModel.deleteOne({ _id: recipientId }),
    ]);
    return notifications.deletedCount;
  },
};
