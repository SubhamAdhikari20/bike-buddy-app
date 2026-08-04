import crypto from "node:crypto";
import AppError from "../errors/AppError.ts";

// Provider-hosted test endpoints from the official integration guides:
// https://docs.khalti.com/khalti-epayment/
// https://developer.esewa.com.np/pages/Epay
export const KHALTI_SANDBOX_API = "https://dev.khalti.com/api/v2";
export const ESEWA_SANDBOX_FORM =
  "https://rc-epay.esewa.com.np/api/epay/main/v2/form";
export const ESEWA_SANDBOX_STATUS =
  "https://rc.esewa.com.np/api/epay/transaction/status/";
export const ESEWA_SANDBOX_PRODUCT_CODE = "EPAYTEST";

export type GatewayHttpRequest = {
  method: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  timeoutMs: number;
};

export type GatewayHttpResponse = {
  status: number;
  body: unknown;
};

export type GatewayHttpClient = (
  url: string,
  request: GatewayHttpRequest,
) => Promise<GatewayHttpResponse>;

const defaultHttpClient: GatewayHttpClient = async (url, request) => {
  let response: Response;
  try {
    response = await fetch(url, {
      method: request.method,
      redirect: "error",
      ...(request.headers ? { headers: request.headers } : {}),
      ...(request.body ? { body: request.body } : {}),
      signal: AbortSignal.timeout(request.timeoutMs),
    });
  } catch {
    throw new AppError(
      502,
      "The payment provider did not respond in time. No payment was confirmed.",
      "PAYMENT_PROVIDER_UNAVAILABLE",
    );
  }

  const responseText = await response.text();
  let body: unknown = null;
  if (responseText) {
    try {
      body = JSON.parse(responseText) as unknown;
    } catch {
      body = null;
    }
  }
  return { status: response.status, body };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const requiredString = (
  record: Record<string, unknown>,
  field: string,
  maximum = 500,
) => {
  const value = record[field];
  if (typeof value !== "string" || value.length === 0 || value.length > maximum) {
    throw new AppError(
      502,
      "The payment provider returned an invalid response. No payment was confirmed.",
      "INVALID_PROVIDER_RESPONSE",
    );
  }
  return value;
};

const optionalString = (
  record: Record<string, unknown>,
  field: string,
  maximum = 500,
) => {
  const value = record[field];
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || value.length > maximum) {
    throw new AppError(
      502,
      "The payment provider returned an invalid response. No payment was confirmed.",
      "INVALID_PROVIDER_RESPONSE",
    );
  }
  return value;
};

const ensureSuccessResponse = (response: GatewayHttpResponse) => {
  if (response.status < 200 || response.status >= 300 || !isRecord(response.body)) {
    throw new AppError(
      502,
      "The payment provider rejected the request. No payment was confirmed.",
      "PAYMENT_PROVIDER_REJECTED",
      { providerStatus: response.status },
    );
  }
  return response.body;
};

export const amountToMinor = (amount: number) => {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new AppError(409, "The booking amount is invalid", "INVALID_AMOUNT");
  }
  const minor = Math.round(amount * 100);
  if (!Number.isSafeInteger(minor) || Math.abs(minor / 100 - amount) > 1e-9) {
    throw new AppError(
      409,
      "The booking amount must have at most two decimal places",
      "INVALID_AMOUNT",
    );
  }
  return minor;
};

export const minorToAmountString = (minor: number) => {
  if (!Number.isSafeInteger(minor) || minor <= 0) {
    throw new AppError(409, "The payment amount is invalid", "INVALID_AMOUNT");
  }
  const whole = Math.floor(minor / 100);
  const fraction = minor % 100;
  return fraction === 0
    ? String(whole)
    : `${whole}.${String(fraction).padStart(2, "0")}`;
};

