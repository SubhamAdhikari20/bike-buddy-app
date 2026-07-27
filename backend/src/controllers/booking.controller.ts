import type { RequestHandler } from "express";
import ApiResponse from "../utils/ApiResponse.ts";
import bookingService from "../services/booking.service.ts";
import { streamReceiptPdf } from "../helpers/generate-receipt-pdf.ts";
import { paymentRepository } from "../repositories/payment.repository.ts";
import AppError from "../errors/AppError.ts";

export const createBooking: RequestHandler = async (req, res, next) => {
  try {
    const result = await bookingService.createBooking(req.auth!, req.body);
    res
      .status(201)
      .json(new ApiResponse(201, "Booking created successfully", result));
  } catch (error) {
    next(error);
  }
};

export const getBooking: RequestHandler = async (req, res, next) => {
  try {
    const bookingId = String(req.params.bookingId);
    const result = await bookingService.getBooking(req.auth!, bookingId);
    res
      .status(200)
      .json(new ApiResponse(200, "Booking fetched successfully", result));
  } catch (error) {
    next(error);
  }
};

export const listBookings: RequestHandler = async (req, res, next) => {
  try {
    const result = await bookingService.listBookings(
      req.auth!,
      req.query as Record<string, unknown>,
    );
    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          "Bookings fetched successfully",
          result.items,
          result.pagination,
        ),
      );
  } catch (error) {
    next(error);
  }
};

export const confirmBooking: RequestHandler = async (req, res, next) => {
  try {
    const bookingId = String(req.params.bookingId);
    const result = await bookingService.confirmBooking(req.auth!, bookingId);
    res
      .status(200)
      .json(new ApiResponse(200, "Booking confirmed successfully", result));
  } catch (error) {
    next(error);
  }
};

export const cancelBooking: RequestHandler = async (req, res, next) => {
  try {
    const bookingId = String(req.params.bookingId);
    const result = await bookingService.cancelBooking(
      req.auth!,
      bookingId,
      req.body.reason,
    );
    res
      .status(200)
      .json(new ApiResponse(200, "Booking cancelled successfully", result));
  } catch (error) {
    next(error);
  }
};

export const completeBooking: RequestHandler = async (req, res, next) => {
  try {
    const bookingId = String(req.params.bookingId);
    const result = await bookingService.completeBooking(req.auth!, bookingId);
    res
      .status(200)
      .json(new ApiResponse(200, "Booking completed successfully", result));
  } catch (error) {
    next(error);
  }
};

export const quoteBooking: RequestHandler = async (req, res, next) => {
  try {
    const result = await bookingService.quote(req.body);
    res
      .status(200)
      .json(new ApiResponse(200, "Fare estimate calculated", result));
  } catch (error) {
    next(error);
  }
};

export const getBikeAvailability: RequestHandler = async (req, res, next) => {
  try {
    const result = await bookingService.getBikeAvailability(
      String(req.params.bikeId),
    );
    res.status(200).json(new ApiResponse(200, "Availability fetched", result));
  } catch (error) {
    next(error);
  }
};

