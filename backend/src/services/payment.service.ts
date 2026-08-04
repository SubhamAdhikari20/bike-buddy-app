import crypto from "node:crypto";
import AppError from "../errors/AppError.ts";
import {
  ESEWA_SANDBOX_SECRET_KEY,
  KHALTI_SANDBOX_SECRET_KEY,
  PAYMENT_CHECKOUT_SIGNING_SECRET,
  PAYMENT_LOOKUP_INTERVAL_MS,
  PAYMENT_MODE,
  PAYMENT_PROVIDER_TIMEOUT_MS,
  PAYMENT_PUBLIC_BASE_URL,
  PAYMENT_WEBSITE_URL,
} from "../config/index.ts";
import { bookingRepository } from "../repositories/booking.repository.ts";
import { paymentRepository } from "../repositories/payment.repository.ts";
import type { AuthRole } from "../interfaces/auth.interface.ts";
import { referencesDocument, toDocumentId } from "../utils/mongo-reference.ts";
import {
  ESEWA_SANDBOX_PRODUCT_CODE,
  amountToMinor,
  buildEsewaCheckoutFields,
  paymentGateway,
  validateProviderPaymentUrl,
  verifyEsewaCallbackData,
  type ProviderVerification,
} from "./payment-gateway.service.ts";
import {
  createCheckoutToken,
  hashCheckoutToken,
  verifyCheckoutToken,
} from "../utils/payment-checkout.ts";
import notificationEvents from "./notification-events.service.ts";

type PaymentAuth = {
  userId: string;
  role: AuthRole;
  profileId?: string;
};

type PaymentProvider = "khalti" | "esewa";

const ensurePaymentAccess = (auth: PaymentAuth, booking: any) => {
  if (auth.role === "admin") return;
  if (
    auth.role === "renter" &&
    referencesDocument(booking.renterId, auth.profileId)
  ) {
    return;
  }
  throw new AppError(
    403,
    "You do not have access to this payment",
    "FORBIDDEN",
  );
};

const createTransactionReference = () =>
  `BB-${crypto.randomUUID().replaceAll("-", "").slice(0, 20).toUpperCase()}`;

const paymentIdOf = (payment: any) =>
  toDocumentId(payment?._id) ?? String(payment?._id ?? "");

const bookingIdOf = (payment: any) =>
  toDocumentId(payment?.bookingId) ?? String(payment?.bookingId ?? "");

const isDuplicateKeyError = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === 11000;

const isExpiredUnpaidHold = (booking: any, now: Date) =>
  booking.status === "pending" &&
  booking.paymentStatus !== "paid" &&
  (!booking.holdExpiresAt ||
    new Date(booking.holdExpiresAt).getTime() <= now.getTime());

const toPaymentSession = (
  payment: any,
  paymentUrl: string | null,
  notice?: string,
) => ({
  paymentId: paymentIdOf(payment),
  transactionRef: payment.transactionRef,
  amount: payment.amount,
  currency: payment.currency,
  provider: payment.provider,
  mode: payment.mode,
  paymentUrl,
  demoConfirmationRequired: payment.mode === "demo",
  notice:
    notice ??
    (payment.mode === "demo"
      ? "Coursework demo only - no money will be charged."
      : "Provider sandbox/test checkout only - no real money is accepted by Bike Buddy."),
});

const toSafePayment = (payment: any) => ({
  paymentId: paymentIdOf(payment),
  bookingId: bookingIdOf(payment),
  provider: payment.provider,
  mode: payment.mode,
  amount: payment.amount,
  amountMinor: payment.amountMinor,
  currency: payment.currency,
  status: payment.status,
  transactionRef: payment.transactionRef,
  providerStatus: payment.providerStatus ?? null,
  providerExpiresAt: payment.providerExpiresAt ?? null,
  verifiedAt: payment.verifiedAt ?? null,
  reconciliationRequired: Boolean(payment.reconciliationRequired),
  reconciliationMessage: payment.reconciliationMessage ?? null,
  gatewayMessage: payment.gatewayMessage ?? null,
  receiptUrl: payment.receiptUrl ?? null,
  createdAt: payment.createdAt,
  updatedAt: payment.updatedAt,
});