export const providerAmountToMinor = (value: unknown) => {
  const amount = typeof value === "number" ? String(value) : value;
  if (typeof amount !== "string") return null;
  const normalized = amount.trim().replaceAll(",", "");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole = "0", fraction = ""] = normalized.split(".");
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(minor) ? minor : null;
};

export const validateProviderPaymentUrl = (value: string) => {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new AppError(
      502,
      "The payment provider returned an invalid checkout URL",
      "INVALID_PROVIDER_RESPONSE",
    );
  }
  if (
    parsed.protocol !== "https:" ||
    !(parsed.hostname === "khalti.com" || parsed.hostname.endsWith(".khalti.com"))
  ) {
    throw new AppError(
      502,
      "The payment provider returned an untrusted checkout URL",
      "INVALID_PROVIDER_RESPONSE",
    );
  }
  return parsed.toString();
};

export type KhaltiInitiation = {
  pidx: string;
  paymentUrl: string;
  expiresAt: Date | null;
};

export type ProviderVerification = {
  state: "pending" | "succeeded" | "failed" | "refunded";
  providerStatus: string;
  providerTransactionId: string | null;
  message: string;
  reconciliationRequired?: boolean;
};

export const createPaymentGateway = (
  httpClient: GatewayHttpClient = defaultHttpClient,
) => ({
  async initiateKhalti(input: {
    secretKey: string;
    callbackUrl: string;
    websiteUrl: string;
    amountMinor: number;
    transactionRef: string;
    bookingLabel: string;
    timeoutMs: number;
  }): Promise<KhaltiInitiation> {
    if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor < 1000) {
      throw new AppError(
        409,
        "Khalti sandbox requires a payment of at least NPR 10",
        "INVALID_AMOUNT",
      );
    }
    const response = await httpClient(
      `${KHALTI_SANDBOX_API}/epayment/initiate/`,
      {
        method: "POST",
        headers: {
          Authorization: `Key ${input.secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          return_url: input.callbackUrl,
          website_url: input.websiteUrl,
          amount: input.amountMinor,
          purchase_order_id: input.transactionRef,
          purchase_order_name: input.bookingLabel,
        }),
        timeoutMs: input.timeoutMs,
      },
    );
    const body = ensureSuccessResponse(response);
    const pidx = requiredString(body, "pidx", 200);
    const paymentUrl = validateProviderPaymentUrl(
      requiredString(body, "payment_url", 2000),
    );
    const expiresAtValue = optionalString(body, "expires_at", 100);
    const parsedExpiry = expiresAtValue ? new Date(expiresAtValue) : null;
    return {
      pidx,
      paymentUrl,
      expiresAt:
        parsedExpiry && !Number.isNaN(parsedExpiry.getTime())
          ? parsedExpiry
          : null,
    };
  },

  async lookupKhalti(input: {
    secretKey: string;
    pidx: string;
    amountMinor: number;
    timeoutMs: number;
  }): Promise<ProviderVerification> {
    const response = await httpClient(
      `${KHALTI_SANDBOX_API}/epayment/lookup/`,
      {
        method: "POST",
        headers: {
          Authorization: `Key ${input.secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pidx: input.pidx }),
        timeoutMs: input.timeoutMs,
      },
    );
    const body =
      (response.status >= 200 && response.status < 300) ||
      response.status === 400
        ? isRecord(response.body)
          ? response.body
          : ensureSuccessResponse(response)
        : ensureSuccessResponse(response);
    const pidx = requiredString(body, "pidx", 200);
    const status = requiredString(body, "status", 100);
    if (pidx !== input.pidx || body.total_amount !== input.amountMinor) {
      throw new AppError(
        409,
        "Khalti verification did not match this payment. No service was granted.",
        "PAYMENT_VERIFICATION_MISMATCH",
      );
    }
    const transactionId = optionalString(body, "transaction_id", 200);

    if (status === "Completed") {
      if (!transactionId || body.refunded !== false) {
        throw new AppError(
          502,
          "Khalti returned an inconsistent completed payment",
          "INVALID_PROVIDER_RESPONSE",
        );
      }
      return {
        state: "succeeded",
        providerStatus: status,
        providerTransactionId: transactionId,
        message: "Khalti sandbox verified the test payment.",
      };
    }
    if (status === "Refunded") {
      return {
        state: "refunded",
        providerStatus: status,
        providerTransactionId: transactionId,
        message: "Khalti reports this sandbox payment as refunded.",
      };
    }
    if (["Expired", "User canceled", "Canceled", "Failed"].includes(status)) {
      return {
        state: "failed",
        providerStatus: status,
        providerTransactionId: transactionId,
        message: "Khalti did not complete the sandbox payment.",
      };
    }
    if (["Pending", "Initiated"].includes(status)) {
      return {
        state: "pending",
        providerStatus: status,
        providerTransactionId: transactionId,
        message: "Khalti is still processing the sandbox payment.",
      };
    }
    return {
      state: "pending",
      providerStatus: status,
      providerTransactionId: transactionId,
      message: "Khalti returned a status that needs manual reconciliation.",
      reconciliationRequired: true,
    };
  },

  async lookupEsewa(input: {
    transactionRef: string;
    amountMinor: number;
    timeoutMs: number;
  }): Promise<ProviderVerification> {
    const statusUrl = new URL(ESEWA_SANDBOX_STATUS);
    statusUrl.searchParams.set("product_code", ESEWA_SANDBOX_PRODUCT_CODE);
    statusUrl.searchParams.set(
      "total_amount",
      minorToAmountString(input.amountMinor),
    );
    statusUrl.searchParams.set("transaction_uuid", input.transactionRef);
    const response = await httpClient(statusUrl.toString(), {
      method: "GET",
      timeoutMs: input.timeoutMs,
    });
    const body = ensureSuccessResponse(response);
    const productCode = requiredString(body, "product_code", 100);
    const transactionRef = requiredString(body, "transaction_uuid", 200);
    const status = requiredString(body, "status", 100);
    if (
      productCode !== ESEWA_SANDBOX_PRODUCT_CODE ||
      transactionRef !== input.transactionRef ||
      providerAmountToMinor(body.total_amount) !== input.amountMinor
    ) {
      throw new AppError(
        409,
        "eSewa verification did not match this payment. No service was granted.",
        "PAYMENT_VERIFICATION_MISMATCH",
      );
    }
    const referenceId = optionalString(body, "ref_id", 200);

    if (status === "COMPLETE") {
      if (!referenceId) {
        throw new AppError(
          502,
          "eSewa returned a completed payment without a reference",
          "INVALID_PROVIDER_RESPONSE",
        );
      }
      return {
        state: "succeeded",
        providerStatus: status,
        providerTransactionId: referenceId,
        message: "eSewa UAT verified the test payment.",
      };
    }
    if (status === "FULL_REFUND") {
      return {
        state: "refunded",
        providerStatus: status,
        providerTransactionId: referenceId,
        message: "eSewa reports this UAT payment as fully refunded.",
      };
    }
    if (["NOT_FOUND", "CANCELED"].includes(status)) {
      return {
        state: "failed",
        providerStatus: status,
        providerTransactionId: referenceId,
        message: "eSewa did not complete the UAT payment.",
      };
    }
    if (["PENDING", "AMBIGUOUS"].includes(status)) {
      return {
        state: "pending",
        providerStatus: status,
        providerTransactionId: referenceId,
        message: "eSewa is still processing the UAT payment.",
      };
    }
    return {
      state: "pending",
      providerStatus: status,
      providerTransactionId: referenceId,
      message: "eSewa returned a status that needs manual reconciliation.",
      reconciliationRequired: true,
    };
  },
});

