import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import AppError from "../src/errors/AppError.ts";
import BookingModel from "../src/models/booking.model.ts";
import PaymentModel from "../src/models/payment.model.ts";
import { bookingRepository } from "../src/repositories/booking.repository.ts";
import { paymentRepository } from "../src/repositories/payment.repository.ts";
import {
  ESEWA_SANDBOX_FORM,
  createEsewaRequestSignature,
  createPaymentGateway,
  verifyEsewaCallbackData,
  type GatewayHttpClient,
  type GatewayHttpRequest,
} from "../src/services/payment-gateway.service.ts";
import paymentService from "../src/services/payment.service.ts";
import {
  createCheckoutToken,
  hashCheckoutToken,
  renderEsewaCheckoutHtml,
  verifyCheckoutToken,
} from "../src/utils/payment-checkout.ts";

const bookingId = "507f1f77bcf86cd799439011";
const paymentId = "507f1f77bcf86cd799439012";
const renterProfileId = "507f1f77bcf86cd799439013";

const mockHttp = (
  response: { status: number; body: unknown },
  inspect?: (url: string, request: GatewayHttpRequest) => void,
): GatewayHttpClient => async (url, request) => {
  inspect?.(url, request);
  return response;
};

test("Khalti sandbox initiation is server-side and sends integer paisa", async () => {
  let authorization = "";
  const gateway = createPaymentGateway(
    mockHttp(
      {
        status: 200,
        body: {
          pidx: "sandbox-pidx",
          payment_url: "https://test-pay.khalti.com/?pidx=sandbox-pidx",
          expires_at: "2030-01-01T10:00:00.000Z",
        },
      },
      (url, request) => {
        assert.equal(
          url,
          "https://dev.khalti.com/api/v2/epayment/initiate/",
        );
        authorization = request.headers?.Authorization ?? "";
        assert.deepEqual(JSON.parse(request.body ?? "{}"), {
          return_url: "https://demo.example/api/v1/payments/callback/khalti",
          website_url: "https://demo.example",
          amount: 125050,
          purchase_order_id: "BB-ORDER-1",
          purchase_order_name: "Bike Buddy booking 9439011",
        });
      },
    ),
  );

  const result = await gateway.initiateKhalti({
    secretKey: "server-only-test-key",
    callbackUrl: "https://demo.example/api/v1/payments/callback/khalti",
    websiteUrl: "https://demo.example",
    amountMinor: 125050,
    transactionRef: "BB-ORDER-1",
    bookingLabel: "Bike Buddy booking 9439011",
    timeoutMs: 5000,
  });

  assert.equal(authorization, "Key server-only-test-key");
  assert.equal(result.pidx, "sandbox-pidx");
  assert.equal(
    result.paymentUrl,
    "https://test-pay.khalti.com/?pidx=sandbox-pidx",
  );
});

test("Khalti grants success only for matching, unrefunded Completed lookup", async () => {
  const completed = createPaymentGateway(
    mockHttp({
      status: 200,
      body: {
        pidx: "pidx-1",
        total_amount: 420000,
        status: "Completed",
        transaction_id: "gateway-transaction",
        refunded: false,
      },
    }),
  );
  const result = await completed.lookupKhalti({
    secretKey: "secret",
    pidx: "pidx-1",
    amountMinor: 420000,
    timeoutMs: 5000,
  });
  assert.equal(result.state, "succeeded");

  const mismatched = createPaymentGateway(
    mockHttp({
      status: 200,
      body: {
        pidx: "pidx-1",
        total_amount: 1,
        status: "Completed",
        transaction_id: "gateway-transaction",
        refunded: false,
      },
    }),
  );
  await assert.rejects(
    () =>
      mismatched.lookupKhalti({
        secretKey: "secret",
        pidx: "pidx-1",
        amountMinor: 420000,
        timeoutMs: 5000,
      }),
    (error: unknown) =>
      error instanceof AppError &&
      error.code === "PAYMENT_VERIFICATION_MISMATCH",
  );

  const inconsistent = createPaymentGateway(
    mockHttp({
      status: 200,
      body: {
        pidx: "pidx-1",
        total_amount: 420000,
        status: "Completed",
        transaction_id: "gateway-transaction",
        refunded: true,
      },
    }),
  );
  await assert.rejects(
    () =>
      inconsistent.lookupKhalti({
        secretKey: "secret",
        pidx: "pidx-1",
        amountMinor: 420000,
        timeoutMs: 5000,
      }),
    (error: unknown) =>
      error instanceof AppError && error.code === "INVALID_PROVIDER_RESPONSE",
  );
});

