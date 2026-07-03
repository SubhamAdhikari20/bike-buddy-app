import { Router } from "express";
import { authenticate } from "../middlewares/auth.ts";
import validate from "../middlewares/validate.ts";
import { createReviewSchema, updateReviewSchema } from "../schemas/review.schema.ts";
import { createReview, deleteReview, getReview, listByBikeId, updateReview } from "../controllers/review.controller.ts";

const reviewRoutes = Router();

reviewRoutes.get("/bike/:bikeId", listByBikeId);
reviewRoutes.get("/:reviewId", getReview);
reviewRoutes.post("/", authenticate, validate(createReviewSchema), createReview);
reviewRoutes.patch("/:reviewId", authenticate, validate(updateReviewSchema), updateReview);
reviewRoutes.delete("/:reviewId", authenticate, deleteReview);

export default reviewRoutes;
