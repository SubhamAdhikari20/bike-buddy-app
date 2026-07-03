import { z } from "zod";
import { createReviewSchema, updateReviewSchema } from "./../schemas/review.schema.ts";

export type CreateReviewDTO = z.infer<typeof createReviewSchema>;
export type UpdateReviewDTO = z.infer<typeof updateReviewSchema>;
