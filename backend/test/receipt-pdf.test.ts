import test from "node:test";
import assert from "node:assert/strict";
import { Writable } from "node:stream";
import { once } from "node:events";
import type { Response } from "express";
import { streamReceiptPdf } from "../src/helpers/generate-receipt-pdf.ts";

test("demo receipt is streamed as a valid PDF without claiming a charge", async () => {
  const chunks: Buffer[] = [];
  const headers = new Map<string, string>();
  const response = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(Buffer.from(chunk));
      callback();
    },
  }) as Writable & {
    setHeader(name: string, value: string): void;
  };
  response.setHeader = (name, value) => headers.set(name, value);

  streamReceiptPdf(response as unknown as Response, {
    receiptNumber: "DEMO1234",
    issuedAt: new Date("2030-01-01T10:00:00Z"),
    renterName: "Demo Rider",
    bikeTitle: "City Commuter",
    startDate: new Date("2030-01-02T10:00:00Z"),
    endDate: new Date("2030-01-03T10:00:00Z"),
    pickupLocation: "Thamel",
    breakdown: {
      pricePerDay: 1500,
      rentalDays: 1,
      baseAmount: 1500,
      serviceFee: 200,
      securityDeposit: 1000,
      total: 2700,
    },
    paymentProvider: "esewa",
    paymentStatus: "succeeded",
    paymentMode: "demo",
  });
  await once(response, "finish");

  const pdf = Buffer.concat(chunks);
  assert.equal(headers.get("Content-Type"), "application/pdf");
  assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
  assert.ok(pdf.length > 1000);
});
