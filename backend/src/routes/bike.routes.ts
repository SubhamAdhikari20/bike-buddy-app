import { Router } from "express";
import {
  authenticate,
  authorize,
  optionalAuthenticate,
} from "../middlewares/auth.ts";
import validate from "../middlewares/validate.ts";
import {
  bikeListQuerySchema,
  createBikeSchema,
  updateBikeSchema,
} from "../schemas/bike.schema.ts";
import {
  compareBikes,
  createBike,
  deleteBike,
  getBike,
  listBikes,
  updateBike,
} from "../controllers/bike.controller.ts";

const bikeRoutes = Router();

bikeRoutes.get(
  "/",
  optionalAuthenticate,
  validate(bikeListQuerySchema, "query"),
  listBikes,
);
bikeRoutes.get("/compare", compareBikes);
bikeRoutes.get("/:bikeId", optionalAuthenticate, getBike);
bikeRoutes.post(
  "/",
  authenticate,
  authorize("owner", "admin"),
  validate(createBikeSchema),
  createBike,
);
bikeRoutes.patch(
  "/:bikeId",
  authenticate,
  authorize("owner", "admin"),
  validate(updateBikeSchema),
  updateBike,
);
bikeRoutes.delete(
  "/:bikeId",
  authenticate,
  authorize("owner", "admin"),
  deleteBike,
);

export default bikeRoutes;