export const downloadReceipt: RequestHandler = async (req, res, next) => {
  try {
    const bookingId = String(req.params.bookingId);
    const booking: any = await bookingService.getBooking(req.auth!, bookingId);
    const payment = await paymentRepository.findByBookingId(bookingId);
    if (booking.paymentStatus !== "paid" || payment?.status !== "succeeded") {
      throw new AppError(
        409,
        "A receipt is available after payment confirmation",
        "PAYMENT_NOT_CONFIRMED",
      );
    }

    const bike: any = booking.bikeId;
    const renter: any = booking.renterId;
    streamReceiptPdf(res, {
      receiptNumber: bookingId.slice(-8).toUpperCase(),
      issuedAt: payment.updatedAt ?? new Date(),
      renterName: renter?.fullName ?? "Bike Buddy rider",
      bikeTitle: bike?.title ?? "Bike",
      startDate: booking.startDate,
      endDate: booking.endDate,
      pickupLocation: booking.pickupLocation,
      breakdown: booking.priceBreakdown
        ? {
            pricePerDay: booking.priceBreakdown.pricePerDay,
            rentalDays: booking.priceBreakdown.rentalDays,
            baseAmount: booking.priceBreakdown.baseAmount,
            serviceFee: booking.priceBreakdown.serviceFee,
            securityDeposit: booking.priceBreakdown.securityDeposit,
            extensionAmount: booking.extensionAmount ?? 0,
            total: booking.priceBreakdown.total,
          }
        : {
            pricePerDay: 0,
            rentalDays: 0,
            baseAmount: booking.totalAmount,
            serviceFee: 0,
            securityDeposit: 0,
            extensionAmount: booking.extensionAmount ?? 0,
            total: booking.totalAmount,
          },
      lateFeeAmount: booking.lateFeeAmount ?? 0,
      paymentProvider: payment.provider,
      paymentStatus: payment.status,
      paymentMode: payment.mode,
    });
  } catch (error) {
    next(error);
  }
};

export const submitChecklist: RequestHandler = async (req, res, next) => {
    try {
        const bookingId = String(req.params.bookingId);
        const result = await bookingService.submitChecklist(req.auth!, bookingId, req.body);
        res.status(200).json(new ApiResponse(200, "Checklist saved. Ride safe!", result));
    } catch (error) {
        next(error);
    }
};

export const returnPreview: RequestHandler = async (req, res, next) => {
    try {
        const bookingId = String(req.params.bookingId);
        const result = await bookingService.returnPreview(req.auth!, bookingId);
        res.status(200).json(new ApiResponse(200, "Return preview", result));
    } catch (error) {
        next(error);
    }
};

export const extendBooking: RequestHandler = async (req, res, next) => {
    try {
        const bookingId = String(req.params.bookingId);
        const extraHours = Number(req.body.extraHours ?? 1);
        const result = await bookingService.extendBooking(req.auth!, bookingId, extraHours);
        res.status(200).json(new ApiResponse(200, "Rental extended", result));
    } catch (error) {
        next(error);
    }
};

export const returnBike: RequestHandler = async (req, res, next) => {
    try {
        const bookingId = String(req.params.bookingId);
        const result = await bookingService.returnBike(req.auth!, bookingId);
        res.status(200).json(new ApiResponse(200, result.onTime ? "Returned on time. Thank you!" : "Return recorded", result));
    } catch (error) {
        next(error);
    }
};

export const confirmCash: RequestHandler = async (req, res, next) => {
  try {
    const bookingId = String(req.params.bookingId);
    const result = await bookingService.selectCashAtPickup(
      req.auth!,
      bookingId,
    );
    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          "Cash at pickup selected; no money was charged",
          result,
        ),
      );
  } catch (error) {
    next(error);
  }
};

export const confirmCashReceived: RequestHandler = async (req, res, next) => {
  try {
    const bookingId = String(req.params.bookingId);
    const result = await bookingService.confirmCashReceived(
      req.auth!,
      bookingId,
    );
    res
      .status(200)
      .json(new ApiResponse(200, "Cash receipt recorded", result));
  } catch (error) {
    next(error);
  }
};

export const rescheduleBooking: RequestHandler = async (req, res, next) => {
  try {
    const bookingId = String(req.params.bookingId);
    const result = await bookingService.rescheduleBooking(
      req.auth!,
      bookingId,
      req.body.startDate,
    );
    res
      .status(200)
      .json(new ApiResponse(200, "Booking rescheduled", result));
  } catch (error) {
    next(error);
  }
};

export const cancellationPolicy: RequestHandler = async (req, res, next) => {
  try {
    const bookingId = String(req.params.bookingId);
    const booking = await bookingService.getBooking(req.auth!, bookingId);
    const result = bookingService.getCancellationPolicy(booking);
    res
      .status(200)
      .json(new ApiResponse(200, "Cancellation policy", result));
  } catch (error) {
    next(error);
  }
};
