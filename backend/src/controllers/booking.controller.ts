import type { RequestHandler } from "express";
import ApiResponse from "../utils/ApiResponse.ts";
import bookingService from "../services/booking.service.ts";

export const createBooking: RequestHandler = async (req, res, next) => {
    try {
        const result = await bookingService.createBooking(req.auth!, req.body);
        res.status(201).json(new ApiResponse(201, "Booking created successfully", result));
    } catch (error) {
        next(error);
    }
};

export const getBooking: RequestHandler = async (req, res, next) => {
    try {
        const bookingId = String(req.params.bookingId);
        const result = await bookingService.getBooking(req.auth!, bookingId);
        res.status(200).json(new ApiResponse(200, "Booking fetched successfully", result));
    } catch (error) {
        next(error);
    }
};

export const listBookings: RequestHandler = async (req, res, next) => {
    try {
        const result = await bookingService.listBookings(req.auth!, req.query as Record<string, unknown>);
        res.status(200).json(new ApiResponse(200, "Bookings fetched successfully", result.items, result.pagination));
    } catch (error) {
        next(error);
    }
};

export const confirmBooking: RequestHandler = async (req, res, next) => {
    try {
        const bookingId = String(req.params.bookingId);
        const result = await bookingService.confirmBooking(req.auth!, bookingId);
        res.status(200).json(new ApiResponse(200, "Booking confirmed successfully", result));
    } catch (error) {
        next(error);
    }
};

export const cancelBooking: RequestHandler = async (req, res, next) => {
    try {
        const bookingId = String(req.params.bookingId);
        const result = await bookingService.cancelBooking(req.auth!, bookingId, req.body.reason);
        res.status(200).json(new ApiResponse(200, "Booking cancelled successfully", result));
    } catch (error) {
        next(error);
    }
};

export const completeBooking: RequestHandler = async (req, res, next) => {
    try {
        const bookingId = String(req.params.bookingId);
        const result = await bookingService.completeBooking(req.auth!, bookingId);
        res.status(200).json(new ApiResponse(200, "Booking completed successfully", result));
    } catch (error) {
        next(error);
    }
};
