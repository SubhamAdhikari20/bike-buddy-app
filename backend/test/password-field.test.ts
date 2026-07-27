import test from "node:test";
import assert from "node:assert/strict";
import RenterModel from "../src/models/renter.model.ts";
import OwnerModel from "../src/models/owner.model.ts";
import AdminModel from "../src/models/admin.model.ts";

test("role profile queries exclude password hashes by default", () => {
  for (const model of [RenterModel, OwnerModel, AdminModel]) {
    const passwordPath = model.schema.path("password");
    assert.equal(passwordPath.options.select, false);
  }
});
