import assert from "node:assert/strict";
import test from "node:test";
import { checklistSchema } from "../src/schemas/booking.schema.ts";
import {
  damageReportSchema,
  damageStatusSchema,
  sosSchema,
} from "../src/routes/safety.routes.ts";
import { calculateLateFee } from "../src/services/booking.service.ts";

const checklistItems = [
  { key: "brakes", ok: true },
  { key: "lights", ok: true },
  { key: "fuel", ok: true },
  { key: "body", ok: false, note: "Existing scratch photographed" },
];

test("handover checklist requires every safety item and an acknowledgement", () => {
  assert.equal(
    checklistSchema.safeParse({
      items: checklistItems,
      photos: ["https://example.com/handover.jpg"],
      acknowledged: true,
    }).success,
    true,
  );
  assert.equal(
    checklistSchema.safeParse({
      items: checklistItems.slice(0, 3),
      acknowledged: true,
    }).success,
    false,
  );
  assert.equal(
    checklistSchema.safeParse({
      items: checklistItems,
      photos: ["https://example.com/handover.jpg"],
      acknowledged: false,
    }).success,
    false,
  );
  assert.equal(
    checklistSchema.safeParse({
      items: checklistItems,
      photos: [],
      acknowledged: true,
    }).success,
    false,
  );
});

test("damage and SOS payloads reject ambiguous or client-controlled data", () => {
  const bookingId = "507f1f77bcf86cd799439011";
  assert.equal(
    damageReportSchema.safeParse({
      bookingId,
      photos: ["https://example.com/damage.jpg"],
      description: "The mirror was damaged during the ride.",
    }).success,
    true,
  );
  assert.equal(
    damageReportSchema.safeParse({
      bookingId,
      photos: [],
      description: "Too short",
      status: "resolved",
    }).success,
    false,
  );
  assert.equal(
    sosSchema.safeParse({
      bookingId,
      latitude: 27.7172,
    }).success,
    false,
  );
  assert.equal(
    damageStatusSchema.safeParse({ status: "open" }).success,
    false,
  );
});

test("late fee applies only after the full grace period", () => {
  const end = new Date("2030-01-01T10:00:00Z");
  assert.deepEqual(
    calculateLateFee(end, new Date("2030-01-01T10:15:00Z"), 200),
    {
      onTime: true,
      lateMinutes: 15,
      lateFeeAmount: 0,
      graceMinutes: 15,
    },
  );
  assert.deepEqual(
    calculateLateFee(end, new Date("2030-01-01T10:16:00Z"), 200),
    {
      onTime: false,
      lateMinutes: 16,
      lateFeeAmount: 200,
      graceMinutes: 15,
    },
  );
});