const statusMessage = (payment: any) => {
  if (payment.reconciliationRequired) {
    return (
      payment.reconciliationMessage ??
      "This test payment needs administrator reconciliation."
    );
  }
  switch (payment.status) {
    case "succeeded":
      if (payment.mode === "demo") {
        return "Demo payment approved. No money was charged; the booking is awaiting owner approval.";
      }
      if (payment.mode === "sandbox") {
        return "Provider sandbox payment verified. No real money was charged; the booking is awaiting owner approval.";
      }
      return payment.provider === "manual"
        ? "Cash payment recorded."
        : "Payment verified.";
    case "failed":
      return "The payment was not completed. No booking access was granted.";
    case "refunded":
      return "The payment provider reports this payment as refunded.";
    default:
      return (
        payment.gatewayMessage ??
        "Payment verification is pending. Check again shortly."
      );
  }
};

const toPaymentStatus = (payment: any) => ({
  paymentId: paymentIdOf(payment),
  bookingId: bookingIdOf(payment),
  provider: payment.provider,
  mode: payment.mode,
  status: payment.status,
  paid: payment.status === "succeeded" && !payment.reconciliationRequired,
  terminal:
    !payment.reconciliationRequired &&
    ["succeeded", "failed", "refunded"].includes(payment.status),
  message: statusMessage(payment),
});

const requireSandboxCallbackBase = () => {
  if (!PAYMENT_PUBLIC_BASE_URL) {
    throw new AppError(
      503,
      "Sandbox checkout needs PAYMENT_PUBLIC_BASE_URL set to a public HTTPS tunnel or deployment origin.",
      "PAYMENT_SANDBOX_NOT_CONFIGURED",
    );
  }
  const parsed = new URL(PAYMENT_PUBLIC_BASE_URL);
  const hostname = parsed.hostname.toLowerCase();
  const privateIpv4 =
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^169\.254\./.test(hostname) ||
    (() => {
      const match = /^172\.(\d+)\./.exec(hostname);
      return match ? Number(match[1]) >= 16 && Number(match[1]) <= 31 : false;
    })();
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]" ||
    hostname === "0.0.0.0" ||
    hostname.endsWith(".local") ||
    hostname === "host.docker.internal" ||
    /^\[(?:fc|fd|fe8|fe9|fea|feb)/.test(hostname) ||
    privateIpv4
  ) {
    throw new AppError(
      503,
      "Payment providers cannot return to localhost. Configure PAYMENT_PUBLIC_BASE_URL with a public HTTPS tunnel.",
      "PAYMENT_CALLBACK_NOT_PUBLIC",
    );
  }
  return PAYMENT_PUBLIC_BASE_URL;
};

const requireSandboxSecret = (provider: PaymentProvider) => {
  if (provider === "khalti") {
    if (!KHALTI_SANDBOX_SECRET_KEY) {
      throw new AppError(
        503,
        "Khalti sandbox is not configured on the server.",
        "PAYMENT_SANDBOX_NOT_CONFIGURED",
      );
    }
    return KHALTI_SANDBOX_SECRET_KEY;
  }
  if (!ESEWA_SANDBOX_SECRET_KEY) {
    throw new AppError(
      503,
      "eSewa UAT is not configured on the server.",
      "PAYMENT_SANDBOX_NOT_CONFIGURED",
    );
  }
  return ESEWA_SANDBOX_SECRET_KEY;
};

const requireCheckoutSigningSecret = () => {
  if (PAYMENT_CHECKOUT_SIGNING_SECRET.length < 32) {
    throw new AppError(
      503,
      "The eSewa checkout bridge signing secret is not configured.",
      "PAYMENT_SANDBOX_NOT_CONFIGURED",
    );
  }
  return PAYMENT_CHECKOUT_SIGNING_SECRET;
};

const callbackUrl = (path: string) => `${requireSandboxCallbackBase()}${path}`;

