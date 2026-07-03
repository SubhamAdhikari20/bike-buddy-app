import { z } from "zod";

const locationSchema = z.object({
    label: z.string().min(2).max(120),
    address: z.string().min(3).max(255),
    city: z.string().min(2).max(80),
    area: z.string().min(2).max(80).optional(),
    latitude: z.number().finite().optional(),
    longitude: z.number().finite().optional(),
});

export const bikeImageSchema = z.object({
    url: z.string().url(),
    alt: z.string().min(1).max(120).optional(),
});

export const createBikeSchema = z.object({
    ownerId: z.string().min(1),
    title: z.string().min(3).max(120),
    brand: z.string().min(2).max(80),
    model: z.string().min(2).max(80),
    year: z.number().int().min(1950).max(new Date().getFullYear() + 1),
    engineCc: z.number().int().min(50).max(2500),
    fuelType: z.enum(["petrol", "diesel", "electric", "hybrid"]),
    transmission: z.enum(["manual", "automatic"]),
    condition: z.enum(["excellent", "good", "fair", "needs_service"]),
    description: z.string().max(4000).optional(),
    pricePerDay: z.number().positive(),
    pricePerHour: z.number().positive().optional(),
    securityDeposit: z.number().nonnegative().optional(),
    serviceFee: z.number().nonnegative().optional(),
    location: locationSchema,
    images: z.array(bikeImageSchema).default([]),
    status: z.enum(["available", "unavailable", "maintenance", "inactive"]).default("available"),
    verifiedBike: z.boolean().default(false),
    safetyScore: z.number().min(0).max(100).default(0),
    inspectionNotes: z.string().max(4000).nullish(),
    tags: z.array(z.string().min(1).max(50)).default([]),
});

export const updateBikeSchema = createBikeSchema.partial().omit({ ownerId: true });

export const bikeListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().optional(),
    brand: z.string().optional(),
    model: z.string().optional(),
    city: z.string().optional(),
    fuelType: z.enum(["petrol", "diesel", "electric", "hybrid"]).optional(),
    transmission: z.enum(["manual", "automatic"]).optional(),
    condition: z.enum(["excellent", "good", "fair", "needs_service"]).optional(),
    status: z.enum(["available", "unavailable", "maintenance", "inactive"]).optional(),
    minPrice: z.coerce.number().nonnegative().optional(),
    maxPrice: z.coerce.number().nonnegative().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    sortBy: z.enum(["pricePerDay", "rating", "createdAt", "year"]).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    radiusKm: z.coerce.number().positive().max(100).default(5),
    includeUnavailable: z.coerce.boolean().default(false),
});
