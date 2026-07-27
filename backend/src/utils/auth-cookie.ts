import type { CookieOptions } from "express";
import { IS_PRODUCTION, JWT_LOGIN_EXPIRES_IN } from "../config/index.ts";

const durationPattern = /^(\d+)(s|m|h|d)$/;

export const durationToMilliseconds = (duration: string): number => {
  const match = duration.trim().match(durationPattern);
  if (!match) {
    return 30 * 24 * 60 * 60 * 1000;
  }

  const value = Number(match[1]);
  const multiplier = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  }[match[2] as "s" | "m" | "h" | "d"];

  return value * multiplier;
};

export const authCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: IS_PRODUCTION ? "none" : "lax",
  path: "/",
  maxAge: durationToMilliseconds(JWT_LOGIN_EXPIRES_IN),
};

export const clearAuthCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: IS_PRODUCTION ? "none" : "lax",
  path: "/",
};
