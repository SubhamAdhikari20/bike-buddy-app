import crypto from "node:crypto";
import AppError from "../errors/AppError.ts";
import { ESEWA_SANDBOX_FORM } from "../services/payment-gateway.service.ts";

type CheckoutTokenPayload = {
  version: 1;
  paymentId: string;
  transactionRef: string;
  expiresAt: number;
  nonce: string;
};

const signTokenPayload = (encodedPayload: string, secret: string) =>
  crypto.createHmac("sha256", secret).update(encodedPayload).digest("base64url");

export const createCheckoutToken = (
  paymentId: string,
  transactionRef: string,
  expiresAt: Date,
  secret: string,
) => {
  const payload: CheckoutTokenPayload = {
    version: 1,
    paymentId,
    transactionRef,
    expiresAt: expiresAt.getTime(),
    nonce: crypto.randomBytes(16).toString("base64url"),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  );
  return `${encodedPayload}.${signTokenPayload(encodedPayload, secret)}`;
};

export const hashCheckoutToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

export const verifyCheckoutToken = (
  token: string,
  secret: string,
  now = new Date(),
): CheckoutTokenPayload => {
  if (token.length === 0 || token.length > 2048) {
    throw new AppError(400, "Invalid checkout link", "INVALID_CHECKOUT_LINK");
  }
  const parts = token.split(".");
  if (parts.length !== 2) {
    throw new AppError(400, "Invalid checkout link", "INVALID_CHECKOUT_LINK");
  }
  const [encodedPayload, suppliedSignature] = parts;
  if (!encodedPayload || !suppliedSignature) {
    throw new AppError(400, "Invalid checkout link", "INVALID_CHECKOUT_LINK");
  }
  const expectedSignature = signTokenPayload(encodedPayload, secret);
  const supplied = Buffer.from(suppliedSignature, "utf8");
  const expected = Buffer.from(expectedSignature, "utf8");
  if (
    supplied.length !== expected.length ||
    !crypto.timingSafeEqual(supplied, expected)
  ) {
    throw new AppError(400, "Invalid checkout link", "INVALID_CHECKOUT_LINK");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString());
  } catch {
    throw new AppError(400, "Invalid checkout link", "INVALID_CHECKOUT_LINK");
  }
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("version" in payload) ||
    payload.version !== 1 ||
    !("paymentId" in payload) ||
    typeof payload.paymentId !== "string" ||
    payload.paymentId.length === 0 ||
    payload.paymentId.length > 100 ||
    !("transactionRef" in payload) ||
    typeof payload.transactionRef !== "string" ||
    !/^[A-Za-z0-9-]{1,100}$/.test(payload.transactionRef) ||
    !("expiresAt" in payload) ||
    typeof payload.expiresAt !== "number" ||
    !("nonce" in payload) ||
    typeof payload.nonce !== "string" ||
    !/^[A-Za-z0-9_-]{16,100}$/.test(payload.nonce)
  ) {
    throw new AppError(400, "Invalid checkout link", "INVALID_CHECKOUT_LINK");
  }
  if (
    payload.expiresAt <= now.getTime() ||
    payload.expiresAt > now.getTime() + 10 * 60 * 1000
  ) {
    throw new AppError(410, "This checkout link has expired", "CHECKOUT_EXPIRED");
  }
  return payload as CheckoutTokenPayload;
};

export const escapeHtml = (value: unknown) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export const renderEsewaCheckoutHtml = (
  fields: Record<string, string>,
  nonce: string,
) => {
  const inputs = Object.entries(fields)
    .map(
      ([name, value]) =>
        `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`,
    )
    .join("\n");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="referrer" content="no-referrer">
  <title>Bike Buddy test checkout</title>
</head>
<body>
  <main>
    <h1>Opening eSewa UAT</h1>
    <p>This is a sandbox checkout. No real money is accepted by Bike Buddy.</p>
    <form id="esewa-checkout" action="${ESEWA_SANDBOX_FORM}" method="post">
      ${inputs}
      <button type="submit">Continue to eSewa test checkout</button>
    </form>
    <noscript><p>JavaScript is off. Use the continue button above.</p></noscript>
  </main>
  <script nonce="${escapeHtml(nonce)}">document.getElementById("esewa-checkout").submit();</script>
</body>
</html>`;
};

export type PaymentResultView = {
  paymentId: string | null;
  status: "succeeded" | "pending" | "failed" | "refunded";
  title: string;
  message: string;
};

export const renderPaymentResultHtml = (
  result: PaymentResultView,
  nonce: string,
) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="referrer" content="no-referrer">
  <title>${escapeHtml(result.title)}</title>
</head>
<body>
  <main>
    <h1>${escapeHtml(result.title)}</h1>
    <p>${escapeHtml(result.message)}</p>
    <p>Switch back to the Bike Buddy app and choose <strong>Check payment status</strong>.</p>
    <p><small>You can close this sandbox checkout page.</small></p>
  </main>
  <script nonce="${escapeHtml(nonce)}">history.replaceState({},document.title,location.pathname);</script>
</body>
</html>`;
