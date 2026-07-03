import { Router } from "express";
import { authenticate, authorize } from "../middlewares/auth.ts";
import { dashboard, hideReview, listBikes, listBookings, listReviews, listUsers, reviewKyc, updateBikeStatus, updateBookingStatus } from "../controllers/admin.controller.ts";

const adminRoutes = Router();

adminRoutes.use(authenticate, authorize("admin"));
adminRoutes.get("/dashboard", dashboard);
adminRoutes.get("/users", listUsers);
adminRoutes.get("/bikes", listBikes);
adminRoutes.get("/bookings", listBookings);
adminRoutes.get("/reviews", listReviews);
adminRoutes.patch("/reviews/:reviewId/hide", hideReview);
adminRoutes.patch("/bikes/:bikeId/status", updateBikeStatus);
adminRoutes.patch("/bookings/:bookingId/status", updateBookingStatus);
adminRoutes.patch("/renters/:renterId/kyc", reviewKyc);

export default adminRoutes;
