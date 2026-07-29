import assert from "node:assert/strict";
import test from "node:test";
import bikeService from "../src/services/bike.service.ts";
import { bikeRepository } from "../src/repositories/bike.repository.ts";
import { bookingRepository } from "../src/repositories/booking.repository.ts";
import { ownerRepository } from "../src/repositories/owner.repository.ts";
import AppError from "../src/errors/AppError.ts";

test("pending owners cannot publish bike listings", async (context) => {
  const originalFindByBaseUserId = ownerRepository.findByBaseUserId;
  const originalFindById = ownerRepository.findById;
  const originalCreate = bikeRepository.create;
  context.after(() => {
    ownerRepository.findByBaseUserId = originalFindByBaseUserId;
    ownerRepository.findById = originalFindById;
    bikeRepository.create = originalCreate;
  });

  ownerRepository.findByBaseUserId = (() =>
    Promise.resolve({
      _id: { toString: () => "owner-profile" },
    })) as unknown as typeof ownerRepository.findByBaseUserId;
  ownerRepository.findById = (() =>
    Promise.resolve({
      _id: { toString: () => "owner-profile" },
      ownerStatus: "pending",
    })) as unknown as typeof ownerRepository.findById;
  bikeRepository.create = (() =>
    Promise.reject(new Error("create should not be called"))) as typeof bikeRepository.create;

  await assert.rejects(
    () =>
      bikeService.createBike(
        { userId: "owner-user", role: "owner", profileId: "owner-profile" },
        { title: "Demo bike" },
      ),
    (error: unknown) =>
      error instanceof AppError &&
      error.statusCode === 403 &&
      error.code === "OWNER_NOT_VERIFIED",
  );
});

test("bike deletion preserves linked booking history", async (context) => {
  const originalFindByBaseUserId = ownerRepository.findByBaseUserId;
  const originalFindById = bikeRepository.findById;
  const originalFindBookings = bookingRepository.findByBikeId;
  const originalDelete = bikeRepository.deleteById;
  context.after(() => {
    ownerRepository.findByBaseUserId = originalFindByBaseUserId;
    bikeRepository.findById = originalFindById;
    bookingRepository.findByBikeId = originalFindBookings;
    bikeRepository.deleteById = originalDelete;
  });

  ownerRepository.findByBaseUserId = (() =>
    Promise.resolve({
      _id: { toString: () => "owner-profile" },
    })) as unknown as typeof ownerRepository.findByBaseUserId;
  bikeRepository.findById = (() =>
    Promise.resolve({
      _id: { toString: () => "bike-id" },
      ownerId: "owner-profile",
    })) as unknown as typeof bikeRepository.findById;
  bookingRepository.findByBikeId = (() =>
    Promise.resolve([{ _id: "booking-id" }])) as unknown as typeof bookingRepository.findByBikeId;
  bikeRepository.deleteById = (() =>
    Promise.reject(new Error("delete should not be called"))) as unknown as typeof bikeRepository.deleteById;

  await assert.rejects(
    () =>
      bikeService.deleteBike(
        { userId: "owner-user", role: "owner", profileId: "owner-profile" },
        "bike-id",
      ),
    (error: unknown) =>
      error instanceof AppError &&
      error.statusCode === 409 &&
      error.code === "BIKE_HAS_BOOKINGS",
  );
});

test("pending owners cannot make draft bikes available", async (context) => {
  const originalFindByBaseUserId = ownerRepository.findByBaseUserId;
  const originalFindById = bikeRepository.findById;
  const originalUpdate = bikeRepository.updateById;
  context.after(() => {
    ownerRepository.findByBaseUserId = originalFindByBaseUserId;
    bikeRepository.findById = originalFindById;
    bikeRepository.updateById = originalUpdate;
  });

  ownerRepository.findByBaseUserId = (() =>
    Promise.resolve({
      _id: { toString: () => "owner-profile" },
      ownerStatus: "pending",
    })) as unknown as typeof ownerRepository.findByBaseUserId;
  bikeRepository.findById = (() =>
    Promise.resolve({
      _id: { toString: () => "bike-id" },
      ownerId: "owner-profile",
    })) as unknown as typeof bikeRepository.findById;
  bikeRepository.updateById = (() =>
    Promise.reject(new Error("update should not be called"))) as unknown as typeof bikeRepository.updateById;

  await assert.rejects(
    () =>
      bikeService.updateBike(
        { userId: "owner-user", role: "owner", profileId: "owner-profile" },
        "bike-id",
        { status: "available" },
      ),
    (error: unknown) =>
      error instanceof AppError &&
      error.statusCode === 403 &&
      error.code === "OWNER_NOT_VERIFIED",
  );
});

test("owners cannot self-assign bike moderation fields", async (context) => {
  const originalFindByBaseUserId = ownerRepository.findByBaseUserId;
  const originalFindOwner = ownerRepository.findById;
  const originalCreate = bikeRepository.create;
  context.after(() => {
    ownerRepository.findByBaseUserId = originalFindByBaseUserId;
    ownerRepository.findById = originalFindOwner;
    bikeRepository.create = originalCreate;
  });

  ownerRepository.findByBaseUserId = (() =>
    Promise.resolve({
      _id: { toString: () => "owner-profile" },
      ownerStatus: "verified",
    })) as unknown as typeof ownerRepository.findByBaseUserId;
  ownerRepository.findById = (() =>
    Promise.resolve({
      _id: { toString: () => "owner-profile" },
      ownerStatus: "verified",
    })) as unknown as typeof ownerRepository.findById;
  bikeRepository.create = ((payload: Record<string, unknown>) =>
    Promise.resolve(payload)) as unknown as typeof bikeRepository.create;

  const created = await bikeService.createBike(
    { userId: "owner-user", role: "owner", profileId: "owner-profile" },
    {
      title: "Owner bike",
      verifiedBike: true,
      safetyScore: 100,
      inspectionNotes: "Owner supplied moderation claim",
    },
  );

  assert.equal(created.ownerId, "owner-profile");
  assert.equal("verifiedBike" in created, false);
  assert.equal("safetyScore" in created, false);
  assert.equal("inspectionNotes" in created, false);
});
