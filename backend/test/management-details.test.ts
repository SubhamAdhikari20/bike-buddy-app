import assert from "node:assert/strict";
import test from "node:test";
import AppError from "../src/errors/AppError.ts";
import { bikeRepository } from "../src/repositories/bike.repository.ts";
import { bookingRepository } from "../src/repositories/booking.repository.ts";
import { damageReportRepository } from "../src/repositories/damage-report.repository.ts";
import { ownerRepository } from "../src/repositories/owner.repository.ts";
import { reviewRepository } from "../src/repositories/review.repository.ts";
import { bookingListQuerySchema } from "../src/schemas/booking.schema.ts";
import { damageReportListQuerySchema } from "../src/routes/safety.routes.ts";
import bikeService from "../src/services/bike.service.ts";
import bookingService from "../src/services/booking.service.ts";
import damageReportService from "../src/services/damage-report.service.ts";

const bikeId = "507f1f77bcf86cd799439011";
const ownerId = "507f1f77bcf86cd799439012";

test("management summary returns aggregate facts without booking records", async (context) => {
  const originalFindBike = bikeRepository.findById;
  const originalFindOwner = ownerRepository.findByBaseUserId;
  const originalBookingMetrics = bookingRepository.getBikeManagementMetrics;
  const originalReviewStats = reviewRepository.aggregateStatsByBikeId;
  const originalDamageCount = damageReportRepository.countOpenByBikeId;
  context.after(() => {
    bikeRepository.findById = originalFindBike;
    ownerRepository.findByBaseUserId = originalFindOwner;
    bookingRepository.getBikeManagementMetrics = originalBookingMetrics;
    reviewRepository.aggregateStatsByBikeId = originalReviewStats;
    damageReportRepository.countOpenByBikeId = originalDamageCount;
  });

  const safeBike = {
    _id: bikeId,
    title: "Demo commuter",
    ownerId: { _id: ownerId, fullName: "Demo Owner" },
  };
  bikeRepository.findById = (() =>
    Promise.resolve(safeBike)) as unknown as typeof bikeRepository.findById;
  ownerRepository.findByBaseUserId = (() =>
    Promise.resolve({
      _id: { toString: () => ownerId },
    })) as unknown as typeof ownerRepository.findByBaseUserId;
  bookingRepository.getBikeManagementMetrics = (() =>
    Promise.resolve({
      activeBookings: 2,
      completedBookings: 7,
      paidRevenue: 24500,
    })) as typeof bookingRepository.getBikeManagementMetrics;
  reviewRepository.aggregateStatsByBikeId = (() =>
    Promise.resolve({
      averageRating: 4.6,
      ratingCount: 5,
    })) as typeof reviewRepository.aggregateStatsByBikeId;
  damageReportRepository.countOpenByBikeId = (() =>
    Promise.resolve(
      1,
    )) as unknown as typeof damageReportRepository.countOpenByBikeId;

  const result = await bikeService.getManagementSummary(
    { userId: "owner-user", role: "owner", profileId: ownerId },
    bikeId,
  );

  assert.equal(result.bike, safeBike);
  assert.deepEqual(result.metrics, {
    activeBookings: 2,
    completedBookings: 7,
    paidRevenue: 24500,
    publicReviewCount: 5,
    averageRating: 4.6,
    openDamageReports: 1,
  });
  assert.equal("bookings" in result, false);
  assert.equal("reviews" in result, false);
  assert.equal("damageReports" in result, false);
});

test("management summary blocks an owner from another owner's bike", async (context) => {
  const originalFindBike = bikeRepository.findById;
  const originalFindOwner = ownerRepository.findByBaseUserId;
  context.after(() => {
    bikeRepository.findById = originalFindBike;
    ownerRepository.findByBaseUserId = originalFindOwner;
  });

  bikeRepository.findById = (() =>
    Promise.resolve({
      _id: bikeId,
      ownerId: "507f1f77bcf86cd799439099",
    })) as unknown as typeof bikeRepository.findById;
  ownerRepository.findByBaseUserId = (() =>
    Promise.resolve({
      _id: { toString: () => ownerId },
    })) as unknown as typeof ownerRepository.findByBaseUserId;

  await assert.rejects(
    () =>
      bikeService.getManagementSummary(
        { userId: "owner-user", role: "owner", profileId: ownerId },
        bikeId,
      ),
    (error: unknown) =>
      error instanceof AppError &&
      error.statusCode === 403 &&
      error.code === "FORBIDDEN",
  );
});

