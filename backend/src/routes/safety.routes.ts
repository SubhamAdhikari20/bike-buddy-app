// backend/src/routes/safety.routes.ts
// Damage reports (BC-04) and the SOS emergency alert (SUP-01).
import { Router } from "express";
import { z } from "zod";
import { authenticate, authorize } from "../middlewares/auth.ts";
import validate from "../middlewares/validate.ts";
import ApiResponse from "../utils/ApiResponse.ts";
import AppError from "../errors/AppError.ts";
import DamageReportModel from "../models/damage-report.model.ts";
import SosAlertModel from "../models/sos-alert.model.ts";
import BookingModel from "../models/booking.model.ts";

const damageReportSchema = z.object({
    bookingId: z.string().min(1),
    photos: z.array(z.string().url()).min(1, "Attach at least one photo").max(5),
    description: z.string().min(10, "Describe what happened in a few words").max(2000),
});

const sosSchema = z.object({
    bookingId: z.string().nullish(),
    latitude: z.number().min(-90).max(90).nullish(),
    longitude: z.number().min(-180).max(180).nullish(),
    note: z.string().max(500).nullish(),
});

const safetyRoutes = Router();

safetyRoutes.use(authenticate);

// Post-return damage report with photos (BC-04).
safetyRoutes.post("/damage-reports", validate(damageReportSchema), async (req, res, next) => {
    try {
        const booking = await BookingModel.findById(req.body.bookingId);
        if (!booking) {
            next(new AppError(404, "Booking not found", "NOT_FOUND"));
            return;
        }

        const report = await DamageReportModel.create({
            bookingId: booking._id.toString(),
            bikeId: booking.bikeId.toString(),
            reportedBy: req.auth!.userId,
            photos: req.body.photos,
            description: req.body.description,
            status: "open",
        });

        res.status(201).json(new ApiResponse(201, "Report submitted. We will acknowledge it within 24 hours.", report));
    } catch (error) {
        next(error);
    }
});

safetyRoutes.get("/damage-reports/mine", async (req, res, next) => {
    try {
        const reports = await DamageReportModel.find({ reportedBy: req.auth!.userId }).sort({ createdAt: -1 });
        res.status(200).json(new ApiResponse(200, "Your damage reports", reports));
    } catch (error) {
        next(error);
    }
});

safetyRoutes.patch("/damage-reports/:reportId/status", authorize("admin", "owner"), async (req, res, next) => {
    try {
        const status = req.body.status as "open" | "reviewed" | "resolved";
        const report = await DamageReportModel.findByIdAndUpdate(
            req.params.reportId,
            { status, resolvedAt: status === "resolved" ? new Date() : null },
            { new: true },
        );
        if (!report) {
            next(new AppError(404, "Report not found", "NOT_FOUND"));
            return;
        }
        res.status(200).json(new ApiResponse(200, `Report marked ${status}`, report));
    } catch (error) {
        next(error);
    }
});

// One-tap SOS: records the rider's location and alerts support (SUP-01).
safetyRoutes.post("/sos", validate(sosSchema), async (req, res, next) => {
    try {
        const alert = await SosAlertModel.create({
            userId: req.auth!.userId,
            bookingId: req.body.bookingId ?? null,
            latitude: req.body.latitude ?? null,
            longitude: req.body.longitude ?? null,
            note: req.body.note ?? null,
            status: "open",
        });

        res.status(201).json(new ApiResponse(201, "Help is on the way. Our team can now see your location.", {
            alertId: alert._id,
            supportPhone: "+977-9800000000",
        }));
    } catch (error) {
        next(error);
    }
});

safetyRoutes.get("/sos", authorize("admin"), async (req, res, next) => {
    try {
        const alerts = await SosAlertModel.find().sort({ createdAt: -1 }).limit(100);
        res.status(200).json(new ApiResponse(200, "SOS alerts", alerts));
    } catch (error) {
        next(error);
    }
});

export default safetyRoutes;
