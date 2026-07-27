import { z } from "zod";
import {
  adminPaymentStatusSchema,
  demoPaymentConfirmationSchema,
  initiatePaymentSchema,
} from "./../schemas/payment.schema.ts";

export type InitiatePaymentDTO = z.infer<typeof initiatePaymentSchema>;
export type DemoPaymentConfirmationDTO = z.infer<
  typeof demoPaymentConfirmationSchema
>;
export type AdminPaymentStatusDTO = z.infer<typeof adminPaymentStatusSchema>;
