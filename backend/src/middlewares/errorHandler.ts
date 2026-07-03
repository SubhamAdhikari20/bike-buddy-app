import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import AppError from "../errors/AppError.ts";

const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
    if (res.headersSent) {
        next(error);
        return;
    }

    if (error instanceof ZodError) {
        res.status(400).json({
            success: false,
            message: "Validation failed",
            code: "VALIDATION_ERROR",
            errors: error.flatten(),
        });
        return;
    }

    if (error instanceof AppError) {
        res.status(error.statusCode).json({
            success: false,
            message: error.message,
            code: error.code,
            details: error.details,
        });
        return;
    }

    res.status(500).json({
        success: false,
        message: "Internal server error",
        code: "INTERNAL_SERVER_ERROR",
    });
};

export default errorHandler;