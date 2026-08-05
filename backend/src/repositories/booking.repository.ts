import mongoose from "mongoose";
import crypto from "node:crypto";
import BookingModel from "../models/booking.model.ts";
import BookingLockModel from "../models/booking-lock.model.ts";
import AppError from "../errors/AppError.ts";

export type BikeManagementBookingMetrics = {
  activeBookings: number;
  completedBookings: number;
  paidRevenue: number;
};

const isDuplicateKey = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === 11000;

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

const withBikeLease = async <T>(bikeId: string, task: () => Promise<T>) => {
  const token = crypto.randomUUID();
  const attempts = 8;
  let acquired = false;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const now = new Date();
    // The protected section is only expire -> overlap check -> insert, but a
    // 30-second lease leaves ample margin for a temporarily slow Mongo call.
    const expiresAt = new Date(now.getTime() + 30_000);
    const reclaimed = await BookingLockModel.findOneAndUpdate(
      { _id: bikeId, expiresAt: { $lte: now } },
      { $set: { token, expiresAt } },
      { new: true },
    );
    if (reclaimed) {
      acquired = true;
      break;
    }

    try {
      await BookingLockModel.create({ _id: bikeId, token, expiresAt });
      acquired = true;
      break;
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
    }
    if (attempt < attempts - 1) await wait(20 * (attempt + 1));
  }

  if (!acquired) {
    throw new AppError(
      409,
      "Another booking request is being checked for this bike. Please retry.",
      "BOOKING_BUSY",
    );
  }

  try {
    return await task();
  } finally {
    // Cleanup failure must not replace the result of the protected operation;
    // the TTL index remains a bounded fallback for an orphaned lease.
    await BookingLockModel.deleteOne({ _id: bikeId, token }).catch(
      () => undefined,
    );
  }
};

const activeBookingFilter = (now: Date): Record<string, unknown> => ({
  $or: [
    { status: "confirmed" },
    {
      status: "pending",
      $or: [
        { paymentStatus: "paid" },
        { holdExpiresAt: { $gt: now } },
      ],
    },
  ],
});

