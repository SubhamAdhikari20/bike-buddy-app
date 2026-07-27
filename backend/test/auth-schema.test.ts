import assert from "node:assert/strict";
import test from "node:test";
import {
  googleRenterAuthSchema,
  resetPasswordSchema,
} from "../src/schemas/auth.schema.ts";

test("password reset requires email, six-digit code and a strong password", () => {
  const valid = resetPasswordSchema.safeParse({
    email: "maya@example.com",
    code: "123456",
    password: "Password@123",
  });
  const invalid = resetPasswordSchema.safeParse({
    email: "maya@example.com",
    code: "12345",
    password: "weak",
  });

  assert.equal(valid.success, true);
  assert.equal(invalid.success, false);
});

test("Google renter auth requires a token and explicit terms acceptance", () => {
  const valid = googleRenterAuthSchema.safeParse({
    idToken: "x".repeat(100),
    terms: true,
  });
  const missingTerms = googleRenterAuthSchema.safeParse({
    idToken: "x".repeat(100),
    terms: false,
  });

  assert.equal(valid.success, true);
  assert.equal(missingTerms.success, false);
});
