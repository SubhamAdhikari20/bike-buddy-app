import { Router } from "express";
import { authenticate, authorize } from "../middlewares/auth.ts";
import validate from "../middlewares/validate.ts";
import { adminAssignRoleSchema, forgotPasswordSchema, loginSchema, registerOwnerSchema, registerRenterSchema, resetPasswordSchema, updateProfileSchema } from "../schemas/auth.schema.ts";
import { assignRole, forgotPassword, login, logout, me, registerOwner, registerRenter, resetPassword, updateProfile } from "../controllers/auth.controller.ts";

const authRoutes = Router();

authRoutes.post("/register/renter", validate(registerRenterSchema), registerRenter);
authRoutes.post("/register/owner", validate(registerOwnerSchema), registerOwner);
authRoutes.post("/login", validate(loginSchema), login);
authRoutes.post("/logout", authenticate, logout);
authRoutes.get("/me", authenticate, me);
authRoutes.patch("/profile", authenticate, validate(updateProfileSchema), updateProfile);
authRoutes.post("/forgot-password", validate(forgotPasswordSchema), forgotPassword);
authRoutes.post("/reset-password", validate(resetPasswordSchema), resetPassword);
authRoutes.patch("/assign-role", authenticate, authorize("admin"), validate(adminAssignRoleSchema), assignRole);

export default authRoutes;
