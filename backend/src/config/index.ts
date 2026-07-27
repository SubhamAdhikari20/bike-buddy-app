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
const configuredJwtSecret = process.env.JWT_SECRET?.trim();

if (
  IS_PRODUCTION &&
  (!configuredJwtSecret || configuredJwtSecret.length < 32)
) {
  throw new Error(
    "JWT_SECRET must be configured with at least 32 characters in production",
  );
}

export const JWT_SECRET: string =
  configuredJwtSecret ||
  "bike-buddy-development-secret-change-before-production";
export const JWT_SIGNUP_EXPIRES_IN: string =
  process.env.JWT_SIGNUP_EXPIRES_IN || "1d";
export const JWT_LOGIN_EXPIRES_IN: string =
  process.env.JWT_LOGIN_EXPIRES_IN || "30d";
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
  configuredPaymentMode !== "live"
) {
  throw new Error("PAYMENT_MODE must be either demo or live");
}
export const PAYMENT_MODE: "demo" | "live" =
  configuredPaymentMode === "live" ? "live" : "demo";
export const GOOGLE_CLIENT_IDS: string[] = (process.env.GOOGLE_CLIENT_IDS || "")
  .split(",")
  .map((clientId) => clientId.trim())
  .filter(Boolean);
