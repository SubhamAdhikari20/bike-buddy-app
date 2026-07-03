import type { RequestHandler } from "express";

const notFound: RequestHandler = (req, res) => {
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.originalUrl}`,
        code: "ROUTE_NOT_FOUND",
    });
};

export default notFound;