test("booking list keeps the bike filter inside the caller's role scope", async (context) => {
  const originalList = bookingRepository.listForBikeManagement;
  const originalCount = bookingRepository.count;
  context.after(() => {
    bookingRepository.listForBikeManagement = originalList;
    bookingRepository.count = originalCount;
  });

  let capturedFilter: Record<string, unknown> = {};
  bookingRepository.listForBikeManagement = ((
    filter: Record<string, unknown>,
  ) => {
    capturedFilter = filter;
    return Promise.resolve([]);
  }) as unknown as typeof bookingRepository.listForBikeManagement;
  bookingRepository.count = (() =>
    Promise.resolve(0)) as unknown as typeof bookingRepository.count;

  await bookingService.listBookings(
    { userId: "owner-user", role: "owner", profileId: ownerId },
    { bikeId, status: "completed", page: 1, limit: 10 },
  );

  assert.deepEqual(capturedFilter, {
    bikeId,
    status: "completed",
    ownerId,
  });
});

test("damage list applies filters, pagination, and owner booking scope", async (context) => {
  const originalOwnerBookings = bookingRepository.findIdsByOwnerId;
  const originalList = damageReportRepository.listForManagement;
  const originalCount = damageReportRepository.count;
  context.after(() => {
    bookingRepository.findIdsByOwnerId = originalOwnerBookings;
    damageReportRepository.listForManagement = originalList;
    damageReportRepository.count = originalCount;
  });

  const bookingIds = ["507f1f77bcf86cd799439021"];
  let capturedFilter: Record<string, unknown> = {};
  let capturedSkip = -1;
  let capturedLimit = -1;
  bookingRepository.findIdsByOwnerId = ((
    profileId: string,
    selectedBikeId?: string,
  ) => {
    assert.equal(profileId, ownerId);
    assert.equal(selectedBikeId, bikeId);
    return Promise.resolve(bookingIds);
  }) as unknown as typeof bookingRepository.findIdsByOwnerId;
  damageReportRepository.listForManagement = ((
    filter: Record<string, unknown>,
    skip: number,
    limit: number,
  ) => {
    capturedFilter = filter;
    capturedSkip = skip;
    capturedLimit = limit;
    return Promise.resolve([]);
  }) as unknown as typeof damageReportRepository.listForManagement;
  damageReportRepository.count = (() =>
    Promise.resolve(21)) as unknown as typeof damageReportRepository.count;

  const result = await damageReportService.listForManagement(
    { userId: "owner-user", role: "owner", profileId: ownerId },
    { bikeId, status: "open", page: 2, limit: 10 },
  );

  assert.deepEqual(capturedFilter, {
    bikeId,
    status: "open",
    bookingId: { $in: bookingIds },
  });
  assert.equal(capturedSkip, 10);
  assert.equal(capturedLimit, 10);
  assert.deepEqual(result.pagination, {
    page: 2,
    limit: 10,
    total: 21,
    totalPages: 3,
  });
});

test("detail list query schemas reject malformed IDs and unknown filters", () => {
  assert.equal(
    bookingListQuerySchema.safeParse({ bikeId, page: "2", limit: "20" })
      .success,
    true,
  );
  assert.equal(
    bookingListQuerySchema.safeParse({ bikeId: "not-an-id" }).success,
    false,
  );
  assert.equal(
    damageReportListQuerySchema.safeParse({
      bikeId,
      status: "reviewed",
      page: "2",
      limit: "20",
    }).success,
    true,
  );
  assert.equal(
    damageReportListQuerySchema.safeParse({
      bikeId,
      status: "open",
      reportedBy: "client-controlled-user-id",
    }).success,
    false,
  );
});

test("management list projections exclude renter and reporter identity", () => {
  const bookingProjection = bookingRepository
    .listForBikeManagement({}, { createdAt: -1 }, 0, 10)
    .projection();
  const damageProjection = damageReportRepository
    .listForManagement({}, 0, 10)
    .projection();

  assert.equal(bookingProjection.renterId, undefined);
  assert.equal(bookingProjection.ownerId, undefined);
  assert.equal(bookingProjection.notes, undefined);
  assert.equal(damageProjection.reportedBy, undefined);
});