export const paymentGateway = createPaymentGateway();

export const createEsewaRequestSignature = (
  totalAmount: string,
  transactionRef: string,
  secret: string,
) =>
  crypto
    .createHmac("sha256", secret)
    .update(
      `total_amount=${totalAmount},transaction_uuid=${transactionRef},product_code=${ESEWA_SANDBOX_PRODUCT_CODE}`,
    )
    .digest("base64");

const equalBase64Digest = (left: string, right: string) => {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(left) || !/^[A-Za-z0-9+/]+={0,2}$/.test(right)) {
    return false;
  }
  const leftBytes = Buffer.from(left, "base64");
  const rightBytes = Buffer.from(right, "base64");
  return (
    leftBytes.length === rightBytes.length &&
    leftBytes.length > 0 &&
    crypto.timingSafeEqual(leftBytes, rightBytes)
  );
};

export type VerifiedEsewaCallback = {
  transactionCode: string;
  status: string;
  totalAmountMinor: number;
  transactionRef: string;
  productCode: string;
};

export const verifyEsewaCallbackData = (
  encodedData: string,
  secret: string,
): VerifiedEsewaCallback => {
  const normalized = encodedData.trim().replaceAll(" ", "+");
  if (
    normalized.length === 0 ||
    normalized.length > 8192 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)
  ) {
    throw new AppError(400, "Invalid eSewa callback data", "INVALID_CALLBACK");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(normalized, "base64").toString("utf8"));
  } catch {
    throw new AppError(400, "Invalid eSewa callback data", "INVALID_CALLBACK");
  }
  if (!isRecord(payload)) {
    throw new AppError(400, "Invalid eSewa callback data", "INVALID_CALLBACK");
  }

  const expectedSignedFields = [
    "transaction_code",
    "status",
    "total_amount",
    "transaction_uuid",
    "product_code",
    "signed_field_names",
  ];
  const signedFieldNames = requiredString(payload, "signed_field_names", 500);
  if (signedFieldNames !== expectedSignedFields.join(",")) {
    throw new AppError(
      400,
      "Unexpected eSewa signed fields",
      "INVALID_CALLBACK_SIGNATURE",
    );
  }
  const message = expectedSignedFields
    .map((field) => {
      const value = payload[field];
      if (typeof value !== "string" && typeof value !== "number") {
        throw new AppError(
          400,
          "Incomplete eSewa signed response",
          "INVALID_CALLBACK_SIGNATURE",
        );
      }
      return `${field}=${String(value)}`;
    })
    .join(",");
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(message)
    .digest("base64");
  const receivedSignature = requiredString(payload, "signature", 500);
  if (!equalBase64Digest(receivedSignature, expectedSignature)) {
    throw new AppError(
      400,
      "eSewa callback signature verification failed",
      "INVALID_CALLBACK_SIGNATURE",
    );
  }

  const totalAmountMinor = providerAmountToMinor(payload.total_amount);
  if (totalAmountMinor === null) {
    throw new AppError(400, "Invalid eSewa callback amount", "INVALID_CALLBACK");
  }
  return {
    transactionCode: requiredString(payload, "transaction_code", 200),
    status: requiredString(payload, "status", 100),
    totalAmountMinor,
    transactionRef: requiredString(payload, "transaction_uuid", 200),
    productCode: requiredString(payload, "product_code", 100),
  };
};

export const buildEsewaCheckoutFields = (input: {
  amountMinor: number;
  transactionRef: string;
  successUrl: string;
  failureUrl: string;
  secret: string;
}) => {
  const totalAmount = minorToAmountString(input.amountMinor);
  return {
    amount: totalAmount,
    tax_amount: "0",
    total_amount: totalAmount,
    transaction_uuid: input.transactionRef,
    product_code: ESEWA_SANDBOX_PRODUCT_CODE,
    product_service_charge: "0",
    product_delivery_charge: "0",
    success_url: input.successUrl,
    failure_url: input.failureUrl,
    signed_field_names: "total_amount,transaction_uuid,product_code",
    signature: createEsewaRequestSignature(
      totalAmount,
      input.transactionRef,
      input.secret,
    ),
  } satisfies Record<string, string>;
};
