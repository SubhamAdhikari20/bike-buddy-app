import assert from "node:assert/strict";
import test from "node:test";
import { toSafeProfile, toSafeUser } from "../src/utils/auth-response.ts";

test("auth response removes credentials and private verification data", () => {
  const user = toSafeUser({
    _id: "user-1",
    email: "renter@example.com",
    role: "renter",
    isVerified: true,
    verifyCode: "hashed-otp",
    verifyEmailResetPassword: "hashed-reset-code",
  });
  const profile = toSafeProfile({
    _id: "profile-1",
    fullName: "Maya Shrestha",
    password: "bcrypt-hash",
    googleId: "google-subject",
    idDocumentUrl: "https://private.example/id.jpg",
    kycStatus: "pending",
    ownerNotes: "internal moderation note",
  });

  assert.deepEqual(user, {
    id: "user-1",
    email: "renter@example.com",
    role: "renter",
    isVerified: true,
  });
  assert.equal(profile.id, "profile-1");
  assert.equal(profile.fullName, "Maya Shrestha");
  assert.equal(profile.kycStatus, "pending");
  assert.equal("password" in profile, false);
  assert.equal("googleId" in profile, false);
  assert.equal("idDocumentUrl" in profile, false);
  assert.equal("ownerNotes" in profile, false);
});

test("auth response accepts mongoose-style documents", () => {
  const profile = toSafeProfile({
    toObject: () => ({
      _id: "profile-2",
      fullName: "Aashish Thapa",
      password: "never-return-this",
    }),
  });

  assert.deepEqual(profile, {
    id: "profile-2",
    fullName: "Aashish Thapa",
  });
});
