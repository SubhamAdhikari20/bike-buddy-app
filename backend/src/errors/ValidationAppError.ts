import AppError from "./AppError.ts";

export default class ValidationAppError extends AppError {
    constructor(message: string, details?: unknown) {
        super(400, message, "VALIDATION_ERROR", details);
    }
}