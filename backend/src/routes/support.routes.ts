import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { authenticate, authorize } from "../middlewares/auth.ts";
import validate from "../middlewares/validate.ts";
import ApiResponse from "../utils/ApiResponse.ts";
import AppError from "../errors/AppError.ts";
import SupportTicketModel from "../models/support-ticket.model.ts";
import BookingModel from "../models/booking.model.ts";
import { referencesDocument } from "../utils/mongo-reference.ts";
import notificationEvents from "../services/notification-events.service.ts";

const objectIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "A valid booking ID is required");

export const createTicketSchema = z
  .object({
    type: z.enum(["breakdown", "complaint", "general"]).default("general"),
    subject: z.string().trim().min(3).max(200),
    message: z.string().trim().min(10).max(2000),
    photos: z.array(z.string().url()).max(3).default([]),
    bookingId: objectIdSchema.nullish(),
  })
  .strict();

export const rateTicketSchema = z
  .object({
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().max(500).nullish(),
  })
  .strict();

export const ticketListQuerySchema = z
  .object({
    status: z.enum(["open", "in_review", "resolved"]).optional(),
    type: z.enum(["breakdown", "complaint", "general"]).optional(),
    limit: z.coerce.number().int().min(1).max(200).default(100),
  })
  .strict();

export const ticketStatusSchema = z
  .object({
    status: z.enum(["in_review", "resolved"]),
  })
  .strict();

export const FAQ = [
  {
    q: "How do I book a bike?",
    a: "Open a bike, choose your dates, review every price line, and select a payment option.",
  },
  {
    q: "What documents do I need?",
    a: "The renter verification screen accepts a government-issued ID image. Submit it only through the protected profile flow.",
  },
  {
    q: "How do I pay?",
    a: "Wallet checkout is a clearly labelled coursework simulation and never charges money. Cash at pickup is recorded as paid only after the owner confirms receipt.",
  },
  {
    q: "Can I cancel a booking?",
    a: "Upcoming bookings can be cancelled from My Bookings. The app shows the 12-hour coursework refund policy before confirmation; live refunds are disabled until a verified workflow exists.",
  },
  {
    q: "What if the bike breaks down?",
    a: "Record an SOS alert or create a priority breakdown ticket. If you are in immediate danger, contact the appropriate local emergency service.",
  },
  {
    q: "What if I return late?",
    a: "There is a 15-minute grace period. The return screen shows any estimated late fee before you confirm, and the coursework build does not charge it automatically.",
  },
  {
    q: "Is a helmet included?",
    a: "Check Helmet under each bike's Specifications before booking.",
  },
  {
    q: "What if I find damage before riding?",
    a: "Note it in the pre-ride checklist and attach a condition photo before starting the ride.",
  },
  {
    q: "How are owners verified?",
    a: "The green badge means an administrator marked that owner as verified in Bike Buddy.",
  },
  {
    q: "How do I delete my account?",
    a: "Open Profile, then Privacy & Account. Review the deletion warning carefully before confirming.",
  },
];

const ticketLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many support tickets were created. Try again later.",
  },
});

const supportRoutes = Router();

supportRoutes.get("/faq", (_req, res) => {
  res.status(200).json(new ApiResponse(200, "FAQ", FAQ));
});

supportRoutes.use(authenticate);

