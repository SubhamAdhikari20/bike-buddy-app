import mongoose from "mongoose";
import BookingModel from "../models/booking.model.ts";

export type BikeManagementBookingMetrics = {
  activeBookings: number;
  completedBookings: number;
  paidRevenue: number;
};

export const bookingRepository = {
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
        "_id bikeId startDate endDate status paymentStatus paymentMode paymentMethod totalAmount currency returnedAt lateMinutes lateFeeAmount createdAt updatedAt",
      )
      .sort(sort)
      .skip(skip)
      .limit(limit),
  findOverlap: (bikeId: string, startDate: Date, endDate: Date) => {
    return BookingModel.findOne({
      bikeId,
      status: { $in: ["pending", "confirmed"] },
      $or: [{ startDate: { $lte: endDate }, endDate: { $gte: startDate } }],
    });
  },
  findOverlappingBikeIds: (startDate: Date, endDate: Date) => {
    return BookingModel.distinct("bikeId", {
      status: { $in: ["pending", "confirmed"] },
      $or: [{ startDate: { $lte: endDate }, endDate: { $gte: startDate } }],
    });
  },
  findByBikeAndUser: (bikeId: string, renterId: string) =>
    BookingModel.find({ bikeId, renterId }).sort({ createdAt: -1 }),
  countActiveByBikeId: (bikeId: string) =>
    BookingModel.countDocuments({
      bikeId,
      status: { $in: ["pending", "confirmed"] },
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
