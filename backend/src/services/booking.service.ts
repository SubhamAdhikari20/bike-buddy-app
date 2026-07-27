import crypto from "node:crypto";
import AppError from "../errors/AppError.ts";
import { bikeRepository } from "../repositories/bike.repository.ts";
import { bookingRepository } from "../repositories/booking.repository.ts";
import { paymentRepository } from "../repositories/payment.repository.ts";
import { renterRepository } from "../repositories/renter.repository.ts";
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

export const calculateLateFee = (
  endDate: Date,
  now: Date,
  hourlyRate: number,
  graceMinutes = 15,
) => {
  const lateMs = now.getTime() - endDate.getTime();
  const lateMinutes = Math.max(0, Math.ceil(lateMs / 60_000));
  const billableLateMinutes = Math.max(0, lateMinutes - graceMinutes);
  const lateFeeAmount =
    billableLateMinutes > 0
      ? Math.ceil(billableLateMinutes / 60) * hourlyRate
      : 0;

  return {
    onTime: lateMinutes <= graceMinutes,
    lateMinutes,
    lateFeeAmount,
    graceMinutes,
  };
};

export const buildCancellationPolicy = (
  booking: {
    startDate: Date;
    status: string;
    paymentStatus: string;
    paymentMode?: string | null | undefined;
    paymentMethod?: string | null | undefined;
    totalAmount: number;
  },
  now = new Date(),
) => {
  const hoursToStart =
    (new Date(booking.startDate).getTime() - now.getTime()) /
    (60 * 60 * 1000);
  const cancellable = ["pending", "confirmed"].includes(booking.status);
  const fullRefund = hoursToStart >= 12;
  const isPaid = booking.paymentStatus === "paid";
  const refundPercent = isPaid ? (fullRefund ? 100 : 80) : 0;
  const demoRefundAvailable = isPaid && booking.paymentMode === "demo";

  return {
    cancellable,
    fullRefund,
    refundPercent,
    refundWorkflowAvailable: !isPaid || demoRefundAvailable,
    estimatedRefundAmount:
      isPaid
        ? Math.round((Number(booking.totalAmount) * refundPercent) / 100)
        : 0,
    policyText: !isPaid
      ? "No payment is recorded, so cancellation does not require a refund."
      : fullRefund
        ? "Cancelling at least 12 hours before pickup qualifies for a full refund under the coursework policy."
        : "Within 12 hours of pickup, the coursework policy records an 80% refund.",
    notice: demoRefundAvailable
      ? "This is a demo refund record; no money moves."
      : isPaid
        ? "Cancellation is disabled until a verified live or cash-refund workflow is available."
        : "You can cancel this unpaid booking.",
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

const ensureRenterOwnsBooking = (
  auth: { userId: string; role: AuthRole; profileId?: string },
  booking: any,
) => {
  if (
    auth.role !== "renter" ||
    !referencesDocument(booking.renterId, auth.profileId)
  ) {
    throw new AppError(
      403,
      "Only the renter for this booking can manage the ride",
      "FORBIDDEN",
    );
  }
};

const ensureConfirmedRide = (booking: any) => {
  if (booking.status !== "confirmed" || booking.paymentStatus !== "paid") {
    throw new AppError(
      409,
      "This action is available only for a paid, confirmed ride",
      "CONFLICT",
    );
  }
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
    const policy = buildCancellationPolicy(booking);
    let paymentStatus = booking.paymentStatus;
    let refund: Record<string, unknown> | null = null;

    if (booking.paymentStatus === "paid") {
      if (booking.paymentMode !== "demo") {
        throw new AppError(
          501,
          "This paid booking needs a verified live refund workflow",
          "REFUND_PROVIDER_NOT_CONFIGURED",
        );
      }
      const payment = await paymentRepository.findByBookingId(bookingId);
      if (!payment || payment.status !== "succeeded" || payment.mode !== "demo") {
        throw new AppError(
          409,
          "The successful demo payment could not be reconciled",
          "PAYMENT_STATE_MISMATCH",
        );
      }
      await paymentRepository.updateById(payment._id.toString(), {
        status: "refunded",
        gatewayMessage: `${policy.refundPercent}% demo refund recorded — no money moved`,
      });
      paymentStatus = "refunded";
      refund = {
        simulated: true,
        charged: false,
        refundPercent: policy.refundPercent,
        amount: policy.estimatedRefundAmount,
        notice: "Demo refund recorded. No money was charged or transferred.",
      };
    } else if (booking.paymentStatus === "pending") {
      const payment = await paymentRepository.findByBookingId(bookingId);
      if (payment?.status === "pending") {
        await paymentRepository.updateById(payment._id.toString(), {
          status: "failed",
          gatewayMessage: "Payment attempt closed because the booking was cancelled",
        });
      }
      paymentStatus = booking.paymentMethod === "cash" ? "unpaid" : "failed";
    }

    const updated = await bookingRepository.updateById(bookingId, {
      status: "cancelled",
      cancellationReason: reason,
      paymentStatus,
    });
    await refreshBikeAvailability(toDocumentId(booking.bikeId) ?? "");
    return { booking: updated, policy, refund };
  },

  async selectCashAtPickup(
    auth: { userId: string; role: AuthRole; profileId?: string },
    bookingId: string,
  ) {
    const booking = await bookingRepository.findById(bookingId);
    if (!booking) {
      throw new AppError(404, "Booking not found", "NOT_FOUND");
    }
    ensureRenterOwnsBooking(auth, booking);
    if (
      booking.status !== "pending" ||
      !["unpaid", "failed"].includes(booking.paymentStatus)
    ) {
      throw new AppError(
        409,
        "Cash can be selected only for an unpaid pending booking",
        "CONFLICT",
      );
    }
    if (new Date(booking.startDate) <= new Date()) {
      throw new AppError(
        409,
        "Cash at pickup cannot be selected after the ride starts",
        "CONFLICT",
      );
    }

    const reference =
      booking.cashReference ??
      `CASH-${crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
    const updated = await bookingRepository.updateById(bookingId, {
      status: "confirmed",
      paymentStatus: "pending",
      paymentMethod: "cash",
      paymentMode: null,
      cashReference: reference,
    });
    await refreshBikeAvailability(toDocumentId(booking.bikeId) ?? "");

    return {
      booking: updated,
      reference,
      charged: false,
      instructions:
        `Bring exactly NPR ${Number(booking.totalAmount).toLocaleString("en-US")} to pickup. ` +
        "The receipt becomes available after the owner records the cash as received.",
    };
  },

  async confirmCashReceived(
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
      throw new AppError(
        403,
        "Only this bike owner or an administrator can record cash receipt",
        "FORBIDDEN",
      );
    }
    if (
      booking.status !== "confirmed" ||
      booking.paymentMethod !== "cash" ||
      booking.paymentStatus !== "pending" ||
      !booking.cashReference
    ) {
      throw new AppError(
        409,
        "This booking is not awaiting cash at pickup",
        "CONFLICT",
      );
    }

    const renterProfileId = toDocumentId(booking.renterId);
    const renter = renterProfileId
      ? await renterRepository.findById(renterProfileId)
      : null;
    const payerId = renter ? toDocumentId(renter.baseUserId) : null;
    if (!payerId) {
      throw new AppError(
        409,
        "The renter account could not be reconciled",
        "PAYMENT_STATE_MISMATCH",
      );
    }

    const existing = await paymentRepository.findByBookingId(bookingId);
    if (existing?.status === "succeeded") {
      throw new AppError(409, "Cash receipt was already recorded", "CONFLICT");
    }
    const receivedAt = new Date();
    const payment = await paymentRepository.create({
      bookingId,
      payerId,
      provider: "manual",
      mode: "live",
      amount: booking.totalAmount,
      currency: booking.currency ?? "NPR",
      status: "succeeded",
      transactionRef: booking.cashReference,
      gatewayMessage: `Cash receipt recorded by ${auth.role}`,
      receiptUrl: null,
    });
    const updated = await bookingRepository.updateById(bookingId, {
      paymentStatus: "paid",
      paymentMode: "live",
      cashReceivedAt: receivedAt,
    });

    return {
      booking: updated,
      payment,
      receivedAt,
      message: "Cash receipt recorded. The renter can now download a receipt.",
    };
  },

  async rescheduleBooking(
    auth: { userId: string; role: AuthRole; profileId?: string },
    bookingId: string,
    newStartDate: Date,
  ) {
    const booking = await bookingRepository.findById(bookingId);
    if (!booking) {
      throw new AppError(404, "Booking not found", "NOT_FOUND");
    }
    ensureRenterOwnsBooking(auth, booking);
    if (!["pending", "confirmed"].includes(booking.status)) {
      throw new AppError(
        409,
        "Only an upcoming booking can be rescheduled",
        "CONFLICT",
      );
    }
    if (new Date(booking.startDate) <= new Date()) {
      throw new AppError(
        409,
        "A ride that has started cannot be rescheduled",
        "CONFLICT",
      );
    }

    const durationMs =
      new Date(booking.endDate).getTime() -
      new Date(booking.startDate).getTime();
    const newEndDate = new Date(newStartDate.getTime() + durationMs);
    validateBookingDates(newStartDate, newEndDate);
    const bikeId = toDocumentId(booking.bikeId);
    if (!bikeId) {
      throw new AppError(409, "Booking has no bike reference", "CONFLICT");
    }
    const overlap = await bookingRepository.findOverlap(
      bikeId,
      newStartDate,
      newEndDate,
    );
    if (overlap && !referencesDocument(overlap._id, bookingId)) {
      throw new AppError(
        409,
        "The bike is already booked for that time",
        "CONFLICT",
      );
    }

    return bookingRepository.updateById(bookingId, {
      startDate: newStartDate,
      endDate: newEndDate,
    });
  },

  getCancellationPolicy(booking: any) {
    return buildCancellationPolicy(booking);
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

  async submitChecklist(
    auth: { userId: string; role: AuthRole; profileId?: string },
    bookingId: string,
    payload: {
      items: { key: string; ok: boolean; note?: string | null }[];
      photos?: string[];
      acknowledged: true;
    },
  ) {
    const booking = await bookingRepository.findById(bookingId);
    if (!booking) {
      throw new AppError(404, "Booking not found", "NOT_FOUND");
    }
    ensureRenterOwnsBooking(auth, booking);
    ensureConfirmedRide(booking);

    if (booking.preRideChecklist?.completedAt) {
      throw new AppError(
        409,
        "The handover checklist has already been submitted",
        "CONFLICT",
      );
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

  async returnPreview(
    auth: { userId: string; role: AuthRole; profileId?: string },
    bookingId: string,
  ) {
    const booking = await bookingRepository.findById(bookingId);
    if (!booking) {
      throw new AppError(404, "Booking not found", "NOT_FOUND");
    }
    ensureRenterOwnsBooking(auth, booking);
    ensureConfirmedRide(booking);

    const bikeId = toDocumentId(booking.bikeId);
    const bike = bikeId ? await bikeRepository.findById(bikeId) : null;
    if (!bike) {
      throw new AppError(404, "Bike not found", "NOT_FOUND");
    }

    const hourlyRate = Number(
      bike.pricePerHour ?? Math.ceil(Number(bike.pricePerDay) / 8),
    );
    const now = new Date();
    const lateFee = calculateLateFee(
      new Date(booking.endDate),
      now,
      hourlyRate,
    );

    return {
      endDate: booking.endDate,
      now,
      ...lateFee,
      extendCostPerHour: hourlyRate,
      charged: false,
      notice:
        lateFee.lateFeeAmount > 0
          ? "This is an estimated amount. No late fee has been charged."
          : "No late fee applies.",
    };
  },

  async extendBooking(
    auth: { userId: string; role: AuthRole; profileId?: string },
    bookingId: string,
    extraHours: number,
  ) {
    const booking = await bookingRepository.findById(bookingId);
    if (!booking) {
      throw new AppError(404, "Booking not found", "NOT_FOUND");
    }
    ensureRenterOwnsBooking(auth, booking);
    ensureConfirmedRide(booking);

    if (booking.paymentMode !== "demo") {
      throw new AppError(
        501,
        "Live extensions require a verified payment provider and are not enabled",
        "PAYMENT_PROVIDER_NOT_CONFIGURED",
      );
    }

    const bikeId = toDocumentId(booking.bikeId);
    const bike = bikeId ? await bikeRepository.findById(bikeId) : null;
    if (!bike) {
      throw new AppError(404, "Bike not found", "NOT_FOUND");
    }

    const hourlyRate = Number(
      bike.pricePerHour ?? Math.ceil(Number(bike.pricePerDay) / 8),
    );
    const extensionCost = hourlyRate * extraHours;
    const currentEndDate = new Date(booking.endDate);
    const newEndDate = new Date(
      currentEndDate.getTime() + extraHours * 60 * 60 * 1000,
    );
    const overlap = await bookingRepository.findOverlap(
      bikeId!,
      currentEndDate,
      newEndDate,
    );
    if (overlap && !referencesDocument(overlap._id, bookingId)) {
      throw new AppError(
        409,
        "Another rider has this bike next, so the ride cannot be extended",
        "CONFLICT",
      );
    }

    const oldTotal = Number(booking.totalAmount);
    const newTotal = oldTotal + extensionCost;
    const currentBreakdown = booking.priceBreakdown;
    const updated = await bookingRepository.updateById(bookingId, {
      endDate: newEndDate,
      extensionHours: Number(booking.extensionHours ?? 0) + extraHours,
      extensionAmount: Number(booking.extensionAmount ?? 0) + extensionCost,
      totalAmount: newTotal,
      ...(currentBreakdown
        ? {
            priceBreakdown: {
              pricePerDay: currentBreakdown.pricePerDay,
              rentalDays: currentBreakdown.rentalDays,
              baseAmount: currentBreakdown.baseAmount,
              serviceFee: currentBreakdown.serviceFee,
              securityDeposit: currentBreakdown.securityDeposit,
              total: newTotal,
            },
          }
        : {}),
    });

    return {
      booking: updated,
      oldTotal,
      newTotal,
      extensionCost,
      newEndDate,
      mode: "demo",
      charged: false,
      notice: "Demo extension recorded. No money was charged.",
    };
  },

  async returnBike(
    auth: { userId: string; role: AuthRole; profileId?: string },
    bookingId: string,
  ) {
    const booking = await bookingRepository.findById(bookingId);
    if (!booking) {
      throw new AppError(404, "Booking not found", "NOT_FOUND");
    }
    ensureRenterOwnsBooking(auth, booking);
    ensureConfirmedRide(booking);

    if (!booking.preRideChecklist?.completedAt) {
      throw new AppError(
        409,
        "Complete the handover checklist before recording the return",
        "CHECKLIST_REQUIRED",
      );
    }

    const preview = await this.returnPreview(auth, bookingId);
    const updated = await bookingRepository.updateById(bookingId, {
      status: "completed",
      returnedAt: preview.now,
      lateMinutes: preview.lateMinutes,
      lateFeeAmount: preview.lateFeeAmount,
    });

    await refreshBikeAvailability(toDocumentId(booking.bikeId) ?? "");

    return {
      booking: updated,
      onTime: preview.onTime,
      lateMinutes: preview.lateMinutes,
      lateFeeAmount: preview.lateFeeAmount,
      charged: false,
      notice:
        preview.lateFeeAmount > 0
          ? "The late fee is recorded as an estimate; no money was charged."
          : "Return recorded with no extra fee.",
    };
  },
};

export default bookingService;
