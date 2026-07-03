import AppError from "../errors/AppError.ts";
import { bikeRepository } from "../repositories/bike.repository.ts";
import { bookingRepository } from "../repositories/booking.repository.ts";
import type { AuthRole } from "../interfaces/auth.interface.ts";

const dayMs = 24 * 60 * 60 * 1000;

const calculateRentalDays = (startDate: Date, endDate: Date) => {
    const diff = endDate.getTime() - startDate.getTime();
    return Math.max(1, Math.ceil(diff / dayMs));
};

const ensureBookingAccess = (auth: { userId: string; role: AuthRole; profileId?: string }, booking: any) => {
    if (auth.role === "admin") {
        return;
    }

    if (auth.role === "renter" && booking.renterId?.toString() === auth.profileId) {
        return;
    }

    if (auth.role === "owner" && booking.ownerId?.toString() === auth.profileId) {
        return;
    }

    throw new AppError(403, "You do not have access to this booking", "FORBIDDEN");
};

const refreshBikeAvailability = async (bikeId: string) => {
    const bike = await bikeRepository.findById(bikeId);
    if (!bike) {
        return;
    }

    const activeBookingCount = await bookingRepository.countActiveByBikeId(bikeId);
    if (activeBookingCount > 0) {
        await bikeRepository.updateById(bikeId, { status: "unavailable" });
        return;
    }

    if (bike.status === "unavailable") {
        await bikeRepository.updateById(bikeId, { status: "available" });
    }
};

const bookingService = {
    async createBooking(auth: { userId: string; role: AuthRole; profileId?: string }, payload: { bikeId: string; startDate: Date; endDate: Date; pickupLocation: string; dropoffLocation?: string; notes?: string }) {
        if (auth.role !== "renter") {
            throw new AppError(403, "Only renters can create bookings", "FORBIDDEN");
        }

        if (!auth.profileId) {
            throw new AppError(400, "Renter profile is missing", "BAD_REQUEST");
        }

        const bike = await bikeRepository.findById(payload.bikeId);
        if (!bike) {
            throw new AppError(404, "Bike not found", "NOT_FOUND");
        }

        if (bike.status !== "available") {
            throw new AppError(409, "Bike is currently unavailable", "CONFLICT");
        }

        if (payload.endDate <= payload.startDate) {
            throw new AppError(400, "End date must be after start date", "BAD_REQUEST");
        }

        const overlap = await bookingRepository.findOverlap(payload.bikeId, payload.startDate, payload.endDate);
        if (overlap) {
            throw new AppError(409, "Bike is already booked for the selected period", "CONFLICT");
        }

        const rentalDays = calculateRentalDays(payload.startDate, payload.endDate);
        const totalAmount = (bike.pricePerDay * rentalDays) + (bike.serviceFee ?? 0);

        return bookingRepository.create({
            bikeId: payload.bikeId,
            renterId: auth.profileId,
            ownerId: bike.ownerId,
            startDate: payload.startDate,
            endDate: payload.endDate,
            pickupLocation: payload.pickupLocation,
            dropoffLocation: payload.dropoffLocation ?? null,
            notes: payload.notes ?? null,
            status: "pending",
            paymentStatus: "unpaid",
            totalAmount,
            currency: "NPR",
        });
    },

    async getBooking(auth: { userId: string; role: AuthRole; profileId?: string }, bookingId: string) {
        const booking = await bookingRepository.findById(bookingId);
        if (!booking) {
            throw new AppError(404, "Booking not found", "NOT_FOUND");
        }

        ensureBookingAccess(auth, booking);
        return booking;
    },

    async listBookings(auth: { userId: string; role: AuthRole; profileId?: string }, query: Record<string, unknown>) {
        const page = Number(query.page ?? 1);
        const limit = Number(query.limit ?? 10);
        const skip = (page - 1) * limit;

        const filter: Record<string, unknown> = {};
        if (query.status) filter.status = query.status;
        if (query.paymentStatus) filter.paymentStatus = query.paymentStatus;

        if (auth.role === "renter") {
            filter.renterId = auth.profileId;
        } else if (auth.role === "owner") {
            filter.ownerId = auth.profileId;
        }

        const [items, total] = await Promise.all([
            bookingRepository.list(filter, { createdAt: -1 }, skip, limit),
            bookingRepository.count(filter),
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

    async confirmBooking(auth: { userId: string; role: AuthRole; profileId?: string }, bookingId: string) {
        const booking = await bookingRepository.findById(bookingId);
        if (!booking) {
            throw new AppError(404, "Booking not found", "NOT_FOUND");
        }

        if (auth.role !== "admin" && booking.ownerId?.toString() !== auth.profileId) {
            throw new AppError(403, "You cannot confirm this booking", "FORBIDDEN");
        }

        const updated = await bookingRepository.updateById(bookingId, { status: "confirmed", paymentStatus: booking.paymentStatus === "paid" ? "paid" : "pending" });
        await bikeRepository.updateById(booking.bikeId.toString(), { status: "unavailable" });
        return updated;
    },

    async cancelBooking(auth: { userId: string; role: AuthRole; profileId?: string }, bookingId: string, reason: string) {
        const booking = await bookingRepository.findById(bookingId);
        if (!booking) {
            throw new AppError(404, "Booking not found", "NOT_FOUND");
        }

        ensureBookingAccess(auth, booking);

        const updated = await bookingRepository.updateById(bookingId, {
            status: "cancelled",
            cancellationReason: reason,
            paymentStatus: booking.paymentStatus === "paid" ? "refunded" : booking.paymentStatus,
        });

        await refreshBikeAvailability(booking.bikeId.toString());
        return updated;
    },

    async completeBooking(auth: { userId: string; role: AuthRole; profileId?: string }, bookingId: string) {
        const booking = await bookingRepository.findById(bookingId);
        if (!booking) {
            throw new AppError(404, "Booking not found", "NOT_FOUND");
        }

        if (auth.role !== "admin" && booking.ownerId?.toString() !== auth.profileId) {
            throw new AppError(403, "You cannot complete this booking", "FORBIDDEN");
        }

        const updated = await bookingRepository.updateById(bookingId, { status: "completed" });
        await refreshBikeAvailability(booking.bikeId.toString());
        return updated;
    },
};

export default bookingService;
