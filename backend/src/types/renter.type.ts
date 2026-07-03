// backend/src/types/renter.type.ts
import { z } from "zod";
import { fullNameValidation, phoneNumberValidation, passwordValidation, bioValidation, termsAndConditionsValidation } from "./../schemas/user.schema.ts";
import type { IRenter } from "./../models/renter.model.ts";


const renterSchema = z.object({
    fullName: fullNameValidation,
    phoneNumber: phoneNumberValidation.nullish(),
    password: passwordValidation.nullish(),
    terms: termsAndConditionsValidation,
    baseUserId: z.string(),
    profilePictureUrl: z.string().nullish(),

    googleId: z.string().nullish(),
    bio: bioValidation,
});

export type Renter = z.infer<typeof renterSchema>;

export type RenterDocument = IRenter;


// Google Provider
const googleProviderRenterSchema = z.object({
    fullName: fullNameValidation,
    phoneNumber: phoneNumberValidation.nullish(),
    password: passwordValidation.nullish(),
    terms: termsAndConditionsValidation,
    baseUserId: z.string(),
    profilePictureUrl: z.string().nullish(),

    googleId: z.string().nullish(),
    bio: bioValidation,
});

export type ProviderRenter = z.infer<typeof googleProviderRenterSchema>;