const reconcileBookingForPayment = async (payment: any) => {
  const bookingId = bookingIdOf(payment);
  const booking = bookingId
    ? await bookingRepository.findById(bookingId)
    : null;
  if (!booking) {
    throw new AppError(
      409,
      "The verified payment could not be matched to a booking",
      "PAYMENT_STATE_MISMATCH",
    );
  }

  if (payment.status === "succeeded") {
    const alreadyApplied =
      booking.paymentStatus === "paid" &&
      booking.paymentMethod === "wallet" &&
      booking.paymentMode === payment.mode;
    if (alreadyApplied) return;

    const updated = await bookingRepository.markPendingWalletPaid(
      bookingId,
      payment.mode,
    );
    if (!updated) {
      await bookingRepository.expireUnpaidHoldById(bookingId, new Date());
      await paymentRepository.updateById(paymentIdOf(payment), {
        reconciliationRequired: true,
        reconciliationMessage:
          "Provider payment settled after the booking or payment method changed. The booking was not revived; an administrator must reconcile the test payment.",
      });
    }
    return;
  }

  if (payment.status === "failed") {
    if (
      booking.paymentStatus === "failed" &&
      booking.paymentMethod === "wallet"
    ) {
      return;
    }
    const updated = await bookingRepository.markPendingWalletFailed(
      bookingId,
      payment.mode,
    );
    if (!updated) {
      await bookingRepository.expireUnpaidHoldById(bookingId, new Date());
      const current = await bookingRepository.findById(bookingId);
      if (!current || current.status !== "pending") return;
      await paymentRepository.updateById(paymentIdOf(payment), {
        reconciliationRequired: true,
        reconciliationMessage:
          "The failed provider result did not match the booking's active payment state.",
      });
    }
    return;
  }

  if (payment.status === "refunded") {
    if (booking.paymentStatus === "refunded") return;
    const updated = await bookingRepository.markWalletRefunded(
      bookingId,
      payment.mode,
    );
    if (!updated) {
      await paymentRepository.updateById(paymentIdOf(payment), {
        reconciliationRequired: true,
        reconciliationMessage:
          "The provider refund did not match a paid wallet booking and needs reconciliation.",
      });
    }
  }
};

const applyProviderVerification = async (
  paymentId: string,
  verification: ProviderVerification,
) => {
  if (verification.state === "pending") {
    return paymentRepository.updateById(paymentId, {
      providerStatus: verification.providerStatus,
      providerTransactionId: verification.providerTransactionId,
      gatewayMessage: verification.message,
      reconciliationRequired: Boolean(verification.reconciliationRequired),
      ...(verification.reconciliationRequired
        ? { reconciliationMessage: verification.message }
        : {}),
    });
  }

  const terminalPayload = {
    status: verification.state,
    providerStatus: verification.providerStatus,
    providerTransactionId: verification.providerTransactionId,
    gatewayMessage: verification.message,
    verifiedAt: new Date(),
    reconciliationRequired: Boolean(verification.reconciliationRequired),
    ...(verification.reconciliationRequired
      ? { reconciliationMessage: verification.message }
      : {}),
  };
  let resolved = await paymentRepository.transitionPendingById(
    paymentId,
    terminalPayload,
  );
  if (!resolved) {
    resolved = await paymentRepository.findById(paymentId);
    if (!resolved) {
      throw new AppError(404, "Payment not found", "NOT_FOUND");
    }
    // A retry may only reconcile the already-recorded terminal state. It can
    // never replace one terminal outcome with another.
    if (resolved.status !== verification.state) {
      const conflicted = await paymentRepository.updateById(paymentId, {
        providerStatus: verification.providerStatus,
        providerTransactionId: verification.providerTransactionId,
        verifiedAt: new Date(),
        reconciliationRequired: true,
        reconciliationMessage:
          "The provider's verified result arrived after Bike Buddy had already closed this payment. Manual reconciliation is required.",
      });
      await notificationEvents.paymentState(
        conflicted ?? resolved,
        resolved.bookingId,
      );
      return conflicted;
    }
  }
  await reconcileBookingForPayment(resolved);
  const finalPayment =
    (await paymentRepository.findById(paymentId)) ?? resolved;
  await notificationEvents.paymentState(finalPayment, finalPayment.bookingId);
  return finalPayment;
};

