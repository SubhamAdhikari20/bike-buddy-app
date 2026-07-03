import { Router } from "express";
import { authenticate, authorize } from "../middlewares/auth.ts";
import validate from "../middlewares/validate.ts";
import { bookingListQuerySchema, cancelBookingSchema, createBookingSchema } from "../schemas/booking.schema.ts";
import { cancelBooking, completeBooking, confirmBooking, createBooking, getBooking, listBookings } from "../controllers/booking.controller.ts";

const bookingRoutes = Router();

bookingRoutes.use(authenticate);
bookingRoutes.get("/", validate(bookingListQuerySchema, "query"), listBookings);
bookingRoutes.post("/", validate(createBookingSchema), createBooking);
bookingRoutes.get("/:bookingId", getBooking);
bookingRoutes.patch("/:bookingId/confirm", authorize("owner", "admin"), confirmBooking);
bookingRoutes.patch("/:bookingId/cancel", validate(cancelBookingSchema), cancelBooking);
bookingRoutes.patch("/:bookingId/complete", authorize("owner", "admin"), completeBooking);

export default bookingRoutes;
