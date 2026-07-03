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

const buildPriceBreakdown = (bike: any, startDate: Date, endDate: Date) => {
    const rentalDays = calculateRentalDays(startDate, endDate);
    const pricePerDay = bike.pricePerDay as number;
    const baseAmount = pricePerDay * rentalDays;
    const serviceFee = bike.serviceFee ?? 0;
    const securityDeposit = bike.securityDeposit ?? 0;

    return {
        pricePerDay,
        rentalDays,
        baseAmount,
        serviceFee,
        securityDeposit,
        total: baseAmount + serviceFee,
    };
};

const bookingService = {
    // Live fare estimate for the duration slider - no booking is created
    // and there are no fees beyond what is listed here (PR-02, PR-01).
    async quote(payload: { bikeId: string; startDate: Date; endDate: Date }) {
        const bike = await bikeRepository.findById(payload.bikeId);
        if (!bike) {
            throw new AppError(404, "Bike not found", "NOT_FOUND");
        }

        if (payload.endDate <= payload.startDate) {
            throw new AppError(400, "End date must be after start date", "BAD_REQUEST");
        }

        const breakdown = buildPriceBreakdown(bike, payload.startDate, payload.endDate);
        return {
            ...breakdown,
            pricePerHour: bike.pricePerHour ?? null,
            currency: "NPR",
            noHiddenFees: true,
        };
    },

    // "Available Now" vs "Next available at ..." for listings (BK-05).
    async getBikeAvailability(bikeId: string) {
        const bike = await bikeRepository.findById(bikeId);
        if (!bike) {
            throw new AppError(404, "Bike not found", "NOT_FOUND");
        }

        if (bike.status === "maintenance" || bike.status === "inactive") {
            return { availableNow: false, nextAvailableAt: null, reason: bike.status };
        }

        const now = new Date();
        const activeBookings = await bookingRepository.list(
            {
                bikeId,
                status: { $in: ["pending", "confirmed"] },
                endDate: { $gt: now },
                startDate: { $lte: now },
            },
            { endDate: 1 },
            0,
            1,
        );

        const current = activeBookings[0];
        if (!current && bike.status === "available") {
            return { availableNow: true, nextAvailableAt: null, reason: null };
        }

        return {
            availableNow: false,
            nextAvailableAt: current?.endDate ?? null,
            reason: "booked",
        };
    },

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

        const priceBreakdown = buildPriceBreakdown(bike, payload.startDate, payload.endDate);

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
            totalAmount: priceBreakdown.total,
            currency: "NPR",
            priceBreakdown,
            // Price locked from this moment (PR-07).
            priceLockedAt: new Date(),
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

    // Pre-ride handover checklist (BC-02): brakes, tires, lights, fuel.
    async submitChecklist(auth: { userId: string; role: AuthRole; profileId?: string }, bookingId: string, payload: { items: { key: string; ok: boolean; note?: string | null }[]; photos?: string[]; acknowledged: boolean }) {
        const booking = await bookingRepository.findById(bookingId);
        if (!booking) {
            throw new AppError(404, "Booking not found", "NOT_FOUND");
        }

        ensureBookingAccess(auth, booking);

        if (booking.status !== "confirmed") {
            throw new AppError(400, "The checklist is filled at pickup, after the booking is confirmed", "BAD_REQUEST");
        }

        return bookingRepository.updateById(bookingId, {
            preRideChecklist: {
                items: payload.items,
                photos: payload.photos ?? [],
                acknowledged: payload.acknowledged,
                completedAt: new Date(),
            },
        });
    },

    // Shows the rider what a return right now would mean, including any
    // late fee, BEFORE anything is charged (RET-02, transparency).
    async returnPreview(auth: { userId: string; role: AuthRole; profileId?: string }, bookingId: string) {
        const booking = await bookingRepository.findById(bookingId);
        if (!booking) {
            throw new AppError(404, "Booking not found", "NOT_FOUND");
        }

        ensureBookingAccess(auth, booking);

        const bike = await bikeRepository.findById(booking.bikeId.toString());
        const hourlyRate = bike?.pricePerHour ?? Math.ceil((bike?.pricePerDay ?? 0) / 8);

        const now = new Date();
        const lateMs = now.getTime() - new Date(booking.endDate).getTime();
        const lateMinutes = Math.max(0, Math.ceil(lateMs / 60000));
        const lateFeeAmount = lateMinutes > 15 ? Math.ceil(lateMinutes / 60) * hourlyRate : 0;

        return {
            endDate: booking.endDate,
            now,
            onTime: lateMinutes <= 15,
            lateMinutes,
            lateFeeAmount,
            graceMinutes: 15,
            extendCostPerHour: hourlyRate,
        };
    },

    // Extend the rental straight from the return screen (RET-03). The
    // old and new totals are both returned so the change is explicit.
    async extendBooking(auth: { userId: string; role: AuthRole; profileId?: string }, bookingId: string, extraHours: number) {
        const booking = await bookingRepository.findById(bookingId);
        if (!booking) {
            throw new AppError(404, "Booking not found", "NOT_FOUND");
        }

        ensureBookingAccess(auth, booking);

        if (booking.status !== "confirmed") {
            throw new AppError(400, "Only an active booking can be extended", "BAD_REQUEST");
        }

        const bike = await bikeRepository.findById(booking.bikeId.toString());
        const hourlyRate = bike?.pricePerHour ?? Math.ceil((bike?.pricePerDay ?? 0) / 8);
        const extensionCost = hourlyRate * extraHours;

        const newEndDate = new Date(new Date(booking.endDate).getTime() + extraHours * 60 * 60 * 1000);
        const overlap = await bookingRepository.findOverlap(booking.bikeId.toString(), booking.endDate, newEndDate);
        if (overlap && overlap._id.toString() !== bookingId) {
            throw new AppError(409, "Another rider has the bike right after you - extension not possible", "CONFLICT");
        }

        const oldTotal = booking.totalAmount;
        const updated = await bookingRepository.updateById(bookingId, {
            endDate: newEndDate,
            extensionHours: (booking.extensionHours ?? 0) + extraHours,
            extensionAmount: (booking.extensionAmount ?? 0) + extensionCost,
            totalAmount: oldTotal + extensionCost,
        });

        return {
            booking: updated,
            oldTotal,
            newTotal: oldTotal + extensionCost,
            extensionCost,
            newEndDate,
        };
    },

    // Rider returns the bike (RET-01/02): records the time, shows
    // on-time or late, and frees the bike for the next rider.
    async returnBike(auth: { userId: string; role: AuthRole; profileId?: string }, bookingId: string) {
        const booking = await bookingRepository.findById(bookingId);
        if (!booking) {
            throw new AppError(404, "Booking not found", "NOT_FOUND");
        }

        ensureBookingAccess(auth, booking);

        if (booking.status !== "confirmed") {
            throw new AppError(400, "This booking is not active", "BAD_REQUEST");
        }

        const preview = await this.returnPreview(auth, bookingId);
        const updated = await bookingRepository.updateById(bookingId, {
            status: "completed",
            returnedAt: preview.now,
            lateMinutes: preview.lateMinutes,
            lateFeeAmount: preview.lateFeeAmount,
        });

        await refreshBikeAvailability(booking.bikeId.toString());

        return {
            booking: updated,
            onTime: preview.onTime,
            lateMinutes: preview.lateMinutes,
            lateFeeAmount: preview.lateFeeAmount,
        };
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
