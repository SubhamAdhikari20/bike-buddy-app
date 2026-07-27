import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authenticate } from "../middlewares/auth.ts";
import validate from "../middlewares/validate.ts";
import {
  forgotPasswordSchema,
  googleRenterAuthSchema,
  loginSchema,
  registerOwnerSchema,
  registerRenterSchema,
  resetPasswordSchema,
  sendOtpSchema,
  submitKycSchema,
  updateProfileSchema,
  verifyOtpSchema,
} from "../schemas/auth.schema.ts";
import {
  deleteAccount,
  forgotPassword,
  getKycStatus,
  googleRenterAuth,
  login,
  logout,
  me,
  registerOwner,
  registerRenter,
  resetPassword,
  sendOtp,
  submitKyc,
  updateProfile,
  verifyOtp,
} from "../controllers/auth.controller.ts";

const authRoutes = Router();

const authenticationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many authentication attempts. Try again in 15 minutes.",
      code: "RATE_LIMITED",
    });
  },
});

const emailCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many code requests. Try again in 15 minutes.",
      code: "RATE_LIMITED",
    });
  },
});

authRoutes.post(
  "/register/renter",
  authenticationLimiter,
  validate(registerRenterSchema),
  registerRenter,
);
authRoutes.post(
  "/register/owner",
  authenticationLimiter,
  validate(registerOwnerSchema),
  registerOwner,
);
authRoutes.post("/login", authenticationLimiter, validate(loginSchema), login);
authRoutes.post(
  "/google/renter",
  authenticationLimiter,
  validate(googleRenterAuthSchema),
  googleRenterAuth,
);
authRoutes.post("/logout", authenticate, logout);
authRoutes.get("/me", authenticate, me);
authRoutes.patch(
  "/profile",
  authenticate,
  validate(updateProfileSchema),
  updateProfile,
);
authRoutes.post(
  "/send-otp",
  emailCodeLimiter,
  validate(sendOtpSchema),
  sendOtp,
);
authRoutes.post(
  "/verify-otp",
  authenticationLimiter,
  validate(verifyOtpSchema),
  verifyOtp,
);
authRoutes.post("/kyc", authenticate, validate(submitKycSchema), submitKyc);
authRoutes.get("/kyc", authenticate, getKycStatus);
authRoutes.delete("/account", authenticate, deleteAccount);
authRoutes.post(
  "/forgot-password",
  emailCodeLimiter,
  validate(forgotPasswordSchema),
  forgotPassword,
);
authRoutes.post(
  "/reset-password",
  authenticationLimiter,
  validate(resetPasswordSchema),
  resetPassword,
);

export default authRoutes;
