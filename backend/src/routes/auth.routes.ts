import { Router } from "express";
import { authenticate, authorize } from "../middlewares/auth.ts";
import validate from "../middlewares/validate.ts";
import { adminAssignRoleSchema, forgotPasswordSchema, loginSchema, registerOwnerSchema, registerRenterSchema, resetPasswordSchema, sendOtpSchema, submitKycSchema, updateProfileSchema, verifyOtpSchema } from "../schemas/auth.schema.ts";
import { assignRole, deleteAccount, forgotPassword, getKycStatus, login, logout, me, registerOwner, registerRenter, resetPassword, sendOtp, submitKyc, updateProfile, verifyOtp } from "../controllers/auth.controller.ts";

const authRoutes = Router();

authRoutes.post("/register/renter", validate(registerRenterSchema), registerRenter);
authRoutes.post("/register/owner", validate(registerOwnerSchema), registerOwner);
authRoutes.post("/login", validate(loginSchema), login);
authRoutes.post("/logout", authenticate, logout);
authRoutes.get("/me", authenticate, me);
authRoutes.patch("/profile", authenticate, validate(updateProfileSchema), updateProfile);
authRoutes.post("/send-otp", validate(sendOtpSchema), sendOtp);
authRoutes.post("/verify-otp", validate(verifyOtpSchema), verifyOtp);
authRoutes.post("/kyc", authenticate, validate(submitKycSchema), submitKyc);
authRoutes.get("/kyc", authenticate, getKycStatus);
authRoutes.delete("/account", authenticate, deleteAccount);
authRoutes.post("/forgot-password", validate(forgotPasswordSchema), forgotPassword);
authRoutes.post("/reset-password", validate(resetPasswordSchema), resetPassword);
authRoutes.patch("/assign-role", authenticate, authorize("admin"), validate(adminAssignRoleSchema), assignRole);

export default authRoutes;
