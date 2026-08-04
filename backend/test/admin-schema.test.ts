import test from "node:test";
import assert from "node:assert/strict";
import {
  bikeStatusSchema,
  kycListQuerySchema,
  ownerListQuerySchema,
  ownerVerificationSchema,
} from "../src/schemas/admin.schema.ts";

test("admin moderation accepts only known state transitions", () => {
  assert.equal(
    ownerVerificationSchema.parse({ status: "verified" }).status,
    "verified",
  );
  assert.equal(
    ownerVerificationSchema.safeParse({ status: "trusted" }).success,
    false,
  );
  assert.equal(
    bikeStatusSchema.safeParse({ status: "deleted" }).success,
    false,
  );

  const query = ownerListQuerySchema.parse({
    page: "2",
    limit: "20",
    status: "pending",
  });
  assert.deepEqual(query, { page: 2, limit: 20, status: "pending" });

  assert.deepEqual(kycListQuerySchema.parse({}), {
    page: 1,
    limit: 20,
    status: "pending",
  });
  assert.equal(
    kycListQuerySchema.safeParse({ status: "trusted" }).success,
    false,
  );
});
