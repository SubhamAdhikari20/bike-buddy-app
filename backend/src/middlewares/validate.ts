import type { RequestHandler } from "express";
import type { ZodTypeAny } from "zod";

const validate = (schema: ZodTypeAny, source: "body" | "params" | "query" = "body"): RequestHandler => {
    return (req, res, next) => {
        const result = schema.safeParse(req[source]);

        if (!result.success) {
            res.status(400).json({
                success: false,
                message: "Validation failed",
                code: "VALIDATION_ERROR",
                errors: result.error.flatten(),
            });
            return;
        }

        req[source] = result.data;
        next();
    };
};

export default validate;