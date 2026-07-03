import type { RequestHandler } from "express";
import ApiResponse from "../utils/ApiResponse.ts";
import reviewService from "../services/review.service.ts";

export const createReview: RequestHandler = async (req, res, next) => {
    try {
        const result = await reviewService.createReview(req.auth!, req.body);
        res.status(201).json(new ApiResponse(201, "Review created successfully", result));
    } catch (error) {
        next(error);
    }
};

export const updateReview: RequestHandler = async (req, res, next) => {
    try {
        const reviewId = String(req.params.reviewId);
        const result = await reviewService.updateReview(req.auth!, reviewId, req.body);
        res.status(200).json(new ApiResponse(200, "Review updated successfully", result));
    } catch (error) {
        next(error);
    }
};

export const deleteReview: RequestHandler = async (req, res, next) => {
    try {
        const reviewId = String(req.params.reviewId);
        const result = await reviewService.deleteReview(req.auth!, reviewId);
        res.status(200).json(new ApiResponse(200, "Review deleted successfully", result));
    } catch (error) {
        next(error);
    }
};

export const getReview: RequestHandler = async (req, res, next) => {
    try {
        const reviewId = String(req.params.reviewId);
        const result = await reviewService.getReview(reviewId);
        res.status(200).json(new ApiResponse(200, "Review fetched successfully", result));
    } catch (error) {
        next(error);
    }
};

export const listByBikeId: RequestHandler = async (req, res, next) => {
    try {
        const bikeId = String(req.params.bikeId);
        const result = await reviewService.listByBikeId(bikeId, req.query as Record<string, unknown>);
        res.status(200).json(new ApiResponse(200, "Reviews fetched successfully", result.items, result.pagination));
    } catch (error) {
        next(error);
    }
};
