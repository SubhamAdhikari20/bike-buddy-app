import assert from "node:assert/strict";
import test from "node:test";
import {
  authCookieOptions,
  durationToMilliseconds,
} from "../src/utils/auth-cookie.ts";

test("cookie duration parser supports session units", () => {
  assert.equal(durationToMilliseconds("30d"), 2_592_000_000);
  assert.equal(durationToMilliseconds("12h"), 43_200_000);
  assert.equal(durationToMilliseconds("15m"), 900_000);
  assert.equal(durationToMilliseconds("45s"), 45_000);
});

test("auth cookie is inaccessible to JavaScript and scoped to the app", () => {
  assert.equal(authCookieOptions.httpOnly, true);
  assert.equal(authCookieOptions.sameSite, "lax");
  assert.equal(authCookieOptions.path, "/");
  assert.equal(authCookieOptions.maxAge, 2_592_000_000);
});
