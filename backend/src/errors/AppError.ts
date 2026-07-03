export default class AppError extends Error {
    statusCode: number;
    code: string;
    details?: unknown;
    isOperational: boolean;

    constructor(statusCode: number, message: string, code = "APP_ERROR", details?: unknown) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}