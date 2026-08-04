import { Router } from "express";
import { authenticate, authorize } from "../middlewares/auth.ts";
import validate from "../middlewares/validate.ts";
import {
  bikeStatusSchema,
  bookingStatusSchema,
  kycReviewSchema,
  kycListQuerySchema,
  ownerListQuerySchema,
  ownerVerificationSchema,
} from "../schemas/admin.schema.ts";
import {
  dashboard,
  hideReview,
  listBikes,
  listBookings,
  listOwners,
  listKyc,
  listReviews,
  listUsers,
  reviewKyc,
  updateBikeStatus,
  updateBookingStatus,
  verifyOwner,
} from "../controllers/admin.controller.ts";

const adminRoutes = Router();

adminRoutes.use(authenticate, authorize("admin"));
adminRoutes.get("/dashboard", dashboard);
adminRoutes.get("/users", listUsers);
adminRoutes.get("/bikes", listBikes);
adminRoutes.get("/bookings", listBookings);
adminRoutes.get("/reviews", listReviews);
adminRoutes.patch("/reviews/:reviewId/hide", hideReview);
adminRoutes.patch(
  "/bikes/:bikeId/status",
  validate(bikeStatusSchema),
  updateBikeStatus,
);
adminRoutes.get("/renters/kyc", validate(kycListQuerySchema, "query"), listKyc);
adminRoutes.patch(
  "/bookings/:bookingId/status",
  validate(bookingStatusSchema),
  updateBookingStatus,
);
adminRoutes.patch(
  "/renters/:renterId/kyc",
  validate(kycReviewSchema),
  reviewKyc,
);
adminRoutes.get("/owners", validate(ownerListQuerySchema, "query"), listOwners);
adminRoutes.patch(
  "/owners/:ownerId/verify",
  validate(ownerVerificationSchema),
  verifyOwner,
);

export default adminRoutes;
