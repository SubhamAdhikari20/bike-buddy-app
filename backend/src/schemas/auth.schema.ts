import { z } from "zod";
import { emailValidation, passwordValidation, fullNameValidation, phoneNumberValidation, bioValidation, termsAndConditionsValidation, roleValidation } from "./user.schema.ts";

export const loginSchema = z.object({
    email: emailValidation,
    password: passwordValidation,
});

export const registerRenterSchema = z.object({
    fullName: fullNameValidation,
    email: emailValidation,
    phoneNumber: phoneNumberValidation.nullish(),
    password: passwordValidation,
    bio: bioValidation,
    terms: termsAndConditionsValidation,
});

export const registerOwnerSchema = z.object({
    fullName: fullNameValidation,
    email: emailValidation,
    phoneNumber: phoneNumberValidation,
    password: passwordValidation,
    bio: bioValidation,
    profilePictureUrl: z.string().url().nullish(),
});

export const updateProfileSchema = z.object({
    fullName: fullNameValidation.optional(),
    phoneNumber: phoneNumberValidation.nullish().optional(),
    bio: bioValidation.optional(),
    profilePictureUrl: z.string().url().nullish().optional(),
});

export const forgotPasswordSchema = z.object({
    email: emailValidation,
});

export const resetPasswordSchema = z.object({
    token: z.string().min(1),
    password: passwordValidation,
});

export const adminAssignRoleSchema = z.object({
    userId: z.string().min(1),
    role: roleValidation,
});

export const sendOtpSchema = z.object({
    email: emailValidation,
});

export const verifyOtpSchema = z.object({
    email: emailValidation,
    code: z.string().length(6, "Code must be 6 digits").regex(/^\d{6}$/, "Code must be 6 digits"),
});

export const submitKycSchema = z.object({
    idDocumentUrl: z.string().url(),
});
