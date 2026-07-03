// backend/src/types/user.type.ts
import { z } from "zod";
import type { IUser } from "./../models/user.model.ts";


const userSchema = z.object({
    email: z.email().min(5).max(50),
    role: z.enum(["admin", "owner", "renter"]),
    isVerified: z.boolean(),
    verifyCode: z.string().nullish(),
    verifyCodeExpiryDate: z.date().nullish(),
    verifyEmailResetPassword: z.string().nullish(),
    verifyEmailResetPasswordExpiryDate: z.date().nullish(),
});

export type User = z.infer<typeof userSchema>;

export type UserDocument = IUser;