export const bookingRepository = {
  withBikeLease,
  create: (payload: Record<string, unknown>) => BookingModel.create(payload),
  findById: (bookingId: string) =>
    BookingModel.findById(bookingId)
      .populate("bikeId", "title brand model images status location")
      .populate("renterId", "fullName phoneNumber profilePictureUrl")
      .populate(
        "ownerId",
        "fullName phoneNumber profilePictureUrl ownerStatus",
      ),
  updateById: (bookingId: string, payload: Record<string, unknown>) =>
    BookingModel.findByIdAndUpdate(bookingId, payload, {
      new: true,
      runValidators: true,
    }),
  expireUnpaidHolds: (now: Date, bikeId?: string) =>
    BookingModel.updateMany(
      {
        ...(bikeId ? { bikeId } : {}),
        status: "pending",
        paymentStatus: { $ne: "paid" },
        $or: [
          { holdExpiresAt: { $lte: now } },
          { holdExpiresAt: null },
          { holdExpiresAt: { $exists: false } },
        ],
      },
      { $set: { status: "expired", holdExpiredAt: now } },
      { runValidators: true },
    ),
  expireUnpaidHoldById: (bookingId: string, now: Date) =>
    BookingModel.findOneAndUpdate(
      {
        _id: bookingId,
        status: "pending",
        paymentStatus: { $ne: "paid" },
        $or: [
          { holdExpiresAt: { $lte: now } },
          { holdExpiresAt: null },
          { holdExpiresAt: { $exists: false } },
        ],
      },
      { $set: { status: "expired", holdExpiredAt: now } },
      { new: true, runValidators: true },
    ),
  claimPendingForWallet: (
    bookingId: string,
    now: Date,
    paymentMode: "demo" | "sandbox" | "live",
  ) =>
    BookingModel.findOneAndUpdate(
      {
        _id: bookingId,
        status: "pending",
        startDate: { $gt: now },
        holdExpiresAt: { $gt: now },
        paymentStatus: { $in: ["unpaid", "failed", "pending"] },
        paymentMethod: { $in: [null, "wallet"] },
      },
      {
        $set: {
          paymentStatus: "pending",
          paymentMode,
          paymentMethod: "wallet",
        },
      },
      { new: true, runValidators: true },
    ),
  selectCashForPendingHold: (
    bookingId: string,
    now: Date,
    cashReference: string,
  ) =>
    BookingModel.findOneAndUpdate(
      {
        _id: bookingId,
        status: "pending",
        startDate: { $gt: now },
        holdExpiresAt: { $gt: now },
        paymentStatus: { $in: ["unpaid", "failed"] },
        paymentMethod: { $in: [null, "wallet"] },
      },
      {
        $set: {
          paymentStatus: "pending",
          paymentMethod: "cash",
          paymentMode: null,
          cashReference,
        },
      },
      { new: true, runValidators: true },
    ),
  confirmEligibleBooking: (bookingId: string, now: Date) =>
    BookingModel.findOneAndUpdate(
      {
        _id: bookingId,
        status: "pending",
        startDate: { $gt: now },
        $or: [
          { paymentMethod: "wallet", paymentStatus: "paid" },
          {
            paymentMethod: "cash",
            paymentStatus: "pending",
            holdExpiresAt: { $gt: now },
          },
        ],
      },
      { $set: { status: "confirmed", holdExpiresAt: null } },
      { new: true, runValidators: true },
    ),
  markPendingWalletPaid: (
    bookingId: string,
    paymentMode: "demo" | "sandbox" | "live",
    now = new Date(),
  ) =>
    BookingModel.findOneAndUpdate(
      {
        _id: bookingId,
        status: "pending",
        startDate: { $gt: now },
        holdExpiresAt: { $gt: now },
        paymentStatus: { $in: ["unpaid", "pending", "failed"] },
        paymentMethod: { $in: [null, "wallet"] },
      },
      {
        $set: {
          paymentStatus: "paid",
          paymentMode,
          paymentMethod: "wallet",
          holdExpiresAt: null,
        },
      },
      { new: true, runValidators: true },
    ),
  markPendingWalletFailed: (
    bookingId: string,
    paymentMode: "demo" | "sandbox" | "live",
    now = new Date(),
  ) =>
    BookingModel.findOneAndUpdate(
      {
        _id: bookingId,
        status: "pending",
        holdExpiresAt: { $gt: now },
        paymentStatus: { $in: ["unpaid", "pending", "failed"] },
        paymentMethod: { $in: [null, "wallet"] },
      },
      {
        $set: {
          paymentStatus: "failed",
          paymentMode,
          paymentMethod: "wallet",
        },
      },
      { new: true, runValidators: true },
    ),
  markConfirmedCashPaid: (
    bookingId: string,
    cashReference: string,
    receivedAt: Date,
  ) =>
    BookingModel.findOneAndUpdate(
      {
        _id: bookingId,
        status: "confirmed",
        paymentMethod: "cash",
        paymentStatus: "pending",
        cashReference,
      },
      {
        $set: {
          paymentStatus: "paid",
          paymentMode: "live",
          cashReceivedAt: receivedAt,
        },
      },
      { new: true, runValidators: true },
    ),
  rescheduleEligibleBooking: (
    bookingId: string,
    expectedStartDate: Date,
    expectedEndDate: Date,
    newStartDate: Date,
    newEndDate: Date,
    now: Date,
    expectedState: Record<string, unknown>,
    holdExpiresAt?: Date | null,
  ) =>
    BookingModel.findOneAndUpdate(
      {
        _id: bookingId,
        startDate: expectedStartDate,
        endDate: expectedEndDate,
        ...expectedState,
        $or: [
          { status: "confirmed" },
          {
            status: "pending",
            $or: [
              { paymentStatus: "paid" },
              { holdExpiresAt: { $gt: now } },
            ],
          },
        ],
      },
      {
        $set: {
          startDate: newStartDate,
          endDate: newEndDate,
          ...(holdExpiresAt !== undefined ? { holdExpiresAt } : {}),
        },
      },
      { new: true, runValidators: true },
    ),
  extendEligibleBooking: (
    bookingId: string,
    expectedEndDate: Date,
    payload: Record<string, unknown>,
  ) =>
    BookingModel.findOneAndUpdate(
      {
        _id: bookingId,
        status: "confirmed",
        paymentStatus: "paid",
        paymentMode: "demo",
        endDate: expectedEndDate,
      },
      { $set: payload },
      { new: true, runValidators: true },
    ),
  startEligibleRide: (
    bookingId: string,
    startedAt: Date,
    preRideChecklist: Record<string, unknown>,
  ) =>
    BookingModel.findOneAndUpdate(
      {
        _id: bookingId,
        status: "confirmed",
        paymentStatus: "paid",
        rideStartedAt: null,
        "preRideChecklist.completedAt": null,
      },
      {
        $set: {
          preRideChecklist,
          rideStartedAt: startedAt,
        },
      },
      { new: true, runValidators: true },
    ),
  completeStartedRide: (
    bookingId: string,
    payload: Record<string, unknown>,
  ) =>
    BookingModel.findOneAndUpdate(
      {
        _id: bookingId,
        status: "confirmed",
        paymentStatus: "paid",
        returnedAt: null,
        $or: [
          { rideStartedAt: { $ne: null } },
          { "preRideChecklist.completedAt": { $ne: null } },
        ],
      },
      { $set: payload },
      { new: true, runValidators: true },
    ),
  markWalletRefunded: (
    bookingId: string,
    paymentMode: "demo" | "sandbox" | "live",
  ) =>
    BookingModel.findOneAndUpdate(
      {
        _id: bookingId,
        paymentStatus: "paid",
        paymentMethod: "wallet",
        paymentMode,
      },
      { $set: { paymentStatus: "refunded" } },
      { new: true, runValidators: true },
    ),
  deleteById: (bookingId: string) => BookingModel.findByIdAndDelete(bookingId),
  count: (filter: Record<string, unknown>) =>
    BookingModel.countDocuments(filter),
  list: (
    filter: Record<string, unknown>,
    sort: Record<string, 1 | -1>,
    skip: number,
    limit: number,
  ) => {
    return BookingModel.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate("bikeId", "title brand model images status location")
      .populate("renterId", "fullName phoneNumber profilePictureUrl")
      .populate(
        "ownerId",
        "fullName phoneNumber profilePictureUrl ownerStatus",
      );
  },
  listForBikeManagement: (
    filter: Record<string, unknown>,
    sort: Record<string, 1 | -1>,
    skip: number,
    limit: number,
  ) =>
    BookingModel.find(filter)
      .select(
        "_id bikeId startDate endDate status paymentStatus paymentMode paymentMethod holdExpiresAt holdExpiredAt totalAmount currency rideStartedAt returnedAt lateMinutes lateFeeAmount createdAt updatedAt",
      )
      .sort(sort)
      .skip(skip)
      .limit(limit),
  findOverlap: (
    bikeId: string,
    startDate: Date,
    endDate: Date,
    now = new Date(),
    excludeBookingId?: string,
  ) => {
    return BookingModel.findOne({
      bikeId,
      ...(excludeBookingId ? { _id: { $ne: excludeBookingId } } : {}),
      $and: [
        activeBookingFilter(now),
        {
          $or: [
            { startDate: { $lte: endDate }, endDate: { $gte: startDate } },
          ],
        },
      ],
    });
  },
  findOverlappingBikeIds: (
    startDate: Date,
    endDate: Date,
    now = new Date(),
  ) => {
    return BookingModel.distinct("bikeId", {
      $and: [
        activeBookingFilter(now),
        {
          $or: [
            { startDate: { $lte: endDate }, endDate: { $gte: startDate } },
          ],
        },
      ],
    });
  },
  findByBikeAndUser: (bikeId: string, renterId: string) =>
    BookingModel.find({ bikeId, renterId }).sort({ createdAt: -1 }),
  countActiveByBikeId: (bikeId: string, now = new Date()) =>
    BookingModel.countDocuments({
      bikeId,
      ...activeBookingFilter(now),
    }),
  findByBikeId: (bikeId: string) =>
    BookingModel.find({ bikeId }).sort({ createdAt: -1 }),
  findIdsByOwnerId: (ownerId: string, bikeId?: string) =>
    BookingModel.distinct("_id", {
      ownerId,
      ...(bikeId ? { bikeId } : {}),
    }),
  getBikeManagementMetrics: async (
    bikeId: string,
  ): Promise<BikeManagementBookingMetrics> => {
    const [metrics] = await BookingModel.aggregate<BikeManagementBookingMetrics>([
      {
        $match: {
          bikeId: new mongoose.Types.ObjectId(bikeId),
        },
      },
      {
        $group: {
          _id: null,
          activeBookings: {
            $sum: {
              $cond: [
                { $in: ["$status", ["pending", "confirmed"]] },
                1,
                0,
              ],
            },
          },
          completedBookings: {
            $sum: {
              $cond: [{ $eq: ["$status", "completed"] }, 1, 0],
            },
          },
          paidRevenue: {
            $sum: {
              $cond: [
                { $eq: ["$paymentStatus", "paid"] },
                "$totalAmount",
                0,
              ],
            },
          },
        },
      },
      { $project: { _id: 0 } },
    ]);

    return (
      metrics ?? {
        activeBookings: 0,
        completedBookings: 0,
        paidRevenue: 0,
      }
    );
  },
};
