import { Router } from "express";
import { authenticate, authorize } from "../middlewares/auth.ts";
import validate from "../middlewares/validate.ts";
import {
  adminPaymentStatusSchema,
  demoPaymentConfirmationSchema,
  initiatePaymentSchema,
} from "../schemas/payment.schema.ts";
import {
  confirmDemoPayment,
  esewaCallback,
  esewaFailureCallback,
  getPayment,
  getPaymentStatus,
  initiatePayment,
  khaltiCallback,
  openEsewaCheckout,
  updatePaymentStatus,
} from "../controllers/payment.controller.ts";

const paymentRoutes = Router();

// Provider returns are public by necessity, but they only trigger server-side
// signature/status verification and never trust a redirect as proof of payment.
paymentRoutes.get("/checkout/esewa/:paymentId", openEsewaCheckout);
paymentRoutes.get("/callback/khalti", khaltiCallback);
paymentRoutes.get(
  "/callback/esewa/:paymentRef/failure",
  esewaFailureCallback,
);
paymentRoutes.get("/callback/esewa/:paymentRef", esewaCallback);

paymentRoutes.use(authenticate);
paymentRoutes.post(
  "/initiate",
  validate(initiatePaymentSchema),
  initiatePayment,
);
paymentRoutes.post(
  "/:paymentId/demo-confirm",
  validate(demoPaymentConfirmationSchema),
  confirmDemoPayment,
);
paymentRoutes.get("/:paymentId/status", getPaymentStatus);
paymentRoutes.get("/:paymentId", getPayment);
paymentRoutes.patch(
  "/:paymentId/status",
  authorize("admin"),
  validate(adminPaymentStatusSchema),
  updatePaymentStatus,
);

export default paymentRoutes;
