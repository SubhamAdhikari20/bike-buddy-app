import PaymentModel from "../models/payment.model.ts";
import type { PaymentMode } from "../config/index.ts";

export const paymentRepository = {
  create: (payload: Record<string, unknown>) => PaymentModel.create(payload),
  findById: (paymentId: string) =>
    PaymentModel.findById(paymentId)
      .populate("bookingId")
      .populate("payerId", "_id email role"),
  findByTransactionRef: (transactionRef: string) =>
    PaymentModel.findOne({ transactionRef }),
  findByProviderPaymentId: (providerPaymentId: string) =>
    PaymentModel.findOne({ providerPaymentId }),
  findByBookingId: (bookingId: string) =>
    PaymentModel.findOne({ bookingId }).sort({ createdAt: -1 }),
  findSucceededByBookingId: (bookingId: string) =>
    PaymentModel.findOne({ bookingId, status: "succeeded" }).sort({
      verifiedAt: -1,
      updatedAt: -1,
    }),
  findSucceededCashByBookingId: (
    bookingId: string,
    transactionRef: string,
  ) =>
    PaymentModel.findOne({
      bookingId,
      provider: "manual",
      mode: "live",
      transactionRef,
      status: "succeeded",
    }).sort({ verifiedAt: -1, updatedAt: -1 }),
  findPendingByBookingId: (bookingId: string) =>
    PaymentModel.findOne({ bookingId, status: "pending" }).sort({
      createdAt: -1,
    }),
  findPendingByBookingAndProvider: (
    bookingId: string,
    provider: "khalti" | "esewa" | "manual",
    mode: PaymentMode,
  ) =>
    PaymentModel.findOne({
      bookingId,
      provider,
      mode,
      status: "pending",
    }).sort({ createdAt: -1 }),
  updateById: (paymentId: string, payload: Record<string, unknown>) =>
    PaymentModel.findByIdAndUpdate(paymentId, payload, {
      new: true,
      runValidators: true,
    }),
  transitionPendingById: (
    paymentId: string,
    payload: Record<string, unknown>,
  ) =>
    PaymentModel.findOneAndUpdate(
      { _id: paymentId, status: "pending" },
      payload,
      { new: true, runValidators: true },
    ),
  transitionStatusById: (
    paymentId: string,
    expectedStatus: "pending" | "succeeded" | "failed" | "refunded",
    payload: Record<string, unknown>,
  ) =>
    PaymentModel.findOneAndUpdate(
      { _id: paymentId, status: expectedStatus },
      payload,
      { new: true, runValidators: true },
    ),
  issueCheckoutToken: (
    paymentId: string,
    tokenHash: string,
    expiresAt: Date,
    attemptExpiresAt: Date,
  ) =>
    PaymentModel.findOneAndUpdate(
      {
        _id: paymentId,
        provider: "esewa",
        mode: "sandbox",
        status: "pending",
      },
      {
        checkoutTokenHash: tokenHash,
        checkoutExpiresAt: expiresAt,
        checkoutOpenedAt: null,
        // How long eSewa's NOT_FOUND still counts as "not started yet" rather
        // than an abandoned attempt. Separate from the short bridge-link life.
        providerExpiresAt: attemptExpiresAt,
      },
      { new: true, runValidators: true },
    ),
  consumeCheckoutToken: (
    paymentId: string,
    tokenHash: string,
    now: Date,
  ) =>
    PaymentModel.findOneAndUpdate(
      {
        _id: paymentId,
        provider: "esewa",
        mode: "sandbox",
        status: "pending",
        checkoutTokenHash: tokenHash,
        checkoutExpiresAt: { $gt: now },
        checkoutOpenedAt: null,
      },
      {
        $set: { checkoutOpenedAt: now },
        $unset: { checkoutTokenHash: 1 },
      },
      { new: true, runValidators: true },
    ),
  claimProviderLookup: (paymentId: string, before: Date, now: Date) =>
    PaymentModel.findOneAndUpdate(
      {
        _id: paymentId,
        mode: "sandbox",
        status: "pending",
        $or: [
          { lastLookupAt: null },
          { lastLookupAt: { $exists: false } },
          { lastLookupAt: { $lte: before } },
        ],
      },
      { $set: { lastLookupAt: now } },
      { new: true },
    ),
  claimKhaltiInitiation: (paymentId: string) =>
    PaymentModel.findOneAndUpdate(
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
      {
        $set: {
          providerStatus: "Initiating",
          gatewayMessage: "Khalti sandbox checkout is being initialized",
        },
      },
      { new: true, runValidators: true },
    ),
  recordKhaltiInitiation: (
    paymentId: string,
    payload: Record<string, unknown>,
  ) =>
    PaymentModel.findOneAndUpdate(
      {
        _id: paymentId,
        provider: "khalti",
        mode: "sandbox",
        status: "pending",
        providerStatus: "Initiating",
        providerPaymentId: { $exists: false },
      },
      { $set: payload },
      { new: true, runValidators: true },
    ),
  markKhaltiInitiationUnknown: (
    paymentId: string,
    payload: Record<string, unknown>,
  ) =>
    PaymentModel.findOneAndUpdate(
      {
        _id: paymentId,
        provider: "khalti",
        mode: "sandbox",
        status: "pending",
        providerStatus: "Initiating",
        providerPaymentId: { $exists: false },
      },
      { $set: payload },
      { new: true, runValidators: true },
    ),
  list: (
    filter: Record<string, unknown>,
    sort: Record<string, 1 | -1>,
    skip: number,
    limit: number,
  ) =>
    PaymentModel.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate("bookingId")
      .populate("payerId"),
  count: (filter: Record<string, unknown>) =>
    PaymentModel.countDocuments(filter),
};
