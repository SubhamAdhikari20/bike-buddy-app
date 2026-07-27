import assert from "node:assert/strict";
import test from "node:test";
import BookingModel from "../src/models/booking.model.ts";
import {
  createTicketSchema,
  rateTicketSchema,
  ticketStatusSchema,
} from "../src/routes/support.routes.ts";
import {
  emptyBookingActionSchema,
  rescheduleBookingSchema,
} from "../src/schemas/booking.schema.ts";
import { buildCancellationPolicy } from "../src/services/booking.service.ts";

test("support payloads prevent client-controlled priority and workflow state", () => {
  const valid = {
    type: "breakdown",
    subject: "Bike stopped",
    message: "The engine stopped near the pickup route.",
    bookingId: "507f1f77bcf86cd799439011",
  };
  assert.equal(createTicketSchema.safeParse(valid).success, true);
  assert.equal(
    createTicketSchema.safeParse({ ...valid, priority: "high" }).success,
    false,
  );
  assert.equal(
    createTicketSchema.safeParse({ ...valid, status: "resolved" }).success,
    false,
  );
  assert.equal(ticketStatusSchema.safeParse({ status: "open" }).success, false);
  assert.equal(rateTicketSchema.safeParse({ rating: 6 }).success, false);
});

test("cash and reschedule actions accept only their intended fields", () => {
  assert.equal(emptyBookingActionSchema.safeParse({}).success, true);
  assert.equal(
    emptyBookingActionSchema.safeParse({ amount: 1 }).success,
    false,
  );
  assert.equal(
    rescheduleBookingSchema.safeParse({
      startDate: "2030-04-01T10:00:00.000Z",
    }).success,
    true,
  );
  assert.equal(
    rescheduleBookingSchema.safeParse({
      startDate: "2030-04-01T10:00:00.000Z",
      totalAmount: 1,
    }).success,
    false,
  );
  assert.deepEqual(BookingModel.schema.path("paymentMethod").options.enum, [
    "wallet",
    "cash",
  ]);
  assert.equal(BookingModel.schema.path("cashReference").options.sparse, true);
});

test("cancellation policy distinguishes unpaid, demo and unsupported refunds", () => {
  const now = new Date("2030-01-01T00:00:00.000Z");
  const base = {
    startDate: new Date("2030-01-02T00:00:00.000Z"),
    status: "confirmed",
    totalAmount: 5000,
  };

  const unpaid = buildCancellationPolicy(
    { ...base, paymentStatus: "pending", paymentMethod: "cash" },
    now,
  );
  assert.equal(unpaid.refundPercent, 0);
  assert.equal(unpaid.refundWorkflowAvailable, true);

  const demo = buildCancellationPolicy(
    { ...base, paymentStatus: "paid", paymentMode: "demo" },
    now,
  );
  assert.equal(demo.estimatedRefundAmount, 5000);
  assert.equal(demo.refundWorkflowAvailable, true);

  const cash = buildCancellationPolicy(
    { ...base, paymentStatus: "paid", paymentMethod: "cash" },
    now,
  );
  assert.equal(cash.refundWorkflowAvailable, false);
  assert.match(cash.notice, /disabled/i);
});
