import AppError from "../errors/AppError.ts";
import { bikeRepository } from "../repositories/bike.repository.ts";
import { bookingRepository } from "../repositories/booking.repository.ts";
import type { AuthRole } from "../interfaces/auth.interface.ts";
import { referencesDocument, toDocumentId } from "../utils/mongo-reference.ts";

const dayMs = 24 * 60 * 60 * 1000;
const maxAdvanceDays = 90;
const maxRentalDays = 30;

export const calculateRentalDays = (startDate: Date, endDate: Date) => {
  const diff = endDate.getTime() - startDate.getTime();
  return Math.max(1, Math.ceil(diff / dayMs));
};

const validateBookingDates = (startDate: Date, endDate: Date) => {
  if (endDate <= startDate) {
    throw new AppError(400, "End date must be after start date", "BAD_REQUEST");
  }

  if (startDate.getTime() < Date.now() - 5 * 60 * 1000) {
    throw new AppError(400, "Start date cannot be in the past", "BAD_REQUEST");
  }

  if (startDate.getTime() > Date.now() + maxAdvanceDays * dayMs) {
    throw new AppError(
      400,
      `Bookings can be made up to ${maxAdvanceDays} days ahead`,
      "BAD_REQUEST",
    );
  }

  if (calculateRentalDays(startDate, endDate) > maxRentalDays) {
    throw new AppError(
      400,
      `A single booking cannot exceed ${maxRentalDays} days`,
      "BAD_REQUEST",
    );
  }
};

export const buildPriceBreakdown = (
  bike: {
    pricePerDay: number;
    serviceFee?: number | null | undefined;
    securityDeposit?: number | null | undefined;
  },
  startDate: Date,
  endDate: Date,
) => {
  const rentalDays = calculateRentalDays(startDate, endDate);
  const pricePerDay = Number(bike.pricePerDay);
  const baseAmount = pricePerDay * rentalDays;
  const serviceFee = Number(bike.serviceFee ?? 0);
  const securityDeposit = Number(bike.securityDeposit ?? 0);

  return {
    pricePerDay,
    rentalDays,
    baseAmount,
    serviceFee,
    securityDeposit,
    total: baseAmount + serviceFee + securityDeposit,
  };
};

const ensureBookingAccess = (
  auth: { userId: string; role: AuthRole; profileId?: string },
  booking: any,
) => {
  if (auth.role === "admin") {
    return;
  }

  if (
    auth.role === "renter" &&
    referencesDocument(booking.renterId, auth.profileId)
  ) {
    return;
  }

  if (
    auth.role === "owner" &&
    referencesDocument(booking.ownerId, auth.profileId)
  ) {
    return;
  }

  throw new AppError(
    403,
    "You do not have access to this booking",
    "FORBIDDEN",
  );
};

const refreshBikeAvailability = async (bikeId: string) => {
  if (!bikeId) return;

  const bike = await bikeRepository.findById(bikeId);
  if (!bike) return;

  const activeBookingCount =
    await bookingRepository.countActiveByBikeId(bikeId);
  if (activeBookingCount > 0) {
    await bikeRepository.updateById(bikeId, { status: "unavailable" });
  } else if (bike.status === "unavailable") {
    await bikeRepository.updateById(bikeId, { status: "available" });
  }
};

