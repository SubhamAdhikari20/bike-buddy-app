import type { RequestHandler } from "express";
import ApiResponse from "../utils/ApiResponse.ts";
import paymentService from "../services/payment.service.ts";

export const createPayment: RequestHandler = async (req, res, next) => {
    try {
        const result = await paymentService.createPayment(req.auth!, req.body);
        res.status(201).json(new ApiResponse(201, "Payment created successfully", result));
    } catch (error) {
        next(error);
    }
};

export const getPayment: RequestHandler = async (req, res, next) => {
    try {
        const paymentId = String(req.params.paymentId);
        const result = await paymentService.getPayment(req.auth!, paymentId);
        res.status(200).json(new ApiResponse(200, "Payment fetched successfully", result));
    } catch (error) {
        next(error);
    }
};

export const updatePaymentStatus: RequestHandler = async (req, res, next) => {
    try {
        const paymentId = String(req.params.paymentId);
        const result = await paymentService.updatePaymentStatus(req.auth!, paymentId, req.body);
        res.status(200).json(new ApiResponse(200, "Payment updated successfully", result));
    } catch (error) {
        next(error);
    }
};
