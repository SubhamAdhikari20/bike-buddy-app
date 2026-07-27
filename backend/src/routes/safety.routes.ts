import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { authenticate, authorize } from "../middlewares/auth.ts";
import validate from "../middlewares/validate.ts";
import ApiResponse from "../utils/ApiResponse.ts";
import AppError from "../errors/AppError.ts";
import DamageReportModel from "../models/damage-report.model.ts";
import SosAlertModel from "../models/sos-alert.model.ts";
import BookingModel from "../models/booking.model.ts";
import {
  referencesDocument,
  toDocumentId,
} from "../utils/mongo-reference.ts";

const objectIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "A valid booking ID is required");

export const damageReportSchema = z
  .object({
    bookingId: objectIdSchema,
    photos: z
      .array(z.string().url())
      .min(1, "Attach at least one photo")
      .max(5),
    description: z
      .string()
      .trim()
      .min(10, "Describe what happened in a few words")
      .max(2000),
  })
  .strict();

export const damageStatusSchema = z
  .object({
    status: z.enum(["reviewed", "resolved"]),
  })
  .strict();

export const sosSchema = z
  .object({
    bookingId: objectIdSchema.nullish(),
    latitude: z.number().min(-90).max(90).nullish(),
    longitude: z.number().min(-180).max(180).nullish(),
    note: z.string().trim().max(500).nullish(),
  })
  .strict()
  .superRefine((value, context) => {
    const hasLatitude = value.latitude != null;
    const hasLongitude = value.longitude != null;
    if (hasLatitude !== hasLongitude) {
      context.addIssue({
        code: "custom",
        path: ["latitude"],
        message: "Latitude and longitude must be provided together",
      });
    }
  });

export const sosStatusSchema = z
  .object({
    status: z.enum(["responding", "closed"]),
  })
  .strict();

const sosLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message:
      "Several alerts were already recorded. Call emergency services if you are in immediate danger.",
  },
});

const safetyRoutes = Router();
safetyRoutes.use(authenticate);

safetyRoutes.post(
  "/damage-reports",
  authorize("renter"),
  validate(damageReportSchema),
  async (req, res, next) => {
    try {
      const booking = await BookingModel.findById(req.body.bookingId).select(
        "bikeId renterId status returnedAt",
      );
      if (!booking) {
        throw new AppError(404, "Booking not found", "NOT_FOUND");
      }
      if (!referencesDocument(booking.renterId, req.auth!.profileId)) {
        throw new AppError(
          403,
          "You can report damage only for your own booking",
          "FORBIDDEN",
        );
      }
      if (booking.status !== "completed" || !booking.returnedAt) {
        throw new AppError(
          409,
          "Damage reports are available after the bike return is recorded",
          "RETURN_REQUIRED",
        );
      }

      const bikeId = toDocumentId(booking.bikeId);
      if (!bikeId) {
        throw new AppError(409, "Booking has no bike reference", "CONFLICT");
      }

      const report = await DamageReportModel.create({
        bookingId: booking._id.toString(),
        bikeId,
        reportedBy: req.auth!.userId,
        photos: req.body.photos,
        description: req.body.description,
        status: "open",
      });

      res
        .status(201)
        .json(
          new ApiResponse(
            201,
            "Damage report submitted for review",
            report,
          ),
        );
    } catch (error) {
      next(error);
    }
  },
);

safetyRoutes.get("/damage-reports/mine", async (req, res, next) => {
  try {
    const reports = await DamageReportModel.find({
      reportedBy: req.auth!.userId,
    })
      .sort({ createdAt: -1 })
      .limit(100);
    res
      .status(200)
      .json(new ApiResponse(200, "Your damage reports", reports));
  } catch (error) {
    next(error);
  }
});

safetyRoutes.get(
  "/damage-reports",
  authorize("admin", "owner"),
  async (req, res, next) => {
    try {
      let filter: Record<string, unknown> = {};
      if (req.auth!.role === "owner") {
        if (!req.auth!.profileId) {
          throw new AppError(403, "Owner profile is missing", "FORBIDDEN");
        }
        const ownerBookingIds = await BookingModel.distinct("_id", {
          ownerId: req.auth!.profileId,
        });
        filter = { bookingId: { $in: ownerBookingIds } };
      }
      const reports = await DamageReportModel.find(filter)
        .sort({ createdAt: -1 })
        .limit(100);
      res
        .status(200)
        .json(new ApiResponse(200, "Damage reports", reports));
    } catch (error) {
      next(error);
    }
  },
);