test("Khalti maps its documented HTTP 400 cancellation to a verified failure", async () => {
  const gateway = createPaymentGateway(
    mockHttp({
      status: 400,
      body: {
        pidx: "pidx-cancelled",
        total_amount: 1000,
        status: "User canceled",
        transaction_id: null,
        refunded: false,
      },
    }),
  );
  const result = await gateway.lookupKhalti({
    secretKey: "secret",
    pidx: "pidx-cancelled",
    amountMinor: 1000,
    timeoutMs: 5000,
  });
  assert.equal(result.state, "failed");
  assert.equal(result.providerStatus, "User canceled");
});

test("eSewa request signature uses the official exact field order", () => {
  assert.equal(
    createEsewaRequestSignature(
      "100",
      "11-201-13",
      "unit-test-secret",
    ),
    "XK+Yc4DxdrOGmiji8b0kQE5R56NZeijAmF6gbDrg+l4=",
  );
});

test("eSewa callback requires its exact signed-field order and integrity", () => {
  const secret = "sandbox-signature-secret";
  const signedFieldNames =
    "transaction_code,status,total_amount,transaction_uuid,product_code,signed_field_names";
  const payload: Record<string, string> = {
    transaction_code: "000AWEO",
    status: "COMPLETE",
    total_amount: "1000.0",
    transaction_uuid: "BB-ORDER-2",
    product_code: "EPAYTEST",
    signed_field_names: signedFieldNames,
  };
  const message = signedFieldNames
    .split(",")
    .map((field) => `${field}=${payload[field]}`)
    .join(",");
  payload.signature = crypto
    .createHmac("sha256", secret)
    .update(message)
    .digest("base64");
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64");

  assert.deepEqual(verifyEsewaCallbackData(encoded, secret), {
    transactionCode: "000AWEO",
    status: "COMPLETE",
    totalAmountMinor: 100000,
    transactionRef: "BB-ORDER-2",
    productCode: "EPAYTEST",
  });

  payload.total_amount = "1.0";
  const tampered = Buffer.from(JSON.stringify(payload)).toString("base64");
  assert.throws(
    () => verifyEsewaCallbackData(tampered, secret),
    (error: unknown) =>
      error instanceof AppError && error.code === "INVALID_CALLBACK_SIGNATURE",
  );
});

test("eSewa status lookup verifies transaction, product, amount and COMPLETE", async () => {
  const gateway = createPaymentGateway(
    mockHttp(
      {
        status: 200,
        body: {
          product_code: "EPAYTEST",
          transaction_uuid: "BB-ORDER-3",
          total_amount: 2500,
          status: "COMPLETE",
          ref_id: "ESEWA-REFERENCE",
        },
      },
      (url, request) => {
        const parsed = new URL(url);
        assert.equal(request.method, "GET");
        assert.equal(parsed.searchParams.get("product_code"), "EPAYTEST");
        assert.equal(parsed.searchParams.get("total_amount"), "2500");
        assert.equal(parsed.searchParams.get("transaction_uuid"), "BB-ORDER-3");
      },
    ),
  );
  const result = await gateway.lookupEsewa({
    transactionRef: "BB-ORDER-3",
    amountMinor: 250000,
    timeoutMs: 5000,
  });
  assert.equal(result.state, "succeeded");
  assert.equal(result.providerTransactionId, "ESEWA-REFERENCE");
});

