// src/config/index.ts
import dotenv from "dotenv";

dotenv.config();

export const NODE_ENV = process.env.NODE_ENV || "development";
export const IS_PRODUCTION = NODE_ENV === "production";
export const PORT: number = process.env.PORT
  ? parseInt(process.env.PORT)
  : 5050;
export const MONGODB_URI: string =
  process.env.MONGODB_URI || "mongodb://localhost:27017/default_db";
export const MONGODB_DNS_SERVERS: string[] = (
  process.env.MONGODB_DNS_SERVERS || ""
)
  .split(",")
  .map((server) => server.trim())
  .filter(Boolean);
const configuredJwtSecret = process.env.JWT_SECRET?.trim();
const usesLocalMongo =
  /^mongodb:\/\/(127\.0\.0\.1|localhost|\[::1\])(?::\d+)?\//i.test(MONGODB_URI);

if (
  (IS_PRODUCTION || !usesLocalMongo) &&
  (!configuredJwtSecret || configuredJwtSecret.length < 32)
) {
  throw new Error(
    "JWT_SECRET must be configured with at least 32 characters for production or a remote database",
  );
}

export const JWT_SECRET: string =
  configuredJwtSecret ||
  "bike-buddy-development-secret-change-before-production";
const jwtDuration = (
  name: string,
  value: string | undefined,
  fallback: string,
) => {
  const duration = value?.trim() || fallback;
  if (/^\d+$/.test(duration)) {
    throw new Error(`${name} must include a time unit such as 15m, 24h or 30d`);
  }
  return duration;
};

export const JWT_SIGNUP_EXPIRES_IN: string = jwtDuration(
  "JWT_SIGNUP_EXPIRES_IN",
  process.env.JWT_SIGNUP_EXPIRES_IN,
  "1d",
);
export const JWT_LOGIN_EXPIRES_IN: string = jwtDuration(
  "JWT_LOGIN_EXPIRES_IN",
  process.env.JWT_LOGIN_EXPIRES_IN,
  "30d",
);
export const FRONTEND_URL: string =
  process.env.FRONTEND_URL || "http://localhost:3000";
export const BACKEND_URL: string =
  process.env.BACKEND_URL || `http://localhost:${PORT}`;
export const MEDIA_STORAGE_PROVIDER: string =
  process.env.MEDIA_STORAGE_PROVIDER || "local";
const configuredPaymentMode = process.env.PAYMENT_MODE?.trim().toLowerCase();
if (
  configuredPaymentMode &&
  configuredPaymentMode !== "demo" &&
  configuredPaymentMode !== "sandbox" &&
  configuredPaymentMode !== "live"
) {
  throw new Error("PAYMENT_MODE must be demo, sandbox or live");
}
export type PaymentMode = "demo" | "sandbox" | "live";
export const PAYMENT_MODE: PaymentMode =
  configuredPaymentMode === "sandbox" || configuredPaymentMode === "live"
    ? configuredPaymentMode
    : "demo";

const parseUrl = (name: string, value: string | undefined) => {
  const candidate = value?.trim();
  if (!candidate) return "";

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error(`${name} must be a valid absolute URL`);
  }

  const localHostnames = new Set(["localhost", "127.0.0.1", "::1"]);
  if (parsed.protocol !== "https:" && !localHostnames.has(parsed.hostname)) {
    throw new Error(`${name} must use HTTPS outside local development`);
  }
  return parsed.toString().replace(/\/$/, "");
};

const parseOrigin = (name: string, value: string | undefined) => {
  const result = parseUrl(name, value);
  if (!result) return "";
  const parsed = new URL(result);
  if (
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error(
      `${name} must contain only an origin, without credentials, path, query or hash`,
    );
  }
  return parsed.origin;
};

/** Explicit public callback origin used by provider sandboxes (never Host). */
export const PAYMENT_PUBLIC_BASE_URL = parseOrigin(
  "PAYMENT_PUBLIC_BASE_URL",
  process.env.PAYMENT_PUBLIC_BASE_URL,
);
export const PAYMENT_WEBSITE_URL = parseOrigin(
  "PAYMENT_WEBSITE_URL",
  process.env.PAYMENT_WEBSITE_URL,
);
export const KHALTI_SANDBOX_SECRET_KEY =
  process.env.KHALTI_SANDBOX_SECRET_KEY?.trim() || "";
export const ESEWA_SANDBOX_SECRET_KEY =
  process.env.ESEWA_SANDBOX_SECRET_KEY?.trim() || "";
export const PAYMENT_CHECKOUT_SIGNING_SECRET =
  process.env.PAYMENT_CHECKOUT_SIGNING_SECRET?.trim() || "";

const configuredProviderTimeout = Number(
  process.env.PAYMENT_PROVIDER_TIMEOUT_MS ?? "8000",
);
if (
  !Number.isInteger(configuredProviderTimeout) ||
  configuredProviderTimeout < 1000 ||
  configuredProviderTimeout > 15000
) {
  throw new Error(
    "PAYMENT_PROVIDER_TIMEOUT_MS must be an integer from 1000 to 15000",
  );
}
export const PAYMENT_PROVIDER_TIMEOUT_MS = configuredProviderTimeout;

const configuredLookupInterval = Number(
  process.env.PAYMENT_LOOKUP_INTERVAL_MS ?? "15000",
);
if (
  !Number.isInteger(configuredLookupInterval) ||
  configuredLookupInterval < 5000 ||
  configuredLookupInterval > 60000
) {
  throw new Error(
    "PAYMENT_LOOKUP_INTERVAL_MS must be an integer from 5000 to 60000",
  );
}
export const PAYMENT_LOOKUP_INTERVAL_MS = configuredLookupInterval;
const configuredBookingHoldMinutes = Number(
  process.env.BOOKING_HOLD_MINUTES ?? "30",
);
if (
  !Number.isInteger(configuredBookingHoldMinutes) ||
  configuredBookingHoldMinutes < 5 ||
  configuredBookingHoldMinutes > 60
) {
  throw new Error("BOOKING_HOLD_MINUTES must be an integer from 5 to 60");
}
export const BOOKING_HOLD_MINUTES = configuredBookingHoldMinutes;

const boundedNotificationInteger = (
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
) => {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}`);
  }
  return value;
};

export const NOTIFICATION_RETENTION_DAYS = boundedNotificationInteger(
  "NOTIFICATION_RETENTION_DAYS",
  90,
  7,
  365,
);
export const NOTIFICATION_MAX_CONNECTIONS_PER_USER = boundedNotificationInteger(
  "NOTIFICATION_MAX_CONNECTIONS_PER_USER",
  3,
  1,
  10,
);
export const NOTIFICATION_MAX_CONNECTIONS_TOTAL = boundedNotificationInteger(
  "NOTIFICATION_MAX_CONNECTIONS_TOTAL",
  500,
  10,
  5000,
);
export const NOTIFICATION_REPLAY_LIMIT = 100;
export const NOTIFICATION_HEARTBEAT_MS = 20_000;
export const NOTIFICATION_AUTH_RECHECK_MS = 30 * 60_000;
export const GOOGLE_CLIENT_IDS: string[] = (process.env.GOOGLE_CLIENT_IDS || "")
  .split(",")
  .map((clientId) => clientId.trim())
  .filter(Boolean);
