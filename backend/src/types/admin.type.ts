// backend/src/types/admin.type.ts
import { z } from "zod";
import { fullNameValidation, phoneNumberValidation, passwordValidation } from "./../schemas/user.schema.ts";
import type { IAdmin } from "./../models/admin.model.ts";


const adminSchema = z.object({
    fullName: fullNameValidation,
    phoneNumber: phoneNumberValidation,
    password: passwordValidation,
    profilePictureUrl: z.string().nullish(),
    baseUserId: z.string(),
});

export type Admin = z.infer<typeof adminSchema>;

export type AdminDocument = IAdmin;