const lookupSandboxPayment = async (paymentId: string) => {
  const payment = await paymentRepository.findById(paymentId);
  if (!payment) throw new AppError(404, "Payment not found", "NOT_FOUND");
  if (payment.mode !== "sandbox") return payment;
  if (payment.status !== "pending") {
    await reconcileBookingForPayment(payment);
    const finalPayment =
      (await paymentRepository.findById(paymentId)) ?? payment;
    await notificationEvents.paymentState(finalPayment, finalPayment.bookingId);
    return finalPayment;
  }

  const now = new Date();
  const claimed = await paymentRepository.claimProviderLookup(
    paymentId,
    new Date(now.getTime() - PAYMENT_LOOKUP_INTERVAL_MS),
    now,
  );
  if (!claimed) return payment;

  let verification: ProviderVerification;
  if (payment.provider === "khalti") {
    const pidx = payment.providerPaymentId;
    if (!pidx) {
      throw new AppError(
        409,
        "Khalti checkout has not been initialized",
        "PAYMENT_NOT_INITIALIZED",
      );
    }
    verification = await paymentGateway.lookupKhalti({
      secretKey: requireSandboxSecret("khalti"),
      pidx,
      amountMinor: payment.amountMinor,
      timeoutMs: PAYMENT_PROVIDER_TIMEOUT_MS,
    });
  } else if (payment.provider === "esewa") {
    verification = await paymentGateway.lookupEsewa({
      transactionRef: payment.transactionRef,
      amountMinor: payment.amountMinor,
      timeoutMs: PAYMENT_PROVIDER_TIMEOUT_MS,
    });
  } else {
    throw new AppError(
      409,
      "This payment does not use a sandbox wallet provider",
      "PAYMENT_STATE_MISMATCH",
    );
  }
  return applyProviderVerification(paymentId, verification);
};

const issueEsewaCheckout = async (payment: any) => {
  const secret = requireCheckoutSigningSecret();
  requireSandboxSecret("esewa");
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  const token = createCheckoutToken(
    paymentIdOf(payment),
    payment.transactionRef,
    expiresAt,
    secret,
  );
  const updated = await paymentRepository.issueCheckoutToken(
    paymentIdOf(payment),
    hashCheckoutToken(token),
    expiresAt,
  );
  if (!updated) {
    throw new AppError(
      409,
      "This payment is no longer awaiting checkout",
      "PAYMENT_ALREADY_RESOLVED",
    );
  }
  const paymentUrl = `${callbackUrl(
    `/api/v1/payments/checkout/esewa/${paymentIdOf(payment)}`,
  )}?token=${encodeURIComponent(token)}`;
  return toPaymentSession(updated, paymentUrl);
};

const issueKhaltiCheckout = async (payment: any) => {
  if (
    payment.reconciliationRequired ||
    payment.providerStatus === "InitiationUnknown"
  ) {
    return toPaymentSession(
      payment,
      null,
      payment.reconciliationMessage ??
        "Khalti initiation needs reconciliation before another checkout can be created.",
    );
  }
  if (payment.providerStatus === "Initiating") {
    return toPaymentSession(
      payment,
      null,
      "Khalti sandbox checkout is being initialized. Check again shortly; Bike Buddy will not create a duplicate attempt.",
    );
  }
  if (payment.providerPaymentId && payment.paymentUrl) {
    if (
      payment.providerExpiresAt &&
      new Date(payment.providerExpiresAt).getTime() <= Date.now()
    ) {
      try {
        const resolved = await lookupSandboxPayment(paymentIdOf(payment));
        return toPaymentSession(resolved, null, statusMessage(resolved));
      } catch (error) {
        if (!(error instanceof AppError)) throw error;
        const uncertain = await paymentRepository.updateById(
          paymentIdOf(payment),
          {
            reconciliationRequired: true,
            reconciliationMessage:
              "The Khalti test link expired before Bike Buddy could verify its final status.",
          },
        );
        return toPaymentSession(
          uncertain ?? payment,
          null,
          "The expired Khalti checkout needs status reconciliation.",
        );
      }
    }
    return toPaymentSession(
      payment,
      validateProviderPaymentUrl(payment.paymentUrl),
    );
  }
  const baseUrl = requireSandboxCallbackBase();
  const claimed = await paymentRepository.claimKhaltiInitiation(
    paymentIdOf(payment),
  );
  if (!claimed) {
    const current = await paymentRepository.findById(paymentIdOf(payment));
    if (!current) throw new AppError(404, "Payment not found", "NOT_FOUND");
    if (current.providerPaymentId && current.paymentUrl) {
      return toPaymentSession(
        current,
        validateProviderPaymentUrl(current.paymentUrl),
      );
    }
    return toPaymentSession(
      current,
      null,
      "Khalti sandbox checkout is already being initialized or needs reconciliation.",
    );
  }
  let initiation;
  try {
    initiation = await paymentGateway.initiateKhalti({
      secretKey: requireSandboxSecret("khalti"),
      callbackUrl: `${baseUrl}/api/v1/payments/callback/khalti`,
      websiteUrl: PAYMENT_WEBSITE_URL || baseUrl,
      amountMinor: claimed.amountMinor,
      transactionRef: claimed.transactionRef,
      bookingLabel: `Bike Buddy booking ${bookingIdOf(claimed).slice(-8)}`,
      timeoutMs: PAYMENT_PROVIDER_TIMEOUT_MS,
    });
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    const uncertain = await paymentRepository.markKhaltiInitiationUnknown(
      paymentIdOf(claimed),
      {
        providerStatus: "InitiationUnknown",
        reconciliationRequired: true,
        reconciliationMessage:
          "Khalti did not return a trustworthy checkout response. Bike Buddy will not create another attempt automatically.",
        gatewayMessage:
          "Khalti sandbox initiation is uncertain; no payment has been confirmed.",
      },
    );
    return toPaymentSession(
      uncertain ?? claimed,
      null,
      "Khalti sandbox initiation could not be confirmed. Do not retry until the attempt is reconciled.",
    );
  }
  const updated = await paymentRepository.recordKhaltiInitiation(
    paymentIdOf(claimed),
    {
      providerPaymentId: initiation.pidx,
      paymentUrl: initiation.paymentUrl,
      providerExpiresAt: initiation.expiresAt,
      providerStatus: "Initiated",
      gatewayMessage: "Khalti sandbox checkout initialized",
    },
  );
  if (!updated) throw new AppError(404, "Payment not found", "NOT_FOUND");
  return toPaymentSession(updated, initiation.paymentUrl);
};

