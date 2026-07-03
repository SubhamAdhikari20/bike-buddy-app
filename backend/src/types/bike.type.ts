import { z } from "zod";
import type { IBike } from "./../models/bike.model.ts";
import { bikeImageSchema } from "./../schemas/bike.schema.ts";

const bikeTypeSchema = z.object({
    ownerId: z.string(),
    title: z.string(),
    brand: z.string(),
    model: z.string(),
    year: z.number(),
    engineCc: z.number(),
    fuelType: z.enum(["petrol", "diesel", "electric", "hybrid"]),
    transmission: z.enum(["manual", "automatic"]),
    condition: z.enum(["excellent", "good", "fair", "needs_service"]),
    category: z.enum(["commuter", "scooter", "cruiser", "sports", "electric", "mountain"]),
    description: z.string().nullish(),
    pricePerDay: z.number(),
    pricePerHour: z.number().nullish(),
    securityDeposit: z.number().nullish(),
    serviceFee: z.number().nullish(),
    location: z.object({
        label: z.string(),
        address: z.string(),
        city: z.string(),
        area: z.string().nullish(),
        landmark: z.string().nullish(),
        latitude: z.number().nullish(),
        longitude: z.number().nullish(),
    }),
    images: z.array(bikeImageSchema),
    specs: z.object({
        weightKg: z.number().nullish(),
        mileageKmPerL: z.number().nullish(),
        helmetIncluded: z.boolean().nullish(),
    }).nullish(),
    conditionInfo: z.object({
        serviceDate: z.date().nullish(),
        odometerKm: z.number().nullish(),
        photos: z.array(z.object({ url: z.string(), takenAt: z.date().nullish() })).nullish(),
    }).nullish(),
    status: z.enum(["available", "unavailable", "maintenance", "inactive"]),
    verifiedBike: z.boolean(),
    safetyScore: z.number(),
    inspectionNotes: z.string().nullish(),
    tags: z.array(z.string()),
    averageRating: z.number(),
    ratingCount: z.number(),
});

export type Bike = z.infer<typeof bikeTypeSchema>;
export type BikeDocument = IBike;
