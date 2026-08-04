import mongoose, { Schema } from "mongoose";
import { NOTIFICATION_RETENTION_DAYS } from "../config/index.ts";
import {
  notificationResources,
  notificationSeverities,
  notificationTypes,
  type NotificationResource,
  type NotificationSeverity,
  type NotificationType,
} from "../types/notification.type.ts";

export interface INotification {
  recipientId: Schema.Types.ObjectId | string;
  sequence: number;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  action: {
    resource: NotificationResource;
    id: Schema.Types.ObjectId | string;
  } | null;
  dedupeKey: string;
  readAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const notificationActionSchema = new Schema(
  {
    resource: {
      type: String,
      enum: notificationResources,
      required: true,
    },
    id: { type: Schema.Types.ObjectId, required: true },
  },
  { _id: false },
);

const notificationSchema = new Schema<INotification>(
  {
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: true,
      immutable: true,
    },
    sequence: {
      type: Number,
      required: true,
      min: 1,
      immutable: true,
    },
    type: {
      type: String,
      enum: notificationTypes,
      required: true,
      immutable: true,
    },
    severity: {
      type: String,
      enum: notificationSeverities,
      required: true,
      immutable: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
      immutable: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 240,
      immutable: true,
    },
    action: {
      type: notificationActionSchema,
      default: null,
      immutable: true,
    },
    dedupeKey: {
      type: String,
      required: true,
      minlength: 3,
      maxlength: 200,
      match: /^[a-z0-9][a-z0-9:._-]*$/i,
      immutable: true,
    },
    readAt: { type: Date, default: null },
    expiresAt: {
      type: Date,
      required: true,
      default: () =>
        new Date(Date.now() + NOTIFICATION_RETENTION_DAYS * 86_400_000),
    },
  },
  { timestamps: true },
);

notificationSchema.index(
  { recipientId: 1, sequence: 1 },
  { unique: true, name: "notification_recipient_sequence" },
);
notificationSchema.index(
  { recipientId: 1, dedupeKey: 1 },
  { unique: true, name: "notification_recipient_dedupe" },
);
notificationSchema.index({ recipientId: 1, sequence: -1 });
notificationSchema.index({ recipientId: 1, readAt: 1, sequence: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const NotificationModel =
  (mongoose.models.notifications as mongoose.Model<INotification>) ??
  mongoose.model<INotification>("notifications", notificationSchema);

export default NotificationModel;
