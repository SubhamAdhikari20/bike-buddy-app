import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPriceBreakdown,
  calculateRentalDays,
} from "../src/services/booking.service.ts";
import {
  adminPaymentStatusSchema,
  demoPaymentConfirmationSchema,
  initiatePaymentSchema,
} from "../src/schemas/payment.schema.ts";
import PaymentModel from "../src/models/payment.model.ts";

test("booking totals include every displayed charge and refundable deposit", () => {
  const start = new Date("2030-01-01T10:00:00Z");
  const end = new Date("2030-01-03T10:00:00Z");
  const breakdown = buildPriceBreakdown(
    { pricePerDay: 1500, serviceFee: 200, securityDeposit: 1000 },
    start,
    end,
  );

  assert.equal(calculateRentalDays(start, end), 2);
  assert.deepEqual(breakdown, {
    pricePerDay: 1500,
    rentalDays: 2,
    baseAmount: 3000,
    serviceFee: 200,
    securityDeposit: 1000,
    total: 4200,
  });
});

test("payment input cannot provide an amount, transaction ref or live status", () => {
  assert.equal(
    initiatePaymentSchema.safeParse({
      bookingId: "booking-id",
      provider: "esewa",
    }).success,
    true,
  );
  assert.equal(
    initiatePaymentSchema.safeParse({
      bookingId: "booking-id",
      provider: "esewa",
      amount: 1,
      transactionRef: "client-controlled",
    }).success,
    false,
  );
  assert.equal(
    demoPaymentConfirmationSchema.safeParse({
      outcome: "succeeded",
      gatewayMessage: "client-controlled",
    }).success,
    false,
  );
  assert.equal(
    adminPaymentStatusSchema.safeParse({ status: "succeeded" }).success,
    false,
  );
  assert.equal(PaymentModel.schema.path("mode").options.default, "demo");
});
