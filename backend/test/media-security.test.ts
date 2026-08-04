import assert from "node:assert/strict";
import test from "node:test";
import UserModel from "../src/models/user.model.ts";
import { localUploadPathFromUrl } from "../src/utils/local-media.ts";

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
