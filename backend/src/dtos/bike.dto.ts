import { z } from "zod";
import { bikeListQuerySchema, createBikeSchema, updateBikeSchema } from "./../schemas/bike.schema.ts";

export type CreateBikeDTO = z.infer<typeof createBikeSchema>;
export type UpdateBikeDTO = z.infer<typeof updateBikeSchema>;
export type BikeListQueryDTO = z.infer<typeof bikeListQuerySchema>;