safetyRoutes.patch(
  "/damage-reports/:reportId/status",
  authorize("admin", "owner"),
  validate(damageStatusSchema),
  async (req, res, next) => {
    try {
      const report = await DamageReportModel.findById(req.params.reportId);
      if (!report) {
        throw new AppError(404, "Report not found", "NOT_FOUND");
      }
      if (report.status === "resolved") {
        throw new AppError(
          409,
          "A resolved damage report cannot be reopened",
          "CONFLICT",
        );
      }

      if (req.auth!.role === "owner") {
        const booking = await BookingModel.findById(report.bookingId).select(
          "ownerId",
        );
        if (
          !booking ||
          !referencesDocument(booking.ownerId, req.auth!.profileId)
        ) {
          throw new AppError(
            403,
            "You cannot update another owner's damage report",
            "FORBIDDEN",
          );
        }
        if (req.body.status !== "reviewed" || report.status !== "open") {
          throw new AppError(
            403,
            "Owners can acknowledge open reports; administrators resolve disputes",
            "FORBIDDEN",
          );
        }
      }

      report.status = req.body.status;
      report.resolvedAt =
        req.body.status === "resolved" ? new Date() : null;
      await report.save();
      res
        .status(200)
        .json(
          new ApiResponse(
            200,
            `Report marked ${report.status}`,
            report,
          ),
        );
    } catch (error) {
      next(error);
    }
  },
);

safetyRoutes.post(
  "/sos",
  authorize("renter"),
  sosLimiter,
  validate(sosSchema),
  async (req, res, next) => {
    try {
      if (req.body.bookingId) {
        const booking = await BookingModel.findById(req.body.bookingId).select(
          "renterId status",
        );
        if (!booking) {
          throw new AppError(404, "Booking not found", "NOT_FOUND");
        }
        if (
          !referencesDocument(booking.renterId, req.auth!.profileId) ||
          booking.status !== "confirmed"
        ) {
          throw new AppError(
            403,
            "SOS alerts must belong to your active booking",
            "FORBIDDEN",
          );
        }
      }

      const alert = await SosAlertModel.create({
        userId: req.auth!.userId,
        bookingId: req.body.bookingId ?? null,
        latitude: req.body.latitude ?? null,
        longitude: req.body.longitude ?? null,
        note: req.body.note ?? null,
        status: "open",
      });

      res.status(201).json(
        new ApiResponse(
          201,
          "Alert recorded for the Bike Buddy support queue",
          {
            alertId: alert._id,
            locationShared:
              alert.latitude != null && alert.longitude != null,
            nextStep:
              "Call local emergency services now if you are in immediate danger.",
          },
        ),
      );
    } catch (error) {
      next(error);
    }
  },
);

safetyRoutes.get("/sos", authorize("admin"), async (_req, res, next) => {
  try {
    const alerts = await SosAlertModel.find()
      .sort({ createdAt: -1 })
      .limit(100);
    res.status(200).json(new ApiResponse(200, "SOS alerts", alerts));
  } catch (error) {
    next(error);
  }
});

safetyRoutes.patch(
  "/sos/:alertId/status",
  authorize("admin"),
  validate(sosStatusSchema),
  async (req, res, next) => {
    try {
      const alert = await SosAlertModel.findById(req.params.alertId);
      if (!alert) {
        throw new AppError(404, "SOS alert not found", "NOT_FOUND");
      }
      if (alert.status === "closed") {
        throw new AppError(
          409,
          "A closed SOS alert cannot be reopened",
          "CONFLICT",
        );
      }
      if (alert.status === "responding" && req.body.status !== "closed") {
        throw new AppError(
          409,
          "A responding alert can only be closed",
          "CONFLICT",
        );
      }
      alert.status = req.body.status;
      await alert.save();
      res
        .status(200)
        .json(new ApiResponse(200, `Alert marked ${alert.status}`, alert));
    } catch (error) {
      next(error);
    }
  },
);

export default safetyRoutes;
