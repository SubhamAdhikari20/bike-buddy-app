// backend/src/middlewares/upload.ts
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import AppError from "../errors/AppError.ts";

export const rootUploadDir = path.resolve(process.cwd(), "uploads");

// Files are organised by purpose. Routes bind the purpose server-side so a
// caller cannot redirect sensitive uploads into a public folder.
export const uploadKinds = ["bike", "profile", "kyc", "evidence"] as const;
export type UploadKind = (typeof uploadKinds)[number];

export const resolveUploadDir = (kind: UploadKind): string => {
  const dir = path.join(rootUploadDir, kind);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

export const resolveUploadUrlPath = (filePath: string): string =>
  path.relative(rootUploadDir, filePath).split(path.sep).join("/");

const createStorage = (kind: UploadKind) =>
  multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, resolveUploadDir(kind)),
    filename: (_req, file, cb) => {
      const extByMime: Record<string, string> = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
      };
      const ext = extByMime[file.mimetype] ?? "";
      const name = `${Date.now()}-${crypto.randomUUID()}${ext}`;
      cb(null, name);
    },
  });

const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];

export const uploadImage = (kind: UploadKind) =>
  multer({
    storage: createStorage(kind),
    limits: { fileSize: 5 * 1024 * 1024, files: kind === "bike" ? 6 : 5 },
    fileFilter: (_req, file, cb) => {
      if (!allowedMimeTypes.includes(file.mimetype)) {
        cb(
          new AppError(
            400,
            "Only JPG, PNG and WEBP images are allowed",
            "BAD_REQUEST",
          ),
        );
        return;
      }
      cb(null, true);
    },
  });
