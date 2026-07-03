import { z } from "zod";
import { createPaymentSchema, updatePaymentStatusSchema } from "./../schemas/payment.schema.ts";

export type CreatePaymentDTO = z.infer<typeof createPaymentSchema>;
export type UpdatePaymentStatusDTO = z.infer<typeof updatePaymentStatusSchema>;
