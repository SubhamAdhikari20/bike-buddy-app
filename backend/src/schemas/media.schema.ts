import { z } from "zod";

const safeLocalMediaPath = (value: string) => {
  const match = value.match(
    /^\/(?:uploads\/(?:bike|profile)|api\/v1\/uploads\/(?:kyc|evidence))\/(.+)$/,
  );
  if (!match) return false;

  const segments = match[1]!.split("/");
  return segments.every(
    (segment) =>
      segment.length > 0 &&
      segment !== "." &&
      segment !== ".." &&
      /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(segment),
  );
};

/**
 * Accepts portable Bike Buddy upload paths and legacy HTTPS/HTTP media URLs.
 * Relative paths keep seeded and uploaded media independent of a developer's
 * localhost address; clients resolve them against their configured API host.
 */
export const mediaUrlValidation = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .refine((value) => {
    if (value.startsWith("/")) return safeLocalMediaPath(value);
    try {
      const parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }, "Use a valid web URL or Bike Buddy upload path")
  .transform((value) => {
    if (value.startsWith("/")) return value;
    const parsed = new URL(value);
    return safeLocalMediaPath(parsed.pathname) ? parsed.pathname : value;
  });
