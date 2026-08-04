import assert from "node:assert/strict";
import test from "node:test";
import AppError from "../src/errors/AppError.ts";
import BookingLockModel from "../src/models/booking-lock.model.ts";
import { bikeRepository } from "../src/repositories/bike.repository.ts";
import { bookingRepository } from "../src/repositories/booking.repository.ts";
import { paymentRepository } from "../src/repositories/payment.repository.ts";
import { renterRepository } from "../src/repositories/renter.repository.ts";
import bookingService from "../src/services/booking.service.ts";

const bikeId = "507f1f77bcf86cd799439011";
const bookingId = "507f1f77bcf86cd799439012";
const renterId = "507f1f77bcf86cd799439013";
const ownerId = "507f1f77bcf86cd799439014";

test("the per-bike lease reclaims an expired lock by Mongo _id", async (context) => {
  const originalFindAndUpdate = BookingLockModel.findOneAndUpdate;
  const originalCreate = BookingLockModel.create;
  const originalDelete = BookingLockModel.deleteOne;
  context.after(() => {
    BookingLockModel.findOneAndUpdate = originalFindAndUpdate;
    BookingLockModel.create = originalCreate;
    BookingLockModel.deleteOne = originalDelete;
  });

  let leaseToken = "";
  BookingLockModel.findOneAndUpdate = ((
    filter: Record<string, any>,
    update: Record<string, any>,
  ) => {
    assert.equal(filter._id, bikeId);
    assert.ok(filter.expiresAt.$lte instanceof Date);
    leaseToken = update.$set.token;
    assert.ok(update.$set.expiresAt instanceof Date);
    return Promise.resolve({ _id: bikeId });
  }) as unknown as typeof BookingLockModel.findOneAndUpdate;
  BookingLockModel.create = (() => {
    assert.fail("an expired lease should be reclaimed without creating a row");
  }) as unknown as typeof BookingLockModel.create;
  BookingLockModel.deleteOne = ((filter: Record<string, unknown>) => {
    assert.deepEqual(filter, { _id: bikeId, token: leaseToken });
    return Promise.resolve({ deletedCount: 1 });
  }) as unknown as typeof BookingLockModel.deleteOne;

  const result = await bookingRepository.withBikeLease(
    bikeId,
    async () => "protected result",
  );
  assert.equal(result, "protected result");
});

test("the per-bike lease retries bounded duplicate-key contention", async (context) => {
  const originalFindAndUpdate = BookingLockModel.findOneAndUpdate;
  const originalCreate = BookingLockModel.create;
  const originalDelete = BookingLockModel.deleteOne;
  context.after(() => {
    BookingLockModel.findOneAndUpdate = originalFindAndUpdate;
    BookingLockModel.create = originalCreate;
    BookingLockModel.deleteOne = originalDelete;
  });

  let createAttempts = 0;
  BookingLockModel.findOneAndUpdate = (() =>
    Promise.resolve(null)) as unknown as typeof BookingLockModel.findOneAndUpdate;
  BookingLockModel.create = (() => {
    createAttempts += 1;
    if (createAttempts < 3) {
      return Promise.reject(Object.assign(new Error("busy"), { code: 11000 }));
    }
    return Promise.resolve({ _id: bikeId });
  }) as unknown as typeof BookingLockModel.create;
  BookingLockModel.deleteOne = (() =>
    Promise.resolve({ deletedCount: 1 })) as unknown as typeof BookingLockModel.deleteOne;

  let taskCalls = 0;
  await bookingRepository.withBikeLease(bikeId, async () => {
    taskCalls += 1;
  });
  assert.equal(createAttempts, 3);
  assert.equal(taskCalls, 1);
});

test("booking lock schema uses guaranteed _id uniqueness and TTL cleanup", () => {
  assert.equal(BookingLockModel.schema.path("_id").instance, "ObjectId");
  assert.equal(BookingLockModel.schema.path("bikeId"), undefined);
  assert.ok(
    BookingLockModel.schema.indexes().some(
      ([fields, options]) =>
        fields.expiresAt === 1 && options.expireAfterSeconds === 0,
    ),
  );
});

