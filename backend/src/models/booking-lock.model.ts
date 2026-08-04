import mongoose, { Schema } from "mongoose";

export interface IBookingLock {
  _id: Schema.Types.ObjectId | string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const bookingLockSchema = new Schema<IBookingLock>(
  {
    // The bike ID is the document ID. MongoDB always enforces _id uniqueness,
    // even before optional application indexes have finished building.
    _id: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    token: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

// TTL is cleanup only. Acquisition also reclaims expired rows atomically,
// because MongoDB's TTL monitor is intentionally not immediate.
bookingLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const BookingLockModel =
  (mongoose.models.booking_locks as mongoose.Model<IBookingLock>) ??
  mongoose.model<IBookingLock>("booking_locks", bookingLockSchema);

export default BookingLockModel;
