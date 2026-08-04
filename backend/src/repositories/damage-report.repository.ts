import DamageReportModel from "../models/damage-report.model.ts";

const managementProjection =
  "_id bookingId bikeId photos description status resolvedAt createdAt updatedAt";

export const damageReportRepository = {
  listForManagement: (
    filter: Record<string, unknown>,
    skip: number,
    limit: number,
  ) =>
    DamageReportModel.find(filter)
      .select(managementProjection)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
  count: (filter: Record<string, unknown>) =>
    DamageReportModel.countDocuments(filter),
  countOpenByBikeId: (bikeId: string) =>
    DamageReportModel.countDocuments({ bikeId, status: "open" }),
};
