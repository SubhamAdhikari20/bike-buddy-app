import AppError from "../errors/AppError.ts";
import { haversineKm, roundKm } from "../utils/geo.ts";
import { bikeRepository } from "../repositories/bike.repository.ts";
import { ownerRepository } from "../repositories/owner.repository.ts";
import { bookingRepository } from "../repositories/booking.repository.ts";
import type { AuthRole } from "../interfaces/auth.interface.ts";
import { toDocumentId } from "../utils/mongo-reference.ts";
import { deleteLocalUpload } from "../utils/local-media.ts";

type AuthContext = {
  userId: string;
  role: AuthRole;
  profileId?: string;
};

const escapeRegularExpression = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildBikeFilter = async (query: Record<string, unknown>) => {
  const filter: Record<string, unknown> = {};

  if (query.status) filter.status = query.status;
  if (query.ownerId) filter.ownerId = query.ownerId;
  if (query.category) filter.category = query.category;
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
    const search = escapeRegularExpression(String(query.search));
    filter.$or = [
      { title: { $regex: search, $options: "i" } },
      { brand: { $regex: search, $options: "i" } },
      { model: { $regex: search, $options: "i" } },
      { "location.city": { $regex: search, $options: "i" } },
      { tags: { $in: [query.search] } },
    ];
  }

  if (query.startDate && query.endDate) {
    const unavailableBikeIds = await bookingRepository.findOverlappingBikeIds(
      query.startDate as Date,
      query.endDate as Date,
    );
    if (unavailableBikeIds.length > 0) {
      filter._id = { $nin: unavailableBikeIds };
    }
  }

  return filter;
};

const ensureOwnerAccess = async (
  auth: { userId: string; role: AuthRole; profileId?: string },
  ownerId: string,
) => {
  if (auth.role === "admin") {
    return null;
  }

  if (auth.role !== "owner" || !auth.profileId) {
    throw new AppError(403, "Only owners can manage bikes", "FORBIDDEN");
  }

  const owner = await ownerRepository.findByBaseUserId(auth.userId);
  if (!owner || owner._id.toString() !== ownerId) {
    throw new AppError(403, "You can only manage your own bikes", "FORBIDDEN");
  }
  return owner;
};

const ownerSafeBikePayload = (
  auth: { role: AuthRole },
  payload: Record<string, unknown>,
) => {
  if (auth.role === "admin") return payload;
  const {
    verifiedBike: _verifiedBike,
    safetyScore: _safetyScore,
    inspectionNotes: _inspectionNotes,
    ...ownerFields
  } = payload;
  return ownerFields;
};

const isPubliclyVisible = (bike: any) =>
  bike.status === "available" && bike.ownerId?.ownerStatus === "verified";

const removeReplacedBikeImages = async (
  existingImages: Array<{ url?: string }> | undefined,
  nextImages: unknown,
) => {
  if (!Array.isArray(nextImages)) return;
  const retained = new Set(
    nextImages
      .map((image) =>
        image && typeof image === "object" && "url" in image
          ? String((image as { url: unknown }).url)
          : "",
      )
      .filter(Boolean),
  );
  const removed = (existingImages ?? [])
    .map((image) => image.url)
    .filter(
      (url): url is string =>
        typeof url === "string" && url.length > 0 && !retained.has(url),
    );
  await Promise.all(
    removed.map((url) =>
      deleteLocalUpload(url).catch((error) =>
        console.error("Could not remove replaced bike image", error),
      ),
    ),
  );
};

