// backend/src/middlewares/upload.ts
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import AppError from "../errors/AppError.ts";

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
        cb(null, name);
    },
});

const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];

export const uploadImage = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (!allowedMimeTypes.includes(file.mimetype)) {
            cb(new AppError(400, "Only JPG, PNG and WEBP images are allowed", "BAD_REQUEST"));
            return;
        }
        cb(null, true);
    },
});