test("simultaneous overlapping booking requests create only one booking", async (context) => {
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
      ownerId,
      pricePerDay: 1000,
      serviceFee: 100,
      securityDeposit: 500,
    })) as unknown as typeof bikeRepository.findById;
  bookingRepository.expireUnpaidHolds = (() =>
    Promise.resolve({ modifiedCount: 0 })) as unknown as typeof bookingRepository.expireUnpaidHolds;

  let leaseTail = Promise.resolve();
  bookingRepository.withBikeLease = (async (
    _selectedBikeId: string,
    task: () => Promise<unknown>,
  ) => {
    const previous = leaseTail;
    let release = () => undefined;
    leaseTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await task();
    } finally {
      release();
    }
  }) as typeof bookingRepository.withBikeLease;

  const records: Record<string, any>[] = [];
  bookingRepository.findOverlap = ((
    _selectedBikeId: string,
    startDate: Date,
    endDate: Date,
  ) =>
    Promise.resolve(
      records.find(
        (record) => record.startDate <= endDate && record.endDate >= startDate,
      ) ?? null,
    )) as unknown as typeof bookingRepository.findOverlap;
  bookingRepository.create = ((payload: Record<string, any>) => {
    const created = { ...payload, _id: `booking-${records.length + 1}` };
    records.push(created);
    return Promise.resolve(created);
  }) as unknown as typeof bookingRepository.create;

  const startDate = new Date(Date.now() + 24 * 60 * 60_000);
  const request = {
    bikeId,
    startDate,
    endDate: new Date(startDate.getTime() + 24 * 60 * 60_000),
    pickupLocation: "Thamel Hub",
  };
  const auth = {
    userId: "renter-user",
    role: "renter" as const,
    profileId: renterId,
  };
  const results = await Promise.allSettled([
    bookingService.createBooking(auth, request),
    bookingService.createBooking(auth, request),
  ]);

  assert.equal(records.length, 1);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const rejected = results.find((result) => result.status === "rejected");
  assert.ok(rejected && rejected.status === "rejected");
  assert.ok(rejected.reason instanceof AppError);
  assert.equal(rejected.reason.code, "CONFLICT");
});

test("expiry and owner confirmation use conditional hold-aware filters", () => {
  const now = new Date("2030-01-01T00:00:00.000Z");
  const expiryFilter = bookingRepository.expireUnpaidHolds(now, bikeId).getFilter();
  assert.equal(expiryFilter.status, "pending");
  assert.deepEqual(expiryFilter.paymentStatus, { $ne: "paid" });
  assert.deepEqual(expiryFilter.$or, [
    { holdExpiresAt: { $lte: now } },
    { holdExpiresAt: null },
    { holdExpiresAt: { $exists: false } },
  ]);

  const confirmFilter = bookingRepository
    .confirmEligibleBooking(bookingId, now)
    .getFilter();
  assert.equal(confirmFilter.status, "pending");
  assert.deepEqual(confirmFilter.startDate, { $gt: now });
  assert.deepEqual(confirmFilter.$or[1], {
    paymentMethod: "cash",
    paymentStatus: "pending",
    holdExpiresAt: { $gt: now },
  });

  const rescheduleFilter = bookingRepository
    .rescheduleEligibleBooking(
      bookingId,
      now,
      new Date(now.getTime() + 60_000),
      new Date(now.getTime() + 120_000),
      new Date(now.getTime() + 180_000),
      now,
      {
        status: "pending",
        paymentStatus: "unpaid",
        paymentMethod: null,
        paymentMode: null,
        holdExpiresAt: new Date(now.getTime() + 30_000),
      },
    )
    .getFilter();
  assert.equal(rescheduleFilter._id, bookingId);
  assert.equal(rescheduleFilter.$or[0].status, "confirmed");
});

