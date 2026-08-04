import { z } from "zod";
import {
  emailValidation,
  passwordValidation,
  fullNameValidation,
  phoneNumberValidation,
  bioValidation,
  termsAndConditionsValidation,
  roleValidation,
} from "./user.schema.ts";
import { mediaUrlValidation } from "./media.schema.ts";

export const loginSchema = z
  .object({
    email: emailValidation,
    password: passwordValidation,
  })
  .strict();

export const registerRenterSchema = z
  .object({
    fullName: fullNameValidation,
    email: emailValidation,
    phoneNumber: phoneNumberValidation.nullish(),
    password: passwordValidation,
    bio: bioValidation,
    terms: termsAndConditionsValidation,
  })
  .strict();

export const registerOwnerSchema = z
  .object({
    fullName: fullNameValidation,
    email: emailValidation,
    phoneNumber: phoneNumberValidation,
    password: passwordValidation,
    bio: bioValidation,
    profilePictureUrl: mediaUrlValidation.nullish(),
  })
  .strict();

export const updateProfileSchema = z
  .object({
    fullName: fullNameValidation.optional(),
    phoneNumber: phoneNumberValidation.nullish().optional(),
    bio: bioValidation.optional(),
    profilePictureUrl: mediaUrlValidation.nullish().optional(),
  })
  .strict();

export const forgotPasswordSchema = z
  .object({
    email: emailValidation,
  })
  .strict();

export const resetPasswordSchema = z
  .object({
    email: emailValidation,
    code: z
      .string()
      .length(6, "Code must be 6 digits")
      .regex(/^\d{6}$/, "Code must be 6 digits"),
    password: passwordValidation,
  })
  .strict();

export const googleRenterAuthSchema = z
  .object({
    idToken: z.string().min(100, "Google ID token is required"),
    terms: z.literal(true, {
      error: "You must accept the terms and conditions",
    }),
  })
  .strict();

export const adminAssignRoleSchema = z
  .object({
    userId: z.string().min(1),
    role: roleValidation,
  })
  .strict();

export const sendOtpSchema = z
  .object({
    email: emailValidation,
  })
  .strict();

export const verifyOtpSchema = z
  .object({
    email: emailValidation,
    code: z
      .string()
      .length(6, "Code must be 6 digits")
      .regex(/^\d{6}$/, "Code must be 6 digits"),
  })
  .strict();

export const submitKycSchema = z
  .object({
    idDocumentUrl: mediaUrlValidation,
  })
  .strict();