const resumeSandboxCheckout = (payment: any) =>
  payment.provider === "khalti"
    ? issueKhaltiCheckout(payment)
    : issueEsewaCheckout(payment);

const rejectIneligiblePaymentClaim = async (
  payment: any,
  bookingId: string,
  now: Date,
) => {
  await bookingRepository.expireUnpaidHoldById(bookingId, now);

  if (payment.mode === "sandbox") {
    // A concurrent request may already have exposed a provider-hosted URL.
    // Keep the attempt provider-verifiable instead of inventing a failure.
    await paymentRepository.updateById(paymentIdOf(payment), {
      reconciliationRequired: true,
      reconciliationMessage:
        "The booking changed or expired before checkout could be safely attached. No booking access will be granted if this test payment settles.",
      gatewayMessage:
        "Checkout paused because the booking is no longer eligible for payment.",
    });
  } else {
    await paymentRepository.transitionPendingById(paymentIdOf(payment), {
      status: "failed",
      providerStatus: "booking_ineligible",
      verifiedAt: now,
      gatewayMessage:
        "Demo payment closed because the booking changed or expired.",
    });
  }

  const current = await bookingRepository.findById(bookingId);
  if (
    !current ||
    current.status === "expired" ||
    isExpiredUnpaidHold(current, now)
  ) {
    throw new AppError(
      409,
      "This unpaid booking hold has expired. Create a new booking to pay.",
      "BOOKING_HOLD_EXPIRED",
    );
  }
  throw new AppError(
    409,
    "The booking changed before payment could start. Refresh and try again.",
    "BOOKING_STATE_CHANGED",
  );
};

const claimBookingForPayment = async (payment: any, bookingId: string) => {
  const now = new Date();
  const claimed = await bookingRepository.claimPendingForWallet(
    bookingId,
    now,
    PAYMENT_MODE,
  );
  if (!claimed) await rejectIneligiblePaymentClaim(payment, bookingId, now);
  return claimed;
};

const scalarQueryValue = (value: unknown, name: string) => {
  if (typeof value !== "string" || value.length === 0 || value.length > 8192) {
    throw new AppError(400, `Invalid ${name}`, "INVALID_CALLBACK");
  }
  return value;
};

