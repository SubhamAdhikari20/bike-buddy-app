import AppError from "../errors/AppError.ts";
import { bookingRepository } from "../repositories/booking.repository.ts";
import { bikeRepository } from "../repositories/bike.repository.ts";
import { reviewRepository } from "../repositories/review.repository.ts";
import type { AuthRole } from "../interfaces/auth.interface.ts";

const recomputeBikeRating = async (bikeId: string) => {
    const stats = await reviewRepository.aggregateStatsByBikeId(bikeId);
    await bikeRepository.recomputeRating(bikeId, stats.averageRating ?? 0, stats.ratingCount ?? 0);
};

const ensureReviewAccess = (auth: { userId: string; role: AuthRole; profileId?: string }, review: any) => {
    if (auth.role === "admin") {
        return;
    }

    if (review.userId?.toString() === auth.profileId) {
        return;
    }

    throw new AppError(403, "You do not have access to this review", "FORBIDDEN");
};

const reviewService = {
    async createReview(auth: { userId: string; role: AuthRole; profileId?: string }, payload: { bikeId: string; bookingId: string; rating: number; comment: string }) {
        if (auth.role !== "renter") {
            throw new AppError(403, "Only renters can create reviews", "FORBIDDEN");
        }

        const booking = await bookingRepository.findById(payload.bookingId);
        if (!booking) {
            throw new AppError(404, "Booking not found", "NOT_FOUND");
        }

        if (booking.renterId?.toString() !== auth.profileId) {
            throw new AppError(403, "You can only review your own booking", "FORBIDDEN");
        }

        if (booking.status !== "completed") {
            throw new AppError(400, "You can only review a completed booking", "BAD_REQUEST");
        }

        const existing = await reviewRepository.findByBookingId(payload.bookingId);
        if (existing) {
            throw new AppError(409, "A review already exists for this booking", "CONFLICT");
        }

        const review = await reviewRepository.create({
            bikeId: payload.bikeId,
            bookingId: payload.bookingId,
            userId: auth.userId,
            rating: payload.rating,
            comment: payload.comment,
            isVerifiedRide: true,
            isHidden: false,
        });

        await recomputeBikeRating(payload.bikeId);
        return review;
    },

    async updateReview(auth: { userId: string; role: AuthRole; profileId?: string }, reviewId: string, payload: { rating?: number; comment?: string }) {
        const review = await reviewRepository.findById(reviewId);
        if (!review) {
            throw new AppError(404, "Review not found", "NOT_FOUND");
        }

        ensureReviewAccess(auth, review);
        const updated = await reviewRepository.updateById(reviewId, payload);
        await recomputeBikeRating(review.bikeId.toString());
        return updated;
    },

    async deleteReview(auth: { userId: string; role: AuthRole; profileId?: string }, reviewId: string) {
        const review = await reviewRepository.findById(reviewId);
        if (!review) {
            throw new AppError(404, "Review not found", "NOT_FOUND");
        }

        ensureReviewAccess(auth, review);
        const deleted = await reviewRepository.deleteById(reviewId);
        await recomputeBikeRating(review.bikeId.toString());
        return deleted;
    },

    async getReview(reviewId: string) {
        const review = await reviewRepository.findById(reviewId);
        if (!review) {
            throw new AppError(404, "Review not found", "NOT_FOUND");
        }

        return review;
    },

    async listByBikeId(bikeId: string, query: Record<string, unknown>) {
        const page = Number(query.page ?? 1);
        const limit = Number(query.limit ?? 10);
        const skip = (page - 1) * limit;
        const [items, total] = await Promise.all([
            reviewRepository.listByBikeId(bikeId, skip, limit),
            reviewRepository.countByBikeId(bikeId),
        ]);

        return {
            items,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    },
};

export default reviewService;
