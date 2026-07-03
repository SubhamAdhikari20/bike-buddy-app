import AppError from "../errors/AppError.ts";
import { haversineKm, roundKm } from "../utils/geo.ts";
import { bikeRepository } from "../repositories/bike.repository.ts";
import { ownerRepository } from "../repositories/owner.repository.ts";
import { bookingRepository } from "../repositories/booking.repository.ts";
import type { AuthRole } from "../interfaces/auth.interface.ts";

const buildBikeFilter = async (query: Record<string, unknown>) => {
    const filter: Record<string, unknown> = {};

    if (query.status) filter.status = query.status;
    if (query.brand) filter.brand = query.brand;
    if (query.model) filter.model = query.model;
    if (query.city) filter["location.city"] = query.city;
    if (query.fuelType) filter.fuelType = query.fuelType;
    if (query.transmission) filter.transmission = query.transmission;
    if (query.condition) filter.condition = query.condition;

    const priceFilter: Record<string, number> = {};
    if (typeof query.minPrice === "number") priceFilter.$gte = query.minPrice;
    if (typeof query.maxPrice === "number") priceFilter.$lte = query.maxPrice;
    if (Object.keys(priceFilter).length > 0) {
        filter.pricePerDay = priceFilter;
    }

    if (query.search) {
        filter.$or = [
            { title: { $regex: query.search, $options: "i" } },
            { brand: { $regex: query.search, $options: "i" } },
            { model: { $regex: query.search, $options: "i" } },
            { "location.city": { $regex: query.search, $options: "i" } },
            { tags: { $in: [query.search] } },
        ];
    }

    if (query.startDate && query.endDate) {
        const unavailableBikeIds = await bookingRepository.findOverlappingBikeIds(query.startDate as Date, query.endDate as Date);
        if (unavailableBikeIds.length > 0) {
            filter._id = { $nin: unavailableBikeIds };
        }
    }

    return filter;
};

const ensureOwnerAccess = async (auth: { userId: string; role: AuthRole; profileId?: string }, ownerId: string) => {
    if (auth.role === "admin") {
        return;
    }

    if (auth.role !== "owner" || !auth.profileId) {
        throw new AppError(403, "Only owners can manage bikes", "FORBIDDEN");
    }

    const owner = await ownerRepository.findByBaseUserId(auth.userId);
    if (!owner || owner._id.toString() !== ownerId) {
        throw new AppError(403, "You can only manage your own bikes", "FORBIDDEN");
    }
};

const bikeService = {
    async createBike(auth: { userId: string; role: AuthRole; profileId?: string }, payload: Record<string, unknown>) {
        if (auth.role !== "owner" && auth.role !== "admin") {
            throw new AppError(403, "Only owners or admins can create bikes", "FORBIDDEN");
        }

        const ownerId = auth.role === "owner" ? (auth.profileId as string) : (payload.ownerId as string);
        if (!ownerId) {
            throw new AppError(400, "ownerId is required", "BAD_REQUEST");
        }

        await ensureOwnerAccess(auth, ownerId);
        const owner = await ownerRepository.findById(ownerId);
        if (!owner) {
            throw new AppError(404, "Owner not found", "NOT_FOUND");
        }

        return bikeRepository.create({
            ...payload,
            ownerId,
        });
    },

    async updateBike(auth: { userId: string; role: AuthRole; profileId?: string }, bikeId: string, payload: Record<string, unknown>) {
        const bike = await bikeRepository.findById(bikeId);
        if (!bike) {
            throw new AppError(404, "Bike not found", "NOT_FOUND");
        }

        await ensureOwnerAccess(auth, bike.ownerId.toString());
        return bikeRepository.updateById(bikeId, payload);
    },

    async deleteBike(auth: { userId: string; role: AuthRole; profileId?: string }, bikeId: string) {
        const bike = await bikeRepository.findById(bikeId);
        if (!bike) {
            throw new AppError(404, "Bike not found", "NOT_FOUND");
        }

        await ensureOwnerAccess(auth, bike.ownerId.toString());
        return bikeRepository.deleteById(bikeId);
    },

    async getBike(bikeId: string) {
        const bike = await bikeRepository.findById(bikeId);
        if (!bike) {
            throw new AppError(404, "Bike not found", "NOT_FOUND");
        }

        return bike;
    },

    async listBikes(query: Record<string, unknown>) {
        const page = Number(query.page ?? 1);
        const limit = Number(query.limit ?? 10);
        const skip = (page - 1) * limit;
        const filter = await buildBikeFilter(query);
        const sortBy = String(query.sortBy ?? "createdAt");
        const sortOrder = String(query.sortOrder ?? "desc") === "asc" ? 1 : -1;

        const lat = typeof query.lat === "number" ? query.lat : undefined;
        const lng = typeof query.lng === "number" ? query.lng : undefined;

        // Nearby search: only available bikes by default, sorted by distance (MAP-05)
        if (lat !== undefined && lng !== undefined) {
            const radiusKm = Number(query.radiusKm ?? 5);
            if (!query.status && !query.includeUnavailable) {
                filter.status = "available";
            }
            filter["location.latitude"] = { $ne: null };
            filter["location.longitude"] = { $ne: null };

            const candidates = await bikeRepository.list(filter, { createdAt: -1 }, 0, 500);
            const withDistance = candidates
                .map((bike) => {
                    const distanceKm = haversineKm(lat, lng, bike.location.latitude as number, bike.location.longitude as number);
                    return { bike, distanceKm };
                })
                .filter((entry) => entry.distanceKm <= radiusKm)
                .sort((a, b) => a.distanceKm - b.distanceKm);

            const total = withDistance.length;
            const pageItems = withDistance.slice(skip, skip + limit).map(({ bike, distanceKm }) => ({
                ...bike.toObject(),
                distanceKm: roundKm(distanceKm),
            }));

            return {
                items: pageItems,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
            };
        }

        const [items, total] = await Promise.all([
            bikeRepository.list(filter, { [sortBy]: sortOrder } as Record<string, 1 | -1>, skip, limit),
            bikeRepository.count(filter),
        ]);

        return {
            items,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    },
};

export default bikeService;