const bookingService = {
  async quote(payload: { bikeId: string; startDate: Date; endDate: Date }) {
    validateBookingDates(payload.startDate, payload.endDate);
    const bike = await bikeRepository.findById(payload.bikeId);
    if (!bike) {
      throw new AppError(404, "Bike not found", "NOT_FOUND");
    }

    return {
      ...buildPriceBreakdown(bike, payload.startDate, payload.endDate),
      pricePerHour: bike.pricePerHour ?? null,
      currency: "NPR",
      noHiddenFees: true,
      securityDepositRefundable: true,
    };
  },

  async getBikeAvailability(bikeId: string) {
    const bike = await bikeRepository.findById(bikeId);
    if (!bike) {
      throw new AppError(404, "Bike not found", "NOT_FOUND");
    }

    if (bike.status === "maintenance" || bike.status === "inactive") {
      return {
        availableNow: false,
        nextAvailableAt: null,
        reason: bike.status,
      };
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

  async createBooking(
    auth: { userId: string; role: AuthRole; profileId?: string },
    payload: {
      bikeId: string;
      startDate: Date;
      endDate: Date;
      pickupLocation: string;
      dropoffLocation?: string;
      notes?: string;
    },
  ) {
    if (auth.role !== "renter") {
      throw new AppError(403, "Only renters can create bookings", "FORBIDDEN");
    }
    if (!auth.profileId) {
      throw new AppError(400, "Renter profile is missing", "BAD_REQUEST");
    }

    validateBookingDates(payload.startDate, payload.endDate);
    const bike = await bikeRepository.findById(payload.bikeId);
    if (!bike) {
      throw new AppError(404, "Bike not found", "NOT_FOUND");
    }
    if (bike.status !== "available") {
      throw new AppError(409, "Bike is currently unavailable", "CONFLICT");
    }

    const overlap = await bookingRepository.findOverlap(
      payload.bikeId,
      payload.startDate,
      payload.endDate,
    );
    if (overlap) {
      throw new AppError(
        409,
        "Bike is already booked for the selected period",
        "CONFLICT",
      );
    }

    const priceBreakdown = buildPriceBreakdown(
      bike,
      payload.startDate,
      payload.endDate,
    );

    return bookingRepository.create({
      bikeId: payload.bikeId,
      renterId: auth.profileId,
      ownerId: toDocumentId(bike.ownerId),
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
      priceLockedAt: new Date(),
    });
  },

  async getBooking(
    auth: { userId: string; role: AuthRole; profileId?: string },
    bookingId: string,
  ) {
    const booking = await bookingRepository.findById(bookingId);
    if (!booking) {
      throw new AppError(404, "Booking not found", "NOT_FOUND");
    }
    ensureBookingAccess(auth, booking);
    return booking;
  },

  async listBookings(
    auth: { userId: string; role: AuthRole; profileId?: string },
    query: Record<string, unknown>,
  ) {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 10);
    const skip = (page - 1) * limit;
    const filter: Record<string, unknown> = {};

    if (query.status) filter.status = query.status;
    if (query.paymentStatus) filter.paymentStatus = query.paymentStatus;
    if (auth.role === "renter") filter.renterId = auth.profileId;
    if (auth.role === "owner") filter.ownerId = auth.profileId;

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

  async confirmBooking(
    auth: { userId: string; role: AuthRole; profileId?: string },
    bookingId: string,
  ) {
    const booking = await bookingRepository.findById(bookingId);
    if (!booking) {
      throw new AppError(404, "Booking not found", "NOT_FOUND");
    }
    if (
      auth.role !== "admin" &&
      !referencesDocument(booking.ownerId, auth.profileId)
    ) {
      throw new AppError(403, "You cannot confirm this booking", "FORBIDDEN");
    }
    if (booking.status !== "pending" || booking.paymentStatus !== "paid") {
      throw new AppError(
        409,
        "Only a paid, pending booking can be confirmed",
        "CONFLICT",
      );
    }

    const updated = await bookingRepository.updateById(bookingId, {
      status: "confirmed",
    });
    await refreshBikeAvailability(toDocumentId(booking.bikeId) ?? "");
    return updated;
  },

  async cancelBooking(
    auth: { userId: string; role: AuthRole; profileId?: string },
    bookingId: string,
    reason: string,
  ) {
    const booking = await bookingRepository.findById(bookingId);
    if (!booking) {
      throw new AppError(404, "Booking not found", "NOT_FOUND");
    }
    ensureBookingAccess(auth, booking);

    if (!["pending", "confirmed"].includes(booking.status)) {
      throw new AppError(
        409,
        "This booking can no longer be cancelled",
        "CONFLICT",
      );
    }
    if (booking.paymentStatus === "paid") {
      throw new AppError(
        409,
        "Paid bookings must use the refund workflow",
        "REFUND_REQUIRED",
      );
    }

    const updated = await bookingRepository.updateById(bookingId, {
      status: "cancelled",
      cancellationReason: reason,
    });
    await refreshBikeAvailability(toDocumentId(booking.bikeId) ?? "");
    return updated;
  },

  async completeBooking(
    auth: { userId: string; role: AuthRole; profileId?: string },
    bookingId: string,
  ) {
    const booking = await bookingRepository.findById(bookingId);
    if (!booking) {
      throw new AppError(404, "Booking not found", "NOT_FOUND");
    }
    if (
      auth.role !== "admin" &&
      !referencesDocument(booking.ownerId, auth.profileId)
    ) {
      throw new AppError(403, "You cannot complete this booking", "FORBIDDEN");
    }
    if (booking.status !== "confirmed") {
      throw new AppError(
        409,
        "Only a confirmed booking can be completed",
        "CONFLICT",
      );
    }

    const updated = await bookingRepository.updateById(bookingId, {
      status: "completed",
    });
    await refreshBikeAvailability(toDocumentId(booking.bikeId) ?? "");
    return updated;
  },
};

export default bookingService;
