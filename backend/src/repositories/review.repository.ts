import mongoose from "mongoose";
import ReviewModel from "../models/review.model.ts";

export const reviewRepository = {
    create: (payload: Record<string, unknown>) => ReviewModel.create(payload),
    findById: (reviewId: string) => ReviewModel.findById(reviewId).populate("bikeId").populate("bookingId").populate("userId"),
    findByBookingId: (bookingId: string) => ReviewModel.findOne({ bookingId }),
    updateById: (reviewId: string, payload: Record<string, unknown>) => ReviewModel.findByIdAndUpdate(reviewId, payload, { new: true }),
    deleteById: (reviewId: string) => ReviewModel.findByIdAndDelete(reviewId),
    list: (filter: Record<string, unknown>, sort: Record<string, 1 | -1>, skip: number, limit: number) => ReviewModel.find(filter).sort(sort).skip(skip).limit(limit).populate("bikeId").populate("userId"),
    count: (filter: Record<string, unknown>) => ReviewModel.countDocuments(filter),
    listByBikeId: (bikeId: string, skip: number, limit: number) => ReviewModel.find({ bikeId, isHidden: false }).sort({ createdAt: -1 }).skip(skip).limit(limit).populate("userId"),
    listByUserId: (userId: string, skip: number, limit: number) => ReviewModel.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).populate("bikeId"),
    countByBikeId: (bikeId: string) => ReviewModel.countDocuments({ bikeId, isHidden: false }),
    aggregateStatsByBikeId: async (bikeId: string) => {
        const result = await ReviewModel.aggregate([
            { $match: { bikeId: new mongoose.Types.ObjectId(bikeId), isHidden: false } },
            { $group: { _id: "$bikeId", averageRating: { $avg: "$rating" }, ratingCount: { $sum: 1 } } },
        ]);
        return result[0] ?? { averageRating: 0, ratingCount: 0 };
    },
};
