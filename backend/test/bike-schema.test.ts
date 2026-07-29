import test from "node:test";
import assert from "node:assert/strict";
import {
  bikeListQuerySchema,
  createBikeSchema,
  updateBikeSchema,
} from "../src/schemas/bike.schema.ts";

test("bike discovery schema supports sprint-2 categories and landmarks", () => {
  const bike = createBikeSchema.parse({
    ownerId: "507f1f77bcf86cd799439011",
    title: "City commuter",
    brand: "Honda",
    model: "Shine",
    year: 2025,
    engineCc: 125,
    fuelType: "petrol",
    transmission: "manual",
    condition: "excellent",
    category: "commuter",
    pricePerDay: 1500,
    location: {
      label: "Thamel pickup",
      address: "Tridevi Marg",
      city: "Kathmandu",
      landmark: "Near Garden of Dreams",
    },
  });

  assert.equal(bike.category, "commuter");
  assert.equal(bike.location.landmark, "Near Garden of Dreams");

  const query = bikeListQuerySchema.parse({
    category: "electric",
    sortBy: "rating",
    includeUnavailable: "false",
  });
  assert.equal(query.category, "electric");
  assert.equal(query.sortBy, "rating");
  assert.equal(query.includeUnavailable, false);
});

test("bike updates do not inject create-time defaults", () => {
  const result = updateBikeSchema.parse({ title: "Changed title" });

  assert.deepEqual(result, { title: "Changed title" });
  assert.equal("status" in result, false);
  assert.equal("tags" in result, false);
  assert.equal("images" in result, false);
  assert.equal("verifiedBike" in result, false);
});
