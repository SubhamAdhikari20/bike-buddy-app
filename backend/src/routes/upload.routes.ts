// backend/src/routes/upload.routes.ts
import { Router } from "express";
import { authenticate } from "../middlewares/auth.ts";
import { uploadImage } from "../middlewares/upload.ts";
import ApiResponse from "../utils/ApiResponse.ts";
import AppError from "../errors/AppError.ts";
import { BACKEND_URL } from "../config/index.ts";

const uploadRoutes = Router();

uploadRoutes.post("/", authenticate, uploadImage.single("file"), (req, res, next) => {
    if (!req.file) {
        next(new AppError(400, "No file uploaded. Attach an image in the 'file' field.", "BAD_REQUEST"));
        return;
    }

    const url = `${BACKEND_URL}/uploads/${req.file.filename}`;
    res.status(201).json(new ApiResponse(201, "File uploaded successfully", { url, filename: req.file.filename }));
});

export default uploadRoutes;
