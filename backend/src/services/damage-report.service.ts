import AppError from "../errors/AppError.ts";
import type { AuthRole } from "../interfaces/auth.interface.ts";
import { bookingRepository } from "../repositories/booking.repository.ts";
import { damageReportRepository } from "../repositories/damage-report.repository.ts";

const damageReportService = {
  async listForManagement(
    auth: { userId: string; role: AuthRole; profileId?: string },
    query: Record<string, unknown>,
  ) {
    if (auth.role !== "admin" && auth.role !== "owner") {
      throw new AppError(
        403,
        "Only owners and administrators can view damage reports",
        "FORBIDDEN",
      );
    }

    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 10);
    const skip = (page - 1) * limit;
    const filter: Record<string, unknown> = {};

    const bikeId = typeof query.bikeId === "string" ? query.bikeId : undefined;
    if (bikeId) filter.bikeId = bikeId;
    if (query.status) filter.status = query.status;

    if (auth.role === "owner") {
      if (!auth.profileId) {
        throw new AppError(403, "Owner profile is missing", "FORBIDDEN");
      }
      const ownerBookingIds = await bookingRepository.findIdsByOwnerId(
        auth.profileId,
        bikeId,
      );
      filter.bookingId = { $in: ownerBookingIds };
    }

    const [items, total] = await Promise.all([
      damageReportRepository.listForManagement(filter, skip, limit),
      damageReportRepository.count(filter),
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

export default damageReportService;
