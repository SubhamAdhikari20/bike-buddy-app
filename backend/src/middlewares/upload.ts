// backend/src/middlewares/upload.ts
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import AppError from "../errors/AppError.ts";

const rootUploadDir = path.join(process.cwd(), "uploads");

// Files are organised by what they are for, so the folder on disk (and in
// the served URL) tells you at a glance whether something is a bike photo, a
// profile picture or a KYC document. ?type=<key> on the upload request picks
// the folder; an unrecognised or missing type falls back to the original
// flat layout so existing callers keep working unchanged.
const uploadKinds = ["bike", "profile", "kyc"] as const;
type UploadKind = (typeof uploadKinds)[number];

const resolveUploadDir = (kind: string | undefined): string => {
  const dir =
    kind && uploadKinds.includes(kind as UploadKind)
      ? path.join(rootUploadDir, kind)
      : rootUploadDir;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

export const resolveUploadUrlPath = (filePath: string): string =>
  path.relative(rootUploadDir, filePath).split(path.sep).join("/");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const kind =
      typeof req.query.type === "string" ? req.query.type : undefined;
    cb(null, resolveUploadDir(kind));
  },
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
