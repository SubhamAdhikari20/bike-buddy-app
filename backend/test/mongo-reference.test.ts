import test from "node:test";
import assert from "node:assert/strict";
import {
  referencesDocument,
  toDocumentId,
} from "../src/utils/mongo-reference.ts";

test("Mongo references resolve from strings, ObjectIds and populated documents", () => {
  const id = "507f1f77bcf86cd799439011";
  const objectId = { toHexString: () => id };

  assert.equal(toDocumentId(id), id);
  assert.equal(toDocumentId(objectId), id);
  assert.equal(toDocumentId({ _id: objectId, fullName: "Bike owner" }), id);
  assert.equal(referencesDocument({ _id: id }, id), true);
  assert.equal(referencesDocument({ _id: id }, "different"), false);
  assert.equal(toDocumentId({ fullName: "No identifier" }), null);
});
