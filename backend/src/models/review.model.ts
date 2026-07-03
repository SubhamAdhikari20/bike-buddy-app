import mongoose, { Schema, Document } from "mongoose";
import type { Review } from "./../types/review.type.ts";

export interface IReview extends Omit<Review, "bikeId" | "bookingId" | "userId"> {
    bikeId: Schema.Types.ObjectId | string;
    bookingId: Schema.Types.ObjectId | string;
    userId: Schema.Types.ObjectId | string;
    createdAt: Date;
    updatedAt: Date;
}

const reviewSchema: Schema<IReview> = new Schema({
    bikeId: { type: Schema.Types.ObjectId, ref: "bikes", required: true, index: true },
    bookingId: { type: Schema.Types.ObjectId, ref: "bookings", required: true, index: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: "users", required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true },
    isVerifiedRide: { type: Boolean, default: true },
    isHidden: { type: Boolean, default: false },
}, {
    timestamps: true,
});

reviewSchema.index({ bikeId: 1, createdAt: -1 });

const ReviewModel = (mongoose.models.reviews as mongoose.Model<IReview>) ?? mongoose.model<IReview>("reviews", reviewSchema);

export default ReviewModel;