supportRoutes.post(
  "/tickets",
  ticketLimiter,
  validate(createTicketSchema),
  async (req, res, next) => {
    try {
      if (req.body.bookingId) {
        const booking = await BookingModel.findById(req.body.bookingId).select(
          "renterId ownerId",
        );
        if (!booking) {
          throw new AppError(404, "Booking not found", "NOT_FOUND");
        }
        const hasAccess =
          req.auth!.role === "admin" ||
          (req.auth!.role === "renter" &&
            referencesDocument(booking.renterId, req.auth!.profileId)) ||
          (req.auth!.role === "owner" &&
            referencesDocument(booking.ownerId, req.auth!.profileId));
        if (!hasAccess) {
          throw new AppError(
            403,
            "You cannot attach another user's booking",
            "FORBIDDEN",
          );
        }
      }

      const priority = req.body.type === "breakdown" ? "high" : "normal";
      const ticket = await SupportTicketModel.create({
        userId: req.auth!.userId,
        bookingId: req.body.bookingId ?? null,
        type: req.body.type,
        priority,
        subject: req.body.subject,
        message: req.body.message,
        photos: req.body.photos,
        status: "open",
      });
      await notificationEvents.supportCreated(ticket);

      res.status(201).json(
        new ApiResponse(201, "Support ticket created", {
          ticket,
          priority,
          notice:
            "The ticket is queued for review. No response time is guaranteed.",
        }),
      );
    } catch (error) {
      next(error);
    }
  },
);

supportRoutes.get("/tickets/mine", async (req, res, next) => {
  try {
    const tickets = await SupportTicketModel.find({
      userId: req.auth!.userId,
    })
      .sort({ createdAt: -1 })
      .limit(100);
    res.status(200).json(new ApiResponse(200, "Your support tickets", tickets));
  } catch (error) {
    next(error);
  }
});

supportRoutes.get(
  "/tickets",
  authorize("admin"),
  validate(ticketListQuerySchema, "query"),
  async (req, res, next) => {
    try {
      const filter: Record<string, unknown> = {};
      if (req.query.status) filter.status = req.query.status;
      if (req.query.type) filter.type = req.query.type;
      const tickets = await SupportTicketModel.find(filter)
        .sort({ priority: 1, createdAt: -1 })
        .limit(Number(req.query.limit));
      res.status(200).json(new ApiResponse(200, "Support tickets", tickets));
    } catch (error) {
      next(error);
    }
  },
);

supportRoutes.patch(
  "/tickets/:ticketId/status",
  authorize("admin"),
  validate(ticketStatusSchema),
  async (req, res, next) => {
    try {
      const ticket = await SupportTicketModel.findById(req.params.ticketId);
      if (!ticket) {
        throw new AppError(404, "Ticket not found", "NOT_FOUND");
      }
      if (ticket.status === "resolved") {
        throw new AppError(
          409,
          "A resolved ticket cannot be reopened",
          "CONFLICT",
        );
      }
      if (ticket.status === "in_review" && req.body.status !== "resolved") {
        throw new AppError(
          409,
          "A ticket in review can only be resolved",
          "CONFLICT",
        );
      }

      ticket.status = req.body.status;
      ticket.resolvedAt = req.body.status === "resolved" ? new Date() : null;
      await ticket.save();
      await notificationEvents.supportUpdated(ticket);
      res
        .status(200)
        .json(
          new ApiResponse(
            200,
            `Ticket marked ${ticket.status.replace("_", " ")}`,
            ticket,
          ),
        );
    } catch (error) {
      next(error);
    }
  },
);

supportRoutes.post(
  "/tickets/:ticketId/rate",
  validate(rateTicketSchema),
  async (req, res, next) => {
    try {
      const ticket = await SupportTicketModel.findById(req.params.ticketId);
      if (!ticket) {
        throw new AppError(404, "Ticket not found", "NOT_FOUND");
      }
      if (!referencesDocument(ticket.userId, req.auth!.userId)) {
        throw new AppError(
          403,
          "You can rate only your own ticket",
          "FORBIDDEN",
        );
      }
      if (ticket.status !== "resolved") {
        throw new AppError(
          409,
          "Support can be rated after the ticket is resolved",
          "CONFLICT",
        );
      }
      if (ticket.rating != null) {
        throw new AppError(
          409,
          "This support interaction was already rated",
          "CONFLICT",
        );
      }

      ticket.rating = req.body.rating;
      ticket.ratingComment = req.body.comment ?? null;
      await ticket.save();
      res
        .status(200)
        .json(new ApiResponse(200, "Support feedback saved", ticket));
    } catch (error) {
      next(error);
    }
  },
);

export default supportRoutes;
