// backend/src/types/user.type.ts
import { z } from "zod";
import { fullNameValidation, phoneNumberValidation, passwordValidation, bioValidation } from "./../schemas/user.schema.ts";
import type { IOwner } from "./../models/owner.model.ts";


const ownerSchema = z.object({
    fullName: fullNameValidation,
    phoneNumber: phoneNumberValidation,
    password: passwordValidation.nullish(),
    profilePictureUrl: z.string().nullish(),
    baseUserId: z.string(),
    bio: bioValidation,

    ownerNotes: z.string().nullish(),
    ownerStatus: z.enum(["none", "pending", "verified", "rejected"]),
    ownerVerificationDate: z.date().nullish(),
});

export type Owner = z.infer<typeof ownerSchema>;

export type OwnerDocument = IOwner;