const paymentService = {
  async initiatePayment(
    auth: PaymentAuth,
    payload: { bookingId: string; provider: PaymentProvider },
  ) {
    if (auth.role !== "renter") {
      throw new AppError(403, "Only renters can start payments", "FORBIDDEN");
    }

    const booking = await bookingRepository.findById(payload.bookingId);
    if (!booking) throw new AppError(404, "Booking not found", "NOT_FOUND");
    ensurePaymentAccess(auth, booking);
    if (booking.paymentStatus === "paid") {
      throw new AppError(
        409,
        "This booking is already paid. No second payment was created.",
        "CONFLICT",
      );
    }
    const now = new Date();
    if (isExpiredUnpaidHold(booking, now)) {
      await bookingRepository.expireUnpaidHoldById(payload.bookingId, now);
      throw new AppError(
        409,
        "This unpaid booking hold has expired. Create a new booking to pay.",
        "BOOKING_HOLD_EXPIRED",
      );
    }
    if (
      booking.paymentMethod === "cash" &&
      booking.paymentStatus === "pending"
    ) {
      throw new AppError(
        409,
        "This booking is already awaiting cash at pickup; a wallet checkout cannot be added.",
        "PAYMENT_ATTEMPT_ACTIVE",
      );
    }
    if (booking.status !== "pending") {
      throw new AppError(
        409,
        "Payments are not accepted for this booking state",
        "CONFLICT",
      );
    }
    if ((booking.currency ?? "NPR") !== "NPR") {
      throw new AppError(
        409,
        "eSewa and Khalti checkout is available only for NPR bookings",
        "UNSUPPORTED_CURRENCY",
      );
    }
    if (PAYMENT_MODE === "live") {
      throw new AppError(
        501,
        "Live payments remain disabled pending a production readiness review.",
        "PAYMENT_PROVIDER_NOT_CONFIGURED",
      );
    }
    if (PAYMENT_MODE === "sandbox") {
      requireSandboxCallbackBase();
      requireSandboxSecret(payload.provider);
      if (payload.provider === "esewa") requireCheckoutSigningSecret();
    }

    const otherPending = await paymentRepository.findPendingByBookingId(
      payload.bookingId,
    );
    if (otherPending) {
      if (
        otherPending.provider !== payload.provider ||
        otherPending.mode !== PAYMENT_MODE
      ) {
        throw new AppError(
          409,
          "Another wallet checkout is already active for this booking.",
          "PAYMENT_ATTEMPT_ACTIVE",
        );
      }
      await claimBookingForPayment(otherPending, payload.bookingId);
      return PAYMENT_MODE === "sandbox"
        ? resumeSandboxCheckout(otherPending)
        : toPaymentSession(otherPending, null);
    }

    const amountMinor = amountToMinor(Number(booking.totalAmount));
    let payment: any;
    try {
      payment = await paymentRepository.create({
        bookingId: payload.bookingId,
        payerId: auth.userId,
        provider: payload.provider,
        mode: PAYMENT_MODE,
        amount: booking.totalAmount,
        amountMinor,
        currency: "NPR",
        status: "pending",
        transactionRef: createTransactionReference(),
        gatewayMessage:
          PAYMENT_MODE === "demo"
            ? "Awaiting demo confirmation"
            : "Awaiting sandbox checkout",
        receiptUrl: null,
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        const raced = await paymentRepository.findPendingByBookingId(
          payload.bookingId,
        );
        if (
          raced &&
          raced.provider === payload.provider &&
          raced.mode === PAYMENT_MODE
        ) {
          await claimBookingForPayment(raced, payload.bookingId);
          return PAYMENT_MODE === "sandbox"
            ? resumeSandboxCheckout(raced)
            : toPaymentSession(raced, null);
        }
        throw new AppError(
          409,
          "Another wallet checkout is already active for this booking.",
          "PAYMENT_ATTEMPT_ACTIVE",
        );
      }
      throw error;
    }
    await claimBookingForPayment(payment, payload.bookingId);

    return PAYMENT_MODE === "sandbox"
      ? resumeSandboxCheckout(payment)
      : toPaymentSession(payment, null);
  },

  async confirmDemoPayment(
    auth: PaymentAuth,
    paymentId: string,
    payload: { outcome: "succeeded" | "failed" },
  ) {
    if (PAYMENT_MODE !== "demo") {
      throw new AppError(
        404,
        "Demo payment confirmation is disabled",
        "NOT_FOUND",
      );
    }
    const payment = await paymentRepository.findById(paymentId);
    if (!payment) throw new AppError(404, "Payment not found", "NOT_FOUND");
    ensurePaymentAccess(auth, payment.bookingId);
    if (payment.mode !== "demo") {
      throw new AppError(
        400,
        "Only demo payments can use this endpoint",
        "BAD_REQUEST",
      );
    }
    let resolved = payment;
    if (payment.status === "pending") {
      const transitioned = await paymentRepository.transitionPendingById(
        paymentId,
        {
          status: payload.outcome,
          verifiedAt: new Date(),
          providerStatus: payload.outcome,
          gatewayMessage:
            payload.outcome === "succeeded"
              ? "Demo payment approved - no money was charged"
              : "Demo payment declined - no money was charged",
        },
      );
      const racedResolution =
        transitioned ?? (await paymentRepository.findById(paymentId));
      if (!racedResolution) {
        throw new AppError(404, "Payment not found", "NOT_FOUND");
      }
      resolved = racedResolution;
    }
    if (resolved.status !== payload.outcome) {
      throw new AppError(
        409,
        "This demo payment has already been resolved with a different outcome",
        "CONFLICT",
      );
    }

    await reconcileBookingForPayment(resolved);
    const finalPayment =
      (await paymentRepository.findById(paymentId)) ?? resolved;
    await notificationEvents.paymentState(finalPayment, finalPayment.bookingId);
    const succeeded =
      finalPayment.status === "succeeded" &&
      !finalPayment.reconciliationRequired;
    return {
      payment: toSafePayment(finalPayment),
      simulated: true,
      succeeded,
      charged: false,
      message: succeeded
        ? "Demo payment completed. No money was charged; the booking is awaiting owner approval."
        : finalPayment.status === "succeeded"
          ? "The demo payment was recorded, but the booking changed or expired. No booking access was granted; reconciliation is required."
          : "Demo payment failed. No money was charged and your booking details are saved.",
    };
  },

  async getPayment(auth: PaymentAuth, paymentId: string) {
    const payment = await paymentRepository.findById(paymentId);
    if (!payment) throw new AppError(404, "Payment not found", "NOT_FOUND");
    ensurePaymentAccess(auth, payment.bookingId);
    return toSafePayment(payment);
  },

  async getPaymentStatus(auth: PaymentAuth, paymentId: string) {
    let payment = await paymentRepository.findById(paymentId);
    if (!payment) throw new AppError(404, "Payment not found", "NOT_FOUND");
    ensurePaymentAccess(auth, payment.bookingId);
    if (payment.mode === "sandbox") {
      try {
        payment = await lookupSandboxPayment(paymentId);
      } catch (error) {
        if (!(error instanceof AppError)) throw error;
        if (
          [
            "PAYMENT_VERIFICATION_MISMATCH",
            "INVALID_PROVIDER_RESPONSE",
          ].includes(error.code)
        ) {
          await paymentRepository.updateById(paymentId, {
            reconciliationRequired: true,
            reconciliationMessage:
              "The provider response did not securely match this payment. No service was granted.",
          });
        }
        payment = (await paymentRepository.findById(paymentId)) ?? payment;
      }
    } else if (payment.status !== "pending") {
      await reconcileBookingForPayment(payment);
      payment = (await paymentRepository.findById(paymentId)) ?? payment;
    }
    return toPaymentStatus(payment);
  },

  async getEsewaCheckout(paymentId: string, token: string) {
    const secret = requireCheckoutSigningSecret();
    const payload = verifyCheckoutToken(token, secret);
    if (payload.paymentId !== paymentId) {
      throw new AppError(400, "Invalid checkout link", "INVALID_CHECKOUT_LINK");
    }
    const payment = await paymentRepository.consumeCheckoutToken(
      paymentId,
      hashCheckoutToken(token),
      new Date(),
    );
    if (!payment || payment.transactionRef !== payload.transactionRef) {
      throw new AppError(
        410,
        "This checkout link is expired or has already been opened",
        "CHECKOUT_LINK_USED",
      );
    }
    const baseUrl = requireSandboxCallbackBase();
    const secretKey = requireSandboxSecret("esewa");
    const referencePath = encodeURIComponent(payment.transactionRef);
    return buildEsewaCheckoutFields({
      amountMinor: payment.amountMinor,
      transactionRef: payment.transactionRef,
      successUrl: `${baseUrl}/api/v1/payments/callback/esewa/${referencePath}`,
      failureUrl: `${baseUrl}/api/v1/payments/callback/esewa/${referencePath}/failure`,
      secret: secretKey,
    });
  },

  async handleKhaltiCallback(query: Record<string, unknown>) {
    const pidx = scalarQueryValue(query.pidx, "Khalti payment identifier");
    const orderId = scalarQueryValue(
      query.purchase_order_id,
      "Khalti purchase order",
    );
    const payment = await paymentRepository.findByProviderPaymentId(pidx);
    if (
      !payment ||
      payment.provider !== "khalti" ||
      payment.mode !== "sandbox" ||
      payment.transactionRef !== orderId
    ) {
      throw new AppError(
        400,
        "Khalti callback did not match a Bike Buddy payment",
        "INVALID_CALLBACK",
      );
    }
    const resolved = await lookupSandboxPayment(paymentIdOf(payment));
    return toPaymentStatus(resolved);
  },

  async handleEsewaCallback(query: Record<string, unknown>) {
    const encodedData = scalarQueryValue(query.data, "eSewa callback data");
    const signed = verifyEsewaCallbackData(
      encodedData,
      requireSandboxSecret("esewa"),
    );
    const queryReference = scalarQueryValue(
      query.paymentRef,
      "eSewa payment reference",
    );
    if (
      signed.productCode !== ESEWA_SANDBOX_PRODUCT_CODE ||
      signed.transactionRef !== queryReference ||
      signed.status !== "COMPLETE"
    ) {
      throw new AppError(
        400,
        "eSewa callback did not report a complete matching payment",
        "INVALID_CALLBACK",
      );
    }
    const payment = await paymentRepository.findByTransactionRef(
      signed.transactionRef,
    );
    if (
      !payment ||
      payment.provider !== "esewa" ||
      payment.mode !== "sandbox" ||
      payment.amountMinor !== signed.totalAmountMinor
    ) {
      throw new AppError(
        400,
        "eSewa callback did not match a Bike Buddy payment",
        "INVALID_CALLBACK",
      );
    }
    const resolved = await lookupSandboxPayment(paymentIdOf(payment));
    return toPaymentStatus(resolved);
  },

  async handleEsewaFailureCallback(query: Record<string, unknown>) {
    const reference = scalarQueryValue(
      query.paymentRef,
      "eSewa payment reference",
    );
    const payment = await paymentRepository.findByTransactionRef(reference);
    if (
      !payment ||
      payment.provider !== "esewa" ||
      payment.mode !== "sandbox"
    ) {
      throw new AppError(
        400,
        "eSewa return did not match a Bike Buddy payment",
        "INVALID_CALLBACK",
      );
    }
    const resolved = await lookupSandboxPayment(paymentIdOf(payment));
    return toPaymentStatus(resolved);
  },

  async updatePaymentStatus(
    auth: PaymentAuth,
    paymentId: string,
    payload: { status: "failed" | "refunded"; note?: string },
  ) {
    if (auth.role !== "admin") {
      throw new AppError(
        403,
        "Only administrators can moderate payment states",
        "FORBIDDEN",
      );
    }
    const payment = await paymentRepository.findById(paymentId);
    if (!payment) throw new AppError(404, "Payment not found", "NOT_FOUND");
    if (payment.mode === "sandbox" && payment.provider !== "manual") {
      throw new AppError(
        409,
        "Provider-backed sandbox states can change only after provider verification.",
        "PROVIDER_VERIFICATION_REQUIRED",
      );
    }
    const expectedStatus =
      payload.status === "refunded" ? "succeeded" : "pending";
    if (payment.status !== expectedStatus) {
      throw new AppError(
        409,
        payload.status === "refunded"
          ? "Only a successful payment can be marked as refunded"
          : "Only a pending payment can be marked as failed",
        "CONFLICT",
      );
    }
    const updated = await paymentRepository.transitionStatusById(
      paymentId,
      expectedStatus,
      {
        status: payload.status,
        gatewayMessage: payload.note ?? `Marked ${payload.status} by admin`,
      },
    );
    if (!updated) {
      throw new AppError(
        409,
        "Payment state changed; refresh and retry",
        "CONFLICT",
      );
    }
    await reconcileBookingForPayment(updated);
    return toSafePayment(updated);
  },
};

export default paymentService;
