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

  if (error && typeof error === "object" && "name" in error) {
    if (error.name === "CastError") {
      res.status(400).json({
        success: false,
        message: "The supplied identifier is invalid",
        code: "INVALID_IDENTIFIER",
      });
      return;
    }

    if (error.name === "ValidationError") {
      res.status(400).json({
        success: false,
        message: "The submitted data is invalid",
        code: "DATABASE_VALIDATION_ERROR",
      });
      return;
    }
  }

  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === 11000
  ) {
    res.status(409).json({
      success: false,
      message: "A record with those details already exists",
      code: "DUPLICATE_RECORD",
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