const bikeService = {
  async createBike(
    auth: { userId: string; role: AuthRole; profileId?: string },
    payload: Record<string, unknown>,
  ) {
    if (auth.role !== "owner" && auth.role !== "admin") {
      throw new AppError(
        403,
        "Only owners or admins can create bikes",
        "FORBIDDEN",
      );
    }

    const ownerId =
      auth.role === "owner"
        ? (auth.profileId as string)
        : (payload.ownerId as string);
    if (!ownerId) {
      throw new AppError(400, "ownerId is required", "BAD_REQUEST");
    }

    await ensureOwnerAccess(auth, ownerId);
    const owner = await ownerRepository.findById(ownerId);
    if (!owner) {
      throw new AppError(404, "Owner not found", "NOT_FOUND");
    }
    if (auth.role === "owner" && owner.ownerStatus !== "verified") {
      throw new AppError(
        403,
        "Your owner account must be verified before you can publish bikes.",
        "OWNER_NOT_VERIFIED",
      );
    }

    return bikeRepository.create({
      ...ownerSafeBikePayload(auth, payload),
      ownerId,
    });
  },

  async updateBike(
    auth: { userId: string; role: AuthRole; profileId?: string },
    bikeId: string,
    payload: Record<string, unknown>,
  ) {
    const bike = await bikeRepository.findById(bikeId);
    if (!bike) {
      throw new AppError(404, "Bike not found", "NOT_FOUND");
    }

    const owner = await ensureOwnerAccess(
      auth,
      toDocumentId(bike.ownerId) ?? "",
    );
    if (
      auth.role === "owner" &&
      payload.status === "available" &&
      owner?.ownerStatus !== "verified"
    ) {
      throw new AppError(
        403,
        "Your owner account must be verified before a bike can be made available.",
        "OWNER_NOT_VERIFIED",
      );
    }
    const updated = await bikeRepository.updateById(
      bikeId,
      ownerSafeBikePayload(auth, payload),
    );
    if (updated) {
      await removeReplacedBikeImages(bike.images, payload.images);
    }
    return updated;
  },

  async deleteBike(
    auth: { userId: string; role: AuthRole; profileId?: string },
    bikeId: string,
  ) {
    const bike = await bikeRepository.findById(bikeId);
    if (!bike) {
      throw new AppError(404, "Bike not found", "NOT_FOUND");
    }

    await ensureOwnerAccess(auth, toDocumentId(bike.ownerId) ?? "");
    const bookingHistory = await bookingRepository.findByBikeId(bikeId);
    if (bookingHistory.length > 0) {
      throw new AppError(
        409,
        "This bike has booking history. Set it to inactive instead of deleting it.",
        "BIKE_HAS_BOOKINGS",
      );
    }
    const deleted = await bikeRepository.deleteById(bikeId);
    if (deleted) {
      await removeReplacedBikeImages(bike.images, []);
    }
    return deleted;
  },

  // Side-by-side comparison of up to 3 bikes (UI-04, Miller's law).
  async compareBikes(ids: string[]) {
    if (ids.length < 2 || ids.length > 3) {
      throw new AppError(400, "Pick 2 or 3 bikes to compare", "BAD_REQUEST");
    }
    if (new Set(ids).size !== ids.length) {
      throw new AppError(
        400,
        "Choose different bikes to compare",
        "BAD_REQUEST",
      );
    }

    const bikes = await Promise.all(
      ids.map((id) => bikeRepository.findById(id)),
    );
    const found = bikes.filter((bike) => bike !== null);
    if (found.length !== ids.length) {
      throw new AppError(
        404,
        "One of the selected bikes no longer exists",
        "NOT_FOUND",
      );
    }
    if (!found.every(isPubliclyVisible)) {
      throw new AppError(
        404,
        "One of the selected bikes is not available",
        "NOT_FOUND",
      );
    }

    // Flag the cheapest per-day bike so the UI can highlight best value.
    const cheapest = found.reduce((minimum, bike) =>
      bike.pricePerDay < minimum.pricePerDay ? bike : minimum,
    );
    return found.map((bike) => ({
      ...bike.toObject(),
      isBestValue: bike._id.toString() === cheapest._id.toString(),
    }));
  },

  async getBike(bikeId: string, auth?: AuthContext) {
    const bike = await bikeRepository.findById(bikeId);
    if (!bike) {
      throw new AppError(404, "Bike not found", "NOT_FOUND");
    }

    if (isPubliclyVisible(bike) || auth?.role === "admin") {
      return bike;
    }
    if (
      auth?.role === "owner" &&
      auth.profileId &&
      toDocumentId(bike.ownerId) === auth.profileId
    ) {
      return bike;
    }

    throw new AppError(404, "Bike not found", "NOT_FOUND");
  },

  async listBikes(query: Record<string, unknown>, auth?: AuthContext) {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 10);
    const skip = (page - 1) * limit;
    const filter = await buildBikeFilter(query);
    const requestedSort = String(query.sortBy ?? "createdAt");
    const sortBy = requestedSort === "rating" ? "averageRating" : requestedSort;
    const sortOrder = String(query.sortOrder ?? "desc") === "asc" ? 1 : -1;

    const lat = typeof query.lat === "number" ? query.lat : undefined;
    const lng = typeof query.lng === "number" ? query.lng : undefined;

    const requestsNonPublic =
      query.includeUnavailable === true ||
      (query.status !== undefined && query.status !== "available");
    const canManage = auth?.role === "owner" || auth?.role === "admin";

    if (requestsNonPublic && !canManage) {
      throw new AppError(
        403,
        "Only owners and administrators can view unavailable listings",
        "FORBIDDEN",
      );
    }

    if (requestsNonPublic && auth?.role === "owner") {
      if (!auth.profileId) {
        throw new AppError(403, "Owner profile is required", "FORBIDDEN");
      }
      if (query.ownerId && query.ownerId !== auth.profileId) {
        throw new AppError(
          403,
          "You can only view your own managed listings",
          "FORBIDDEN",
        );
      }
      filter.ownerId = auth.profileId;
    } else if (!requestsNonPublic) {
      filter.status = "available";
      const verifiedOwnerIds = await ownerRepository.findVerifiedIds();
      if (query.ownerId) {
        filter.ownerId = verifiedOwnerIds.includes(String(query.ownerId))
          ? query.ownerId
          : { $in: [] };
      } else {
        filter.ownerId = { $in: verifiedOwnerIds };
      }
    }

    // Nearby search: sorted by distance from the supplied point (MAP-05)
    if (lat !== undefined && lng !== undefined) {
      const radiusKm = Number(query.radiusKm ?? 5);
      filter["location.latitude"] = { $ne: null };
      filter["location.longitude"] = { $ne: null };

      const candidates = await bikeRepository.list(
        filter,
        { createdAt: -1 },
        0,
        500,
      );
      const withDistance = candidates
        .map((bike) => {
          const distanceKm = haversineKm(
            lat,
            lng,
            bike.location.latitude as number,
            bike.location.longitude as number,
          );
          return { bike, distanceKm };
        })
        .filter((entry) => entry.distanceKm <= radiusKm)
        .sort((a, b) => a.distanceKm - b.distanceKm);

      const total = withDistance.length;
      const pageItems = withDistance
        .slice(skip, skip + limit)
        .map(({ bike, distanceKm }) => ({
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
      bikeRepository.list(
        filter,
        { [sortBy]: sortOrder } as Record<string, 1 | -1>,
        skip,
        limit,
      ),
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
