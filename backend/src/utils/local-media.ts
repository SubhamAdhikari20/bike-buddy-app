import fs from "node:fs/promises";
import path from "node:path";
import type { Express } from "express";
import { rootUploadDir, type UploadKind } from "../middlewares/upload.ts";

const imageSignatures = {
  jpeg: (bytes: Buffer) =>
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff,
  png: (bytes: Buffer) =>
    bytes.length >= 8 &&
    bytes
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  webp: (bytes: Buffer) =>
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP",
};

export const validateStoredImage = async (file: Express.Multer.File) => {
  const handle = await fs.open(file.path, "r");
  try {
    const bytes = Buffer.alloc(12);
    await handle.read(bytes, 0, bytes.length, 0);
    const valid =
      (file.mimetype === "image/jpeg" && imageSignatures.jpeg(bytes)) ||
      (file.mimetype === "image/png" && imageSignatures.png(bytes)) ||
      (file.mimetype === "image/webp" && imageSignatures.webp(bytes));
    if (!valid) {
      throw new Error("IMAGE_SIGNATURE_MISMATCH");
    }
  } finally {
    await handle.close();
  }
};

const uploadPathname = (value: string) => {
  try {
    return new URL(value).pathname;
  } catch {
    return value.split(/[?#]/, 1)[0] ?? value;
  }
};

export const localUploadPathFromUrl = (value?: string | null) => {
  if (!value) return null;
  let pathname: string;
  try {
    pathname = decodeURIComponent(uploadPathname(value)).replaceAll("\\", "/");
  } catch {
    return null;
  }
  const marker = pathname.includes("/api/v1/uploads/")
    ? "/api/v1/uploads/"
    : "/uploads/";
  const markerIndex = pathname.indexOf(marker);
  if (markerIndex < 0) return null;

  const relative = pathname.slice(markerIndex + marker.length);
  const [kind, ...segments] = relative.split("/").filter(Boolean);
  if (!kind || !["bike", "profile", "kyc", "evidence"].includes(kind)) {
    return null;
  }

  const target = path.resolve(rootUploadDir, kind, ...segments);
  const expectedRoot = `${path.resolve(rootUploadDir, kind)}${path.sep}`;
  if (!target.startsWith(expectedRoot)) return null;
  return target;
};

export const deleteLocalUpload = async (value?: string | null) => {
  const target = localUploadPathFromUrl(value);
  if (!target) return false;
  const relative = path
    .relative(rootUploadDir, target)
    .split(path.sep)
    .filter(Boolean);
  const filename = relative.at(-1) ?? "";
  if (relative.includes("demo") || filename.startsWith("demo-")) {
    // Versioned coursework fixtures are immutable. A profile update or demo
    // CRUD exercise must never remove assets required by the next seed run.
    return false;
  }
  try {
    await fs.unlink(target);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
};

export const cleanupUploadedFiles = async (
  files: Express.Multer.File | Express.Multer.File[] | undefined,
) => {
  const list = Array.isArray(files) ? files : files ? [files] : [];
  await Promise.all(
    list.map((file) => fs.unlink(file.path).catch(() => undefined)),
  );
};

export const uploadUrl = (kind: UploadKind, filename: string) =>
  kind === "kyc" || kind === "evidence"
    ? `/api/v1/uploads/${kind}/${filename}`
    : `/uploads/${kind}/${filename}`;
