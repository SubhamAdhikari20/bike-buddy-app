import AppError from "./AppError.ts";

export default class NotFoundError extends AppError {
    constructor(resourceName: string) {
        super(404, `${resourceName} not found`, "NOT_FOUND");
    }
}