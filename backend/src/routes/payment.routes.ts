import { Router } from "express";
import { authenticate } from "../middlewares/auth.ts";
import validate from "../middlewares/validate.ts";
import { createPaymentSchema, updatePaymentStatusSchema } from "../schemas/payment.schema.ts";
import { createPayment, getPayment, initiatePayment, updatePaymentStatus, verifyPayment } from "../controllers/payment.controller.ts";

const paymentRoutes = Router();

paymentRoutes.use(authenticate);
paymentRoutes.post("/initiate", initiatePayment);
paymentRoutes.post("/:paymentId/verify", verifyPayment);
paymentRoutes.post("/", validate(createPaymentSchema), createPayment);
paymentRoutes.get("/:paymentId", getPayment);
paymentRoutes.patch("/:paymentId/status", validate(updatePaymentStatusSchema), updatePaymentStatus);

export default paymentRoutes;