test("short-lived checkout tokens detect tampering and expiry", () => {
  const secret = "a-strong-checkout-secret-with-32-characters";
  const now = new Date("2030-01-01T00:00:00.000Z");
  const token = createCheckoutToken(
    paymentId,
    "BB-ORDER-4",
    new Date(now.getTime() + 5 * 60 * 1000),
    secret,
  );
  const verified = verifyCheckoutToken(token, secret, now);
  assert.equal(verified.paymentId, paymentId);
  assert.equal(verified.transactionRef, "BB-ORDER-4");
  assert.equal(hashCheckoutToken(token).length, 64);
  assert.throws(
    () => verifyCheckoutToken(`${token}x`, secret, now),
    (error: unknown) =>
      error instanceof AppError && error.code === "INVALID_CHECKOUT_LINK",
  );
  assert.throws(
    () =>
      verifyCheckoutToken(
        token,
        secret,
        new Date(now.getTime() + 6 * 60 * 1000),
      ),
    (error: unknown) =>
      error instanceof AppError && error.code === "CHECKOUT_EXPIRED",
  );
});

test("eSewa bridge escapes every field and keeps a manual-submit fallback", () => {
  const html = renderEsewaCheckoutHtml(
    {
      amount: "100",
      success_url: 'https://safe.example/callback?value="><script>alert(1)</script>',
    },
    "safe-nonce",
  );
  assert.match(html, new RegExp(`action="${ESEWA_SANDBOX_FORM}"`));
  assert.match(html, /Continue to eSewa test checkout/);
  assert.match(html, /nonce="safe-nonce"/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test("payment schemas support sandbox and enforce one pending attempt", () => {
  assert.deepEqual(PaymentModel.schema.path("mode").options.enum, [
    "demo",
    "sandbox",
    "live",
  ]);
  assert.deepEqual(BookingModel.schema.path("paymentMode").options.enum, [
    "demo",
    "sandbox",
    "live",
  ]);
  assert.equal(PaymentModel.schema.path("amountMinor").options.immutable, true);
  assert.equal(
    PaymentModel.schema.path("transactionRef").options.immutable,
    true,
  );
  const indexes = PaymentModel.schema.indexes();
  assert.ok(
    indexes.some(
      ([fields, options]) =>
        fields.bookingId === 1 &&
        options.unique === true &&
        options.partialFilterExpression?.status === "pending",
    ),
  );
  assert.ok(
    indexes.some(
      ([fields, options]) =>
        fields.providerPaymentId === 1 &&
        options.unique === true &&
        options.partialFilterExpression?.providerPaymentId?.$type === "string",
    ),
  );
  assert.deepEqual(
    paymentRepository
      .findPendingByBookingAndProvider(bookingId, "khalti", "sandbox")
      .getFilter(),
    {
      bookingId,
      provider: "khalti",
      mode: "sandbox",
      status: "pending",
    },
  );
  const transitionTime = new Date("2030-01-01T00:00:00.000Z");
  assert.deepEqual(
    bookingRepository
      .markPendingWalletPaid(bookingId, "sandbox", transitionTime)
      .getFilter(),
    {
      _id: bookingId,
      status: "pending",
      startDate: { $gt: transitionTime },
      holdExpiresAt: { $gt: transitionTime },
      paymentStatus: { $in: ["unpaid", "pending", "failed"] },
      paymentMethod: { $in: [null, "wallet"] },
    },
  );
  assert.deepEqual(
    paymentRepository.claimKhaltiInitiation(paymentId).getFilter(),
    {
      _id: paymentId,
      provider: "khalti",
      mode: "sandbox",
      status: "pending",
      providerPaymentId: { $exists: false },
      $or: [
        { providerStatus: null },
        { providerStatus: { $exists: false } },
      ],
    },
  );
  assert.deepEqual(
    bookingRepository
      .claimPendingForWallet(bookingId, transitionTime, "sandbox")
      .getFilter(),
    {
      _id: bookingId,
      status: "pending",
      startDate: { $gt: transitionTime },
      holdExpiresAt: { $gt: transitionTime },
      paymentStatus: { $in: ["unpaid", "failed", "pending"] },
      paymentMethod: { $in: [null, "wallet"] },
    },
  );
});

test("verified payment repairs only a pending non-cash booking", async (context) => {
  const originalPaymentFind = paymentRepository.findById;
  const originalPaymentUpdate = paymentRepository.updateById;
  const originalBookingFind = bookingRepository.findById;
  const originalMarkPaid = bookingRepository.markPendingWalletPaid;
  const originalExpireHold = bookingRepository.expireUnpaidHoldById;
  context.after(() => {
    paymentRepository.findById = originalPaymentFind;
    paymentRepository.updateById = originalPaymentUpdate;
    bookingRepository.findById = originalBookingFind;
    bookingRepository.markPendingWalletPaid = originalMarkPaid;
    bookingRepository.expireUnpaidHoldById = originalExpireHold;
  });

  const payment = {
    _id: paymentId,
    bookingId: { _id: bookingId, renterId: renterProfileId },
    provider: "esewa",
    mode: "demo",
    status: "succeeded",
    reconciliationRequired: false,
  };
  paymentRepository.findById = (() =>
    Promise.resolve(payment)) as unknown as typeof paymentRepository.findById;
  bookingRepository.findById = (() =>
    Promise.resolve({
      _id: bookingId,
      status: "pending",
      paymentStatus: "unpaid",
      paymentMethod: null,
    })) as unknown as typeof bookingRepository.findById;
  let transitionCalled = false;
  bookingRepository.markPendingWalletPaid = ((id: string, mode: string) => {
    transitionCalled = true;
    assert.equal(id, bookingId);
    assert.equal(mode, "demo");
    return Promise.resolve({ _id: bookingId, status: "pending" });
  }) as unknown as typeof bookingRepository.markPendingWalletPaid;
  paymentRepository.updateById = (() => {
    assert.fail("a matching pending booking must not be flagged for reconciliation");
  }) as unknown as typeof paymentRepository.updateById;

  const status = await paymentService.getPaymentStatus(
    { userId: "renter-user", role: "renter", profileId: renterProfileId },
    paymentId,
  );
  assert.equal(transitionCalled, true);
  assert.deepEqual(status, {
    paymentId,
    bookingId,
    provider: "esewa",
    mode: "demo",
    status: "succeeded",
    paid: true,
    terminal: true,
    message:
      "Demo payment approved. No money was charged; the booking is awaiting owner approval.",
  });
});

test("late provider settlement never revives a closed booking", async (context) => {
  const originalPaymentFind = paymentRepository.findById;
  const originalPaymentUpdate = paymentRepository.updateById;
  const originalBookingFind = bookingRepository.findById;
  const originalMarkPaid = bookingRepository.markPendingWalletPaid;
  context.after(() => {
    paymentRepository.findById = originalPaymentFind;
    paymentRepository.updateById = originalPaymentUpdate;
    bookingRepository.findById = originalBookingFind;
    bookingRepository.markPendingWalletPaid = originalMarkPaid;
  });

  let current: any = {
    _id: paymentId,
    bookingId: { _id: bookingId, renterId: renterProfileId },
    provider: "khalti",
    mode: "demo",
    status: "succeeded",
    reconciliationRequired: false,
  };
  paymentRepository.findById = (() =>
    Promise.resolve(current)) as unknown as typeof paymentRepository.findById;
  bookingRepository.findById = (() =>
    Promise.resolve({
      _id: bookingId,
      status: "cancelled",
      paymentStatus: "failed",
      paymentMethod: "wallet",
    })) as unknown as typeof bookingRepository.findById;
  bookingRepository.markPendingWalletPaid = (() =>
    Promise.resolve(null)) as unknown as typeof bookingRepository.markPendingWalletPaid;
  bookingRepository.expireUnpaidHoldById = (() =>
    Promise.resolve(null)) as unknown as typeof bookingRepository.expireUnpaidHoldById;
  paymentRepository.updateById = ((_id: string, update: Record<string, unknown>) => {
    current = { ...current, ...update };
    return Promise.resolve(current);
  }) as unknown as typeof paymentRepository.updateById;

  const status = await paymentService.getPaymentStatus(
    { userId: "renter-user", role: "renter", profileId: renterProfileId },
    paymentId,
  );
  assert.equal(status.status, "succeeded");
  assert.equal(status.paid, false);
  assert.equal(status.terminal, false);
  assert.match(status.message, /not revived/i);
});

test("wallet initiation is blocked while cash at pickup is active", async (context) => {
  const originalBookingFind = bookingRepository.findById;
  context.after(() => {
    bookingRepository.findById = originalBookingFind;
  });
  bookingRepository.findById = (() =>
    Promise.resolve({
      _id: bookingId,
      renterId: renterProfileId,
      status: "pending",
      paymentStatus: "pending",
      paymentMethod: "cash",
      holdExpiresAt: new Date(Date.now() + 60_000),
      startDate: new Date(Date.now() + 60 * 60_000),
      totalAmount: 1000,
      currency: "NPR",
    })) as unknown as typeof bookingRepository.findById;

  await assert.rejects(
    () =>
      paymentService.initiatePayment(
        {
          userId: "renter-user",
          role: "renter",
          profileId: renterProfileId,
        },
        { bookingId, provider: "khalti" },
      ),
    (error: unknown) =>
      error instanceof AppError && error.code === "PAYMENT_ATTEMPT_ACTIVE",
  );
});

test("wallet initiation cannot overwrite a concurrent booking change", async (context) => {
  const originalBookingFind = bookingRepository.findById;
  const originalClaim = bookingRepository.claimPendingForWallet;
  const originalExpire = bookingRepository.expireUnpaidHoldById;
  const originalFindPending = paymentRepository.findPendingByBookingId;
  const originalCreate = paymentRepository.create;
  const originalTransition = paymentRepository.transitionPendingById;
  context.after(() => {
    bookingRepository.findById = originalBookingFind;
    bookingRepository.claimPendingForWallet = originalClaim;
    bookingRepository.expireUnpaidHoldById = originalExpire;
    paymentRepository.findPendingByBookingId = originalFindPending;
    paymentRepository.create = originalCreate;
    paymentRepository.transitionPendingById = originalTransition;
  });

  let bookingReads = 0;
  bookingRepository.findById = (() => {
    bookingReads += 1;
    return Promise.resolve(
      bookingReads === 1
        ? {
            _id: bookingId,
            renterId: renterProfileId,
            status: "pending",
            paymentStatus: "unpaid",
            paymentMethod: null,
            holdExpiresAt: new Date(Date.now() + 60_000),
            startDate: new Date(Date.now() + 60 * 60_000),
            totalAmount: 1000,
            currency: "NPR",
          }
        : {
            _id: bookingId,
            renterId: renterProfileId,
            status: "cancelled",
            paymentStatus: "unpaid",
            paymentMethod: null,
          },
    );
  }) as unknown as typeof bookingRepository.findById;
  bookingRepository.claimPendingForWallet = (() =>
    Promise.resolve(null)) as unknown as typeof bookingRepository.claimPendingForWallet;
  bookingRepository.expireUnpaidHoldById = (() =>
    Promise.resolve(null)) as unknown as typeof bookingRepository.expireUnpaidHoldById;
  paymentRepository.findPendingByBookingId = (() =>
    Promise.resolve(null)) as unknown as typeof paymentRepository.findPendingByBookingId;
  const createdPayment = {
    _id: paymentId,
    bookingId,
    provider: "khalti",
    mode: "demo",
    status: "pending",
    amount: 1000,
    amountMinor: 100000,
    currency: "NPR",
    transactionRef: "BB-RACE",
  };
  paymentRepository.create = (() =>
    Promise.resolve(createdPayment)) as unknown as typeof paymentRepository.create;
  let cleanupPayload: Record<string, unknown> | null = null;
  paymentRepository.transitionPendingById = ((
    _id: string,
    payload: Record<string, unknown>,
  ) => {
    cleanupPayload = payload;
    return Promise.resolve({ ...createdPayment, ...payload });
  }) as unknown as typeof paymentRepository.transitionPendingById;

  await assert.rejects(
    () =>
      paymentService.initiatePayment(
        {
          userId: "renter-user",
          role: "renter",
          profileId: renterProfileId,
        },
        { bookingId, provider: "khalti" },
      ),
    (error: unknown) =>
      error instanceof AppError && error.code === "BOOKING_STATE_CHANGED",
  );
  assert.equal(cleanupPayload?.status, "failed");
});

test("demo confirmation returns reconciled persisted state after hold expiry", async (context) => {
  const originalPaymentFind = paymentRepository.findById;
  const originalPaymentTransition = paymentRepository.transitionPendingById;
  const originalPaymentUpdate = paymentRepository.updateById;
  const originalBookingFind = bookingRepository.findById;
  const originalMarkPaid = bookingRepository.markPendingWalletPaid;
  const originalExpire = bookingRepository.expireUnpaidHoldById;
  context.after(() => {
    paymentRepository.findById = originalPaymentFind;
    paymentRepository.transitionPendingById = originalPaymentTransition;
    paymentRepository.updateById = originalPaymentUpdate;
    bookingRepository.findById = originalBookingFind;
    bookingRepository.markPendingWalletPaid = originalMarkPaid;
    bookingRepository.expireUnpaidHoldById = originalExpire;
  });

  let currentPayment: any = {
    _id: paymentId,
    bookingId: { _id: bookingId, renterId: renterProfileId },
    provider: "esewa",
    mode: "demo",
    status: "pending",
    amount: 1000,
    amountMinor: 100000,
    currency: "NPR",
    transactionRef: "BB-EXPIRED",
    reconciliationRequired: false,
  };
  paymentRepository.findById = (() =>
    Promise.resolve(currentPayment)) as unknown as typeof paymentRepository.findById;
  paymentRepository.transitionPendingById = ((
    _id: string,
    payload: Record<string, unknown>,
  ) => {
    currentPayment = { ...currentPayment, ...payload };
    return Promise.resolve(currentPayment);
  }) as unknown as typeof paymentRepository.transitionPendingById;
  bookingRepository.findById = (() =>
    Promise.resolve({
      _id: bookingId,
      status: "pending",
      paymentStatus: "pending",
      paymentMethod: "wallet",
      holdExpiresAt: new Date(Date.now() - 60_000),
      startDate: new Date(Date.now() + 60 * 60_000),
    })) as unknown as typeof bookingRepository.findById;
  bookingRepository.markPendingWalletPaid = (() =>
    Promise.resolve(null)) as unknown as typeof bookingRepository.markPendingWalletPaid;
  bookingRepository.expireUnpaidHoldById = (() =>
    Promise.resolve({
      _id: bookingId,
      status: "expired",
      paymentStatus: "pending",
    })) as unknown as typeof bookingRepository.expireUnpaidHoldById;
  paymentRepository.updateById = ((
    _id: string,
    payload: Record<string, unknown>,
  ) => {
    currentPayment = { ...currentPayment, ...payload };
    return Promise.resolve(currentPayment);
  }) as unknown as typeof paymentRepository.updateById;

  const result = await paymentService.confirmDemoPayment(
    { userId: "renter-user", role: "renter", profileId: renterProfileId },
    paymentId,
    { outcome: "succeeded" },
  );
  assert.equal(result.succeeded, false);
  assert.equal(result.payment.status, "succeeded");
  assert.equal(result.payment.reconciliationRequired, true);
  assert.match(result.message, /no booking access was granted/i);
});
