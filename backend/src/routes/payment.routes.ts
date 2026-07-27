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
  getPayment,
  initiatePayment,
  updatePaymentStatus,
} from "../controllers/payment.controller.ts";

const paymentRoutes = Router();

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
paymentRoutes.get("/:paymentId", getPayment);
paymentRoutes.patch(
  "/:paymentId/status",
  authorize("admin"),
  validate(adminPaymentStatusSchema),
  updatePaymentStatus,
);

export default paymentRoutes;
