import test from "node:test";
import assert from "node:assert/strict";
import errorHandler from "../src/middlewares/errorHandler.ts";

const handle = (error: unknown) => {
  let statusCode = 0;
  let payload: Record<string, unknown> = {};
  const response = {
    headersSent: false,
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: Record<string, unknown>) {
      payload = body;
      return this;
    },
  };

  errorHandler(
    error,
    {} as never,
    response as never,
    (() => undefined) as never,
  );
  return { statusCode, payload };
};

test("database errors become safe and actionable API responses", () => {
  const castResult = handle({ name: "CastError", value: "not-an-object-id" });
  assert.equal(castResult.statusCode, 400);
  assert.equal(castResult.payload.code, "INVALID_IDENTIFIER");
  assert.equal("value" in castResult.payload, false);

  const duplicateResult = handle({ code: 11000, keyValue: { email: "x" } });
  assert.equal(duplicateResult.statusCode, 409);
  assert.equal(duplicateResult.payload.code, "DUPLICATE_RECORD");
  assert.equal("keyValue" in duplicateResult.payload, false);
});
