import { z } from "zod";
import { loginSchema, registerOwnerSchema, registerRenterSchema, updateProfileSchema, forgotPasswordSchema, resetPasswordSchema } from "./../schemas/auth.schema.ts";

export type LoginDTO = z.infer<typeof loginSchema>;
export type RegisterRenterDTO = z.infer<typeof registerRenterSchema>;
export type RegisterOwnerDTO = z.infer<typeof registerOwnerSchema>;
export type UpdateProfileDTO = z.infer<typeof updateProfileSchema>;
export type ForgotPasswordDTO = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordDTO = z.infer<typeof resetPasswordSchema>;
