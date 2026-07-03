export default class ApiResponse<T> {
    success: boolean;
    message: string;
    data: T;
    statusCode: number;
    meta: Record<string, unknown> | undefined;

    constructor(statusCode: number, message: string, data: T, meta?: Record<string, unknown>) {
        this.success = true;
        this.statusCode = statusCode;
        this.message = message;
        this.data = data;
        this.meta = meta;
    }
}