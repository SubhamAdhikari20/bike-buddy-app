import { Router } from "express";
import { authenticate, authorize } from "../middlewares/auth.ts";
import validate from "../middlewares/validate.ts";
import {
  bookingListQuerySchema,
  cancelBookingSchema,
  checklistSchema,
  createBookingSchema,
  extendBookingSchema,
  quoteBookingSchema,
} from "../schemas/booking.schema.ts";
import {
  cancelBooking,
  completeBooking,
  confirmBooking,
  createBooking,
  downloadReceipt,
  extendBooking,
  getBikeAvailability,
  getBooking,
  listBookings,
  quoteBooking,
  returnBike,
  returnPreview,
  submitChecklist,
} from "../controllers/booking.controller.ts";

const bookingRoutes = Router();

// Quote and availability are public so guests can see live prices too.
bookingRoutes.post("/quote", validate(quoteBookingSchema), quoteBooking);
bookingRoutes.get("/availability/:bikeId", getBikeAvailability);

bookingRoutes.use(authenticate);
bookingRoutes.get("/", validate(bookingListQuerySchema, "query"), listBookings);
bookingRoutes.post("/", validate(createBookingSchema), createBooking);
bookingRoutes.get("/:bookingId", getBooking);
bookingRoutes.patch(
  "/:bookingId/confirm",
  authorize("owner", "admin"),
  confirmBooking,
);
bookingRoutes.patch(
  "/:bookingId/cancel",
  validate(cancelBookingSchema),
  cancelBooking,
);
bookingRoutes.patch(
  "/:bookingId/complete",
  authorize("owner", "admin"),
  completeBooking,
);
bookingRoutes.get("/:bookingId/receipt.pdf", downloadReceipt);
bookingRoutes.post(
  "/:bookingId/checklist",
  authorize("renter"),
  validate(checklistSchema),
  submitChecklist,
);
bookingRoutes.get(
  "/:bookingId/return-preview",
  authorize("renter"),
  returnPreview,
);
bookingRoutes.patch(
  "/:bookingId/extend",
  authorize("renter"),
  validate(extendBookingSchema),
  extendBooking,
);
bookingRoutes.post(
  "/:bookingId/return",
  authorize("renter"),
  returnBike,
);

export default bookingRoutes;
