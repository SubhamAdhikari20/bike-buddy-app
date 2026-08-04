import mongoose, { Schema } from "mongoose";

export interface INotificationCounter {
  _id: Schema.Types.ObjectId | string;
  lastSequence: number;
  createdAt: Date;
  updatedAt: Date;
}

const notificationCounterSchema = new Schema<INotificationCounter>(
  {
    // The base-user ID is also the counter ID, so Mongo guarantees one counter
    // per recipient without waiting for an optional secondary index.
    _id: { type: Schema.Types.ObjectId, required: true },
    lastSequence: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true },
);

const NotificationCounterModel =
  (mongoose.models
    .notification_counters as mongoose.Model<INotificationCounter>) ??
  mongoose.model<INotificationCounter>(
    "notification_counters",
    notificationCounterSchema,
  );

export default NotificationCounterModel;
