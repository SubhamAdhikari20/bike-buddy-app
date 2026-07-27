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
      breakdown: booking.priceBreakdown ?? {
        pricePerDay: 0,
        rentalDays: 0,
        baseAmount: booking.totalAmount,
        serviceFee: 0,
        securityDeposit: 0,
        total: booking.totalAmount,
      },
      paymentProvider: payment.provider,
      paymentStatus: payment.status,
      paymentMode: payment.mode,
    });
  } catch (error) {
    next(error);
  }
};