test("owner confirmation rejects and persists an expired cash hold", async (context) => {
  const originalFind = bookingRepository.findById;
  const originalExpire = bookingRepository.expireUnpaidHoldById;
  const originalConfirm = bookingRepository.confirmEligibleBooking;
  context.after(() => {
    bookingRepository.findById = originalFind;
    bookingRepository.expireUnpaidHoldById = originalExpire;
    bookingRepository.confirmEligibleBooking = originalConfirm;
  });

  const expiredAt = new Date(Date.now() - 60_000);
  bookingRepository.findById = (() =>
    Promise.resolve({
      _id: bookingId,
      ownerId,
      bikeId,
      status: "pending",
      paymentMethod: "cash",
      paymentStatus: "pending",
      holdExpiresAt: expiredAt,
    })) as unknown as typeof bookingRepository.findById;
  bookingRepository.expireUnpaidHoldById = (() =>
    Promise.resolve({
      _id: bookingId,
      ownerId,
      bikeId,
      status: "expired",
      paymentMethod: "cash",
      paymentStatus: "pending",
      holdExpiresAt: expiredAt,
    })) as unknown as typeof bookingRepository.expireUnpaidHoldById;
  bookingRepository.confirmEligibleBooking = (() => {
    assert.fail("an expired hold must not reach the confirmation transition");
  }) as unknown as typeof bookingRepository.confirmEligibleBooking;

  await assert.rejects(
    () =>
      bookingService.confirmBooking(
        { userId: "owner-user", role: "owner", profileId: ownerId },
        bookingId,
      ),
    (error: unknown) =>
      error instanceof AppError && error.code === "BOOKING_HOLD_EXPIRED",
  );
});

test("cash receipt retry repairs a succeeded payment and unpaid booking", async (context) => {
  const originalFindBooking = bookingRepository.findById;
  const originalMarkCash = bookingRepository.markConfirmedCashPaid;
  const originalFindCash = paymentRepository.findSucceededCashByBookingId;
  const originalPaymentUpdate = paymentRepository.updateById;
  const originalPaymentCreate = paymentRepository.create;
  context.after(() => {
    bookingRepository.findById = originalFindBooking;
    bookingRepository.markConfirmedCashPaid = originalMarkCash;
    paymentRepository.findSucceededCashByBookingId = originalFindCash;
    paymentRepository.updateById = originalPaymentUpdate;
    paymentRepository.create = originalPaymentCreate;
  });

  const cashReference = "CASH-REPAIR-1";
  const payment = {
    _id: "507f1f77bcf86cd799439099",
    bookingId,
    provider: "manual",
    mode: "live",
    status: "succeeded",
    transactionRef: cashReference,
    verifiedAt: new Date("2030-01-01T00:00:00.000Z"),
    reconciliationRequired: false,
  };
  const pendingBooking = {
    _id: bookingId,
    renterId,
    ownerId,
    status: "confirmed",
    paymentMethod: "cash",
    paymentStatus: "pending",
    cashReference,
    totalAmount: 1500,
    currency: "NPR",
  };
  bookingRepository.findById = (() =>
    Promise.resolve(pendingBooking)) as unknown as typeof bookingRepository.findById;
  paymentRepository.findSucceededCashByBookingId = (() =>
    Promise.resolve(payment)) as unknown as typeof paymentRepository.findSucceededCashByBookingId;
  bookingRepository.markConfirmedCashPaid = ((
    id: string,
    reference: string,
    receivedAt: Date,
  ) => {
    assert.equal(id, bookingId);
    assert.equal(reference, cashReference);
    assert.equal(receivedAt.toISOString(), payment.verifiedAt.toISOString());
    return Promise.resolve({ ...pendingBooking, paymentStatus: "paid" });
  }) as unknown as typeof bookingRepository.markConfirmedCashPaid;
  paymentRepository.create = (() => {
    assert.fail("a retry must not create a second cash payment");
  }) as unknown as typeof paymentRepository.create;
  paymentRepository.updateById = (() => {
    assert.fail("a reconciled receipt should not be flagged");
  }) as unknown as typeof paymentRepository.updateById;

  const result = await bookingService.confirmCashReceived(
    { userId: "owner-user", role: "owner", profileId: ownerId },
    bookingId,
  );
  assert.equal(result.booking.paymentStatus, "paid");
  assert.equal(result.payment, payment);
  assert.equal(result.repaired, true);
});
