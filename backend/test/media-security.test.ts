import assert from "node:assert/strict";
import test from "node:test";
import UserModel from "../src/models/user.model.ts";
import {
  deleteLocalUpload,
  localUploadPathFromUrl,
  uploadUrl,
} from "../src/utils/local-media.ts";
import { mediaUrlValidation } from "../src/schemas/media.schema.ts";

test("verification secrets are excluded from user queries by default", () => {
  for (const field of [
    "verifyCode",
    "verifyCodeExpiryDate",
    "verifyEmailResetPassword",
    "verifyEmailResetPasswordExpiryDate",
  ]) {
    assert.equal(UserModel.schema.path(field).options.select, false);
  }
});

test("new uploads return portable purpose-scoped paths", () => {
  assert.equal(
    uploadUrl("bike", "123-photo.jpg"),
    "/uploads/bike/123-photo.jpg",
  );
  assert.equal(
    uploadUrl("profile", "123-avatar.png"),
    "/uploads/profile/123-avatar.png",
  );
  assert.equal(
    uploadUrl("kyc", "123-id.webp"),
    "/api/v1/uploads/kyc/123-id.webp",
  );
});

test("media validation accepts portable uploads without path traversal", () => {
  for (const value of [
    "/uploads/bike/demo/pulsar-220f-1.jpg",
    "/uploads/profile/demo-admin.png",
    "/api/v1/uploads/kyc/demo-renter-id.png",
    "https://lh3.googleusercontent.com/avatar.jpg",
  ]) {
    assert.equal(mediaUrlValidation.safeParse(value).success, true, value);
  }

  assert.equal(
    mediaUrlValidation.parse(
      "http://10.0.2.2:5050/uploads/profile/123-avatar.png",
    ),
    "/uploads/profile/123-avatar.png",
  );

  for (const value of [
    "/uploads/bike/../kyc/private.jpg",
    "/uploads/kyc/private.jpg",
    "/api/v1/uploads/evidence/%2e%2e/private.jpg",
    "javascript:alert(1)",
  ]) {
    assert.equal(mediaUrlValidation.safeParse(value).success, false, value);
  }
});

test("versioned demo fixtures are protected from runtime cleanup", async () => {
  assert.equal(
    await deleteLocalUpload("/uploads/profile/demo-aashish.png"),
    false,
  );
  assert.equal(
    await deleteLocalUpload("/uploads/bike/demo/pulsar-220f-1.jpg"),
    false,
  );
});

test("local upload paths cannot escape their purpose folder", () => {
  assert.equal(
    localUploadPathFromUrl(
      "http://localhost:5050/uploads/profile/../../kyc/private.jpg",
    ),
    null,
  );
  assert.equal(
    localUploadPathFromUrl(
      "http://localhost:5050/uploads/not-allowed/example.jpg",
    ),
    null,
  );
  assert.equal(
    localUploadPathFromUrl("http://localhost:5050/uploads/profile/%zz.jpg"),
    null,
  );
  assert.match(
    localUploadPathFromUrl(
      "http://localhost:5050/uploads/profile/avatar.jpg",
    ) ?? "",
    /uploads[\\/]profile[\\/]avatar\.jpg$/,
  );
});
