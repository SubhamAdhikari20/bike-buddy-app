import { z } from "zod";
import type { IReview } from "./../models/review.model.ts";

const reviewTypeSchema = z.object({
    bikeId: z.string(),
    bookingId: z.string(),
    userId: z.string(),
    rating: z.number(),
    comment: z.string(),
    isVerifiedRide: z.boolean(),
    isHidden: z.boolean(),
});

export type Review = z.infer<typeof reviewTypeSchema>;
export type ReviewDocument = IReview;
