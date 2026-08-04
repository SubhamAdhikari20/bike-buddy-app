import assert from "node:assert/strict";
import test from "node:test";
import bookingService from "../src/services/booking.service.ts";
import { bikeRepository } from "../src/repositories/bike.repository.ts";
import { bookingRepository } from "../src/repositories/booking.repository.ts";
import { renterRepository } from "../src/repositories/renter.repository.ts";
import AppError from "../src/errors/AppError.ts";

const futureBooking = () => {
  const startDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
  return {
    bikeId: "bike-id",
    startDate,
    endDate: new Date(startDate.getTime() + 24 * 60 * 60 * 1000),
    pickupLocation: "Thamel Hub",
  };
};

test("booking requires an approved renter ID", async (context) => {
  const originalFindRenter = renterRepository.findById;
  context.after(() => {
    renterRepository.findById = originalFindRenter;
  });
  renterRepository.findById = (() =>
    Promise.resolve({
      baseUserId: { toString: () => "renter-user" },
      kycStatus: "pending",
    })) as unknown as typeof renterRepository.findById;

  await assert.rejects(
    () =>
      bookingService.createBooking(
        {
          userId: "renter-user",
          role: "renter",
          profileId: "renter-profile",
        },
        futureBooking(),
      ),
    (error: unknown) =>
      error instanceof AppError &&
      error.statusCode === 403 &&
      error.code === "ID_VERIFICATION_REQUIRED",
  );
});

test("booking rejects a profile that does not belong to the token user", async (context) => {
  const originalFindRenter = renterRepository.findById;
  context.after(() => {
    renterRepository.findById = originalFindRenter;
  });
  renterRepository.findById = (() =>
    Promise.resolve({
      baseUserId: { toString: () => "another-user" },
      kycStatus: "approved",
    })) as unknown as typeof renterRepository.findById;

  await assert.rejects(
    () =>
      bookingService.createBooking(
        {
          userId: "renter-user",
          role: "renter",
          profileId: "renter-profile",
        },
        futureBooking(),
      ),
    (error: unknown) =>
      error instanceof AppError &&
      error.statusCode === 403 &&
      error.code === "FORBIDDEN",
  );
});

test("approved renters can create an available booking", async (context) => {
  const originalFindRenter = renterRepository.findById;
  const originalFindBike = bikeRepository.findById;
  const originalFindOverlap = bookingRepository.findOverlap;
  const originalCreate = bookingRepository.create;
  const originalWithBikeLease = bookingRepository.withBikeLease;
  const originalExpireHolds = bookingRepository.expireUnpaidHolds;
  context.after(() => {
    renterRepository.findById = originalFindRenter;
    bikeRepository.findById = originalFindBike;
    bookingRepository.findOverlap = originalFindOverlap;
    bookingRepository.create = originalCreate;
    bookingRepository.withBikeLease = originalWithBikeLease;
    bookingRepository.expireUnpaidHolds = originalExpireHolds;
  });

  renterRepository.findById = (() =>
    Promise.resolve({
      baseUserId: { toString: () => "renter-user" },
      kycStatus: "approved",
    })) as unknown as typeof renterRepository.findById;
  bikeRepository.findById = (() =>
    Promise.resolve({
      status: "available",
      ownerId: "owner-profile",
      pricePerDay: 1000,
      serviceFee: 100,
      securityDeposit: 1500,
    })) as unknown as typeof bikeRepository.findById;
  bookingRepository.findOverlap = (() =>
    Promise.resolve(null)) as unknown as typeof bookingRepository.findOverlap;
  bookingRepository.create = ((payload: Record<string, unknown>) =>
    Promise.resolve(payload)) as unknown as typeof bookingRepository.create;
  bookingRepository.withBikeLease = ((_bikeId: string, task: () => Promise<unknown>) =>
    task()) as typeof bookingRepository.withBikeLease;
  bookingRepository.expireUnpaidHolds = (() =>
    Promise.resolve({ modifiedCount: 0 })) as unknown as typeof bookingRepository.expireUnpaidHolds;

  const booking = await bookingService.createBooking(
    {
      userId: "renter-user",
      role: "renter",
      profileId: "renter-profile",
    },
    futureBooking(),
  );

  assert.equal(booking.renterId, "renter-profile");
  assert.equal(booking.ownerId, "owner-profile");
  assert.equal(booking.totalAmount, 2600);
  assert.ok(booking.holdExpiresAt instanceof Date);
});
