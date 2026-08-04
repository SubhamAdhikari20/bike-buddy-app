import path from "node:path";
import { Router, type RequestHandler } from "express";
import { authenticate, authorize } from "../middlewares/auth.ts";
import {
  resolveUploadDir,
  uploadImage,
  type UploadKind,
} from "../middlewares/upload.ts";
import ApiResponse from "../utils/ApiResponse.ts";
import AppError from "../errors/AppError.ts";
import { BACKEND_URL } from "../config/index.ts";
import {
  cleanupUploadedFiles,
  uploadUrl,
  validateStoredImage,
} from "../utils/local-media.ts";
import { renterRepository } from "../repositories/renter.repository.ts";
import SupportTicketModel from "../models/support-ticket.model.ts";
import DamageReportModel from "../models/damage-report.model.ts";
import BookingModel from "../models/booking.model.ts";

const uploadRoutes = Router();

const validFilename =
  /^\d{10,}-(?:[a-f\d]{12}|[a-f\d]{8}-[a-f\d]{4}-[1-5][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12})\.(?:jpg|png|webp)$/i;

const evidenceUrlPattern = (filename: string) =>
  new RegExp(
    `/evidence/${filename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|[?#])`,
  );

const canReadEvidence = async (
  auth: NonNullable<Express.Request["auth"]>,
  filename: string,
) => {
  if (auth.role === "admin") return true;

  const urlPattern = evidenceUrlPattern(filename);
  const [ownTicket, participatingBooking] = await Promise.all([
    SupportTicketModel.exists({
      userId: auth.userId,
      photos: urlPattern,
    }),
    auth.profileId
      ? BookingModel.exists({
          "preRideChecklist.photos": urlPattern,
          $or: [{ renterId: auth.profileId }, { ownerId: auth.profileId }],
        })
      : null,
  ]);
  if (ownTicket || participatingBooking) return true;

  const damage = await DamageReportModel.findOne({ photos: urlPattern })
    .select("bookingId reportedBy")
    .lean()
    .exec();
  if (!damage) return false;
  if (damage.reportedBy.toString() === auth.userId) return true;
  if (!auth.profileId) return false;

  return Boolean(
    await BookingModel.exists({
      _id: damage.bookingId,
      $or: [{ renterId: auth.profileId }, { ownerId: auth.profileId }],
    }),
  );
};

const finishUpload =
  (kind: UploadKind, multiple = false): RequestHandler =>
  async (req, res, next) => {
    const files = multiple
      ? ((req.files as Express.Multer.File[] | undefined) ?? [])
      : req.file
        ? [req.file]
        : [];

    if (files.length === 0) {
      next(
        new AppError(
          400,
          `No file uploaded. Attach image${multiple ? "s" : ""} in the '${multiple ? "files" : "file"}' field.`,
          "BAD_REQUEST",
        ),
      );
      return;
    }

    try {
      await Promise.all(files.map(validateStoredImage));
      const uploaded = files.map((file) => ({
        url: uploadUrl(BACKEND_URL, kind, file.filename),
        filename: file.filename,
        originalName: file.originalname,
      }));
      res
        .status(201)
        .json(
          new ApiResponse(
            201,
            `${uploaded.length} image${uploaded.length === 1 ? "" : "s"} uploaded successfully`,
            multiple ? { files: uploaded } : uploaded[0],
          ),
        );
    } catch {
      await cleanupUploadedFiles(files);
      next(
        new AppError(
          400,
          "The uploaded file content does not match a supported image type",
          "BAD_REQUEST",
        ),
      );
    }
  };

uploadRoutes.use(authenticate);

uploadRoutes.post(
  "/bike",
  authorize("owner", "admin"),
  uploadImage("bike").array("files", 6),
  finishUpload("bike", true),
);
uploadRoutes.post(
  "/profile",
  uploadImage("profile").single("file"),
  finishUpload("profile"),
);
uploadRoutes.post(
  "/kyc",
  authorize("renter"),
  uploadImage("kyc").single("file"),
  finishUpload("kyc"),
);
uploadRoutes.post(
  "/evidence",
  authorize("renter", "owner", "admin"),
  uploadImage("evidence").array("files", 5),
  finishUpload("evidence", true),
);

uploadRoutes.get(
  "/kyc/:filename",
  authorize("renter", "admin"),
  async (req, res, next) => {
    try {
      const filename = String(req.params.filename);
      if (!validFilename.test(filename)) {
        throw new AppError(404, "Verification image not found", "NOT_FOUND");
      }

      if (req.auth!.role === "renter") {
        const renter = await renterRepository.findByBaseUserId(
          req.auth!.userId,
        );
        const ownedFilename = renter?.idDocumentUrl
          ? path.basename(new URL(renter.idDocumentUrl, BACKEND_URL).pathname)
          : null;
        if (ownedFilename !== filename) {
          throw new AppError(
            403,
            "You cannot view another renter's verification image",
            "FORBIDDEN",
          );
        }
      }

      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.sendFile(filename, { root: resolveUploadDir("kyc") }, (error) => {
        if (error)
          next(new AppError(404, "Verification image not found", "NOT_FOUND"));
      });
    } catch (error) {
      next(error);
    }
  },
);

uploadRoutes.get(
  "/evidence/:filename",
  authorize("renter", "owner", "admin"),
  async (req, res, next) => {
    try {
      const filename = String(req.params.filename);
      if (!validFilename.test(filename)) {
        throw new AppError(404, "Evidence image not found", "NOT_FOUND");
      }
      if (!(await canReadEvidence(req.auth!, filename))) {
        throw new AppError(
          403,
          "You cannot view this evidence image",
          "FORBIDDEN",
        );
      }

      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.sendFile(
        filename,
        { root: resolveUploadDir("evidence") },
        (error) => {
          if (error) {
            next(new AppError(404, "Evidence image not found", "NOT_FOUND"));
          }
        },
      );
    } catch (error) {
      next(error);
    }
  },
);

export default uploadRoutes;
