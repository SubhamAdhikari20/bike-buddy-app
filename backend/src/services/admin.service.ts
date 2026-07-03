import AppError from "../errors/AppError.ts";
import { userRepository } from "../repositories/user.repository.ts";
import { renterRepository } from "../repositories/renter.repository.ts";
import { bikeRepository } from "../repositories/bike.repository.ts";
import { bookingRepository } from "../repositories/booking.repository.ts";
import { reviewRepository } from "../repositories/review.repository.ts";
import { paymentRepository } from "../repositories/payment.repository.ts";

const listWithPagination = async (listFn: (filter: Record<string, unknown>, sort: Record<string, 1 | -1>, skip: number, limit: number) => Promise<unknown[]>, countFn: (filter: Record<string, unknown>) => Promise<number>, filter: Record<string, unknown>, query: Record<string, unknown>) => {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 10);
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
        listFn(filter, { createdAt: -1 }, skip, limit),
        countFn(filter),
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
};

const adminService = {
    async getDashboardSummary() {
        const [users, bikes, bookings, payments, reviews] = await Promise.all([
            userRepository.count({}),
            bikeRepository.count({}),
            bookingRepository.count({}),
            paymentRepository.count({}),
            reviewRepository.count({}),
        ]);

        return {
            totalUsers: users,
            totalBikes: bikes,
            totalBookings: bookings,
            totalPayments: payments,
            totalReviews: reviews,
        };
    },

    async listUsers(query: Record<string, unknown>) {
        return listWithPagination(
            async (filter, sort, skip, limit) => userRepository.list(filter, { sort, skip, limit }),
            userRepository.count,
            {},
            query,
        );
    },

    async listBikes(query: Record<string, unknown>) {
        return listWithPagination(bikeRepository.list, bikeRepository.count, {}, query);
    },

    async listBookings(query: Record<string, unknown>) {
        return listWithPagination(bookingRepository.list, bookingRepository.count, {}, query);
    },

    async listReviews(query: Record<string, unknown>) {
        return listWithPagination(reviewRepository.list, reviewRepository.count, {}, query);
    },

    async hideReview(reviewId: string) {
        const review = await reviewRepository.findById(reviewId);
        if (!review) {
            throw new AppError(404, "Review not found", "NOT_FOUND");
        }

        return reviewRepository.updateById(reviewId, { isHidden: true });
    },

    async updateBikeStatus(bikeId: string, status: string) {
        const bike = await bikeRepository.findById(bikeId);
        if (!bike) {
            throw new AppError(404, "Bike not found", "NOT_FOUND");
        }

        return bikeRepository.updateById(bikeId, { status });
    },

    async reviewKyc(renterId: string, status: "approved" | "rejected") {
        const renter = await renterRepository.findById(renterId);
        if (!renter) {
            throw new AppError(404, "Renter not found", "NOT_FOUND");
        }

        if (renter.kycStatus !== "pending") {
            throw new AppError(409, "This renter has no pending ID verification", "CONFLICT");
        }

        return renterRepository.updateById(renterId, { kycStatus: status });
    },

    async updateBookingStatus(bookingId: string, status: string) {
        const booking = await bookingRepository.findById(bookingId);
        if (!booking) {
            throw new AppError(404, "Booking not found", "NOT_FOUND");
        }

        return bookingRepository.updateById(bookingId, { status });
    },
};

export default adminService;
