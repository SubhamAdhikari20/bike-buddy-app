import type { RequestHandler } from "express";
import ApiResponse from "../utils/ApiResponse.ts";
import adminService from "../services/admin.service.ts";

export const dashboard: RequestHandler = async (req, res, next) => {
    try {
        const result = await adminService.getDashboardSummary();
        res.status(200).json(new ApiResponse(200, "Dashboard summary fetched successfully", result));
    } catch (error) {
        next(error);
    }
};

export const listUsers: RequestHandler = async (req, res, next) => {
    try {
        const result = await adminService.listUsers(req.query as Record<string, unknown>);
        res.status(200).json(new ApiResponse(200, "Users fetched successfully", result.items, result.pagination));
    } catch (error) {
        next(error);
    }
};

export const listBikes: RequestHandler = async (req, res, next) => {
    try {
        const result = await adminService.listBikes(req.query as Record<string, unknown>);
        res.status(200).json(new ApiResponse(200, "Bikes fetched successfully", result.items, result.pagination));
    } catch (error) {
        next(error);
    }
};

export const listBookings: RequestHandler = async (req, res, next) => {
    try {
        const result = await adminService.listBookings(req.query as Record<string, unknown>);
        res.status(200).json(new ApiResponse(200, "Bookings fetched successfully", result.items, result.pagination));
    } catch (error) {
        next(error);
    }
};

export const listReviews: RequestHandler = async (req, res, next) => {
    try {
        const result = await adminService.listReviews(req.query as Record<string, unknown>);
        res.status(200).json(new ApiResponse(200, "Reviews fetched successfully", result.items, result.pagination));
    } catch (error) {
        next(error);
    }
};

export const hideReview: RequestHandler = async (req, res, next) => {
    try {
        const reviewId = String(req.params.reviewId);
        const result = await adminService.hideReview(reviewId);
        res.status(200).json(new ApiResponse(200, "Review hidden successfully", result));
    } catch (error) {
        next(error);
    }
};

export const updateBikeStatus: RequestHandler = async (req, res, next) => {
    try {
        const bikeId = String(req.params.bikeId);
        const result = await adminService.updateBikeStatus(bikeId, req.body.status);
        res.status(200).json(new ApiResponse(200, "Bike status updated successfully", result));
    } catch (error) {
        next(error);
    }
};

export const updateBookingStatus: RequestHandler = async (req, res, next) => {
    try {
        const bookingId = String(req.params.bookingId);
        const result = await adminService.updateBookingStatus(bookingId, req.body.status);
        res.status(200).json(new ApiResponse(200, "Booking status updated successfully", result));
    } catch (error) {
        next(error);
    }
};

export const reviewKyc: RequestHandler = async (req, res, next) => {
    try {
        const renterId = String(req.params.renterId);
        const status = req.body.status as "approved" | "rejected";
        const result = await adminService.reviewKyc(renterId, status);
        res.status(200).json(new ApiResponse(200, `Renter KYC ${status}`, result));
    } catch (error) {
        next(error);
    }
};
