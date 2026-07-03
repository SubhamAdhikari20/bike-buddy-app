// backend/src/routes/support.routes.ts
// Support tickets with photos (SUP-04/07), FAQ (SUP-05) and post-support
// rating (SUP-08). Breakdown tickets are flagged priority (SUP-02).
import { Router } from "express";
import { z } from "zod";
import { authenticate, authorize } from "../middlewares/auth.ts";
import validate from "../middlewares/validate.ts";
import ApiResponse from "../utils/ApiResponse.ts";
import AppError from "../errors/AppError.ts";
import SupportTicketModel from "../models/support-ticket.model.ts";

const createTicketSchema = z.object({
    type: z.enum(["breakdown", "complaint", "general"]).default("general"),
    subject: z.string().min(3).max(200),
    message: z.string().min(10).max(2000),
    photos: z.array(z.string().url()).max(3).default([]),
    bookingId: z.string().nullish(),
});

const rateTicketSchema = z.object({
    rating: z.number().int().min(1).max(5),
    comment: z.string().max(500).nullish(),
});

// Top questions answered before anyone needs to open a chat (SUP-05).
const FAQ = [
    { q: "How do I book a bike?", a: "Open a bike, tap Book Now, pick your dates and pay. It takes three taps once you know your dates." },
    { q: "What documents do I need?", a: "One government ID (citizenship, licence or passport). Upload it once from Profile > Verify your ID." },
    { q: "How do I pay?", a: "eSewa, Khalti, or cash at pickup. Every price is shown in full before you pay - no hidden fees." },
    { q: "Can I cancel a booking?", a: "Yes. Cancel from the booking page. Cancelling more than 12 hours before pickup refunds the full amount; after that a small fee applies." },
    { q: "What if the bike breaks down?", a: "Tap SOS on your ride screen or start a Breakdown chat. Support answers breakdown requests within 15 minutes, 24/7." },
    { q: "What if I return late?", a: "You get a 15-minute grace period. After that, an hourly late fee applies - the app always shows it before you confirm the return." },
    { q: "Is a helmet included?", a: "Each listing shows helmet availability under Specifications. Most verified owners include one." },
    { q: "What if I find damage before riding?", a: "Note it in the pre-ride checklist and photograph it. Those photos protect you from being blamed later." },
    { q: "How are owners verified?", a: "Verified owners submitted identity and ownership documents that our team checked. Look for the green badge." },
    { q: "How do I delete my account?", a: "Profile > Privacy & Account > Delete account. Your data, including your ID photo, is removed permanently." },
];

const supportRoutes = Router();

supportRoutes.get("/faq", (req, res) => {
    res.status(200).json(new ApiResponse(200, "FAQ", FAQ));
});

supportRoutes.use(authenticate);

supportRoutes.post("/tickets", validate(createTicketSchema), async (req, res, next) => {
    try {
        const ticket = await SupportTicketModel.create({
            userId: req.auth!.userId,
            bookingId: req.body.bookingId ?? null,
            type: req.body.type,
            subject: req.body.subject,
            message: req.body.message,
            photos: req.body.photos,
            status: "open",
        });

        const responseMinutes = req.body.type === "breakdown" ? 15 : 60;
        res.status(201).json(new ApiResponse(201, `Ticket created. Expect a reply within ${responseMinutes} minutes.`, {
            ticket,
            expectedResponseMinutes: responseMinutes,
        }));
    } catch (error) {
        next(error);
    }
});

supportRoutes.get("/tickets/mine", async (req, res, next) => {
    try {
        const tickets = await SupportTicketModel.find({ userId: req.auth!.userId }).sort({ createdAt: -1 });
        res.status(200).json(new ApiResponse(200, "Your tickets", tickets));
    } catch (error) {
        next(error);
    }
});

supportRoutes.get("/tickets", authorize("admin"), async (req, res, next) => {
    try {
        const filter: Record<string, unknown> = {};
        if (req.query.status) filter.status = req.query.status;
        const tickets = await SupportTicketModel.find(filter).sort({ createdAt: -1 }).limit(200);
        res.status(200).json(new ApiResponse(200, "All tickets", tickets));
    } catch (error) {
        next(error);
    }
});

supportRoutes.patch("/tickets/:ticketId/status", authorize("admin"), async (req, res, next) => {
    try {
        const status = req.body.status as "open" | "in_review" | "resolved";
        const ticket = await SupportTicketModel.findByIdAndUpdate(req.params.ticketId, { status }, { new: true });
        if (!ticket) {
            next(new AppError(404, "Ticket not found", "NOT_FOUND"));
            return;
        }
        res.status(200).json(new ApiResponse(200, `Ticket marked ${status.replace("_", " ")}`, ticket));
    } catch (error) {
        next(error);
    }
});

// Rate the support interaction after it is resolved (SUP-08).
supportRoutes.post("/tickets/:ticketId/rate", validate(rateTicketSchema), async (req, res, next) => {
    try {
        const ticket = await SupportTicketModel.findById(req.params.ticketId);
        if (!ticket) {
            next(new AppError(404, "Ticket not found", "NOT_FOUND"));
            return;
        }
        if (ticket.userId.toString() !== req.auth!.userId) {
            next(new AppError(403, "You can only rate your own tickets", "FORBIDDEN"));
            return;
        }

        ticket.rating = req.body.rating;
        ticket.ratingComment = req.body.comment ?? null;
        await ticket.save();
        res.status(200).json(new ApiResponse(200, "Thanks for the feedback!", ticket));
    } catch (error) {
        next(error);
    }
});

export default supportRoutes;
