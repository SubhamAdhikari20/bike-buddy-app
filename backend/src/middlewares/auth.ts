import type { RequestHandler } from "express";
import AppError from "../errors/AppError.ts";
import { verifyToken } from "../utils/jwt.ts";
import type { AuthRole } from "../interfaces/auth.interface.ts";
import UserModel from "../models/user.model.ts";

export const authenticate: RequestHandler = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : req.cookies?.accessToken;

  if (!token) {
    next(new AppError(401, "Authentication required", "UNAUTHORIZED"));
    return;
  }

  try {
    const auth = verifyToken(token);
    const accountExists = await UserModel.exists({ _id: auth.userId });
    if (!accountExists) {
      next(new AppError(401, "Account no longer exists", "UNAUTHORIZED"));
      return;
    }
    req.auth = auth;
    next();
  } catch {
    next(new AppError(401, "Invalid or expired token", "UNAUTHORIZED"));
  }
};

export const authorize = (...allowedRoles: AuthRole[]): RequestHandler => {
  return (req, res, next) => {
    if (!req.auth) {
      next(new AppError(401, "Authentication required", "UNAUTHORIZED"));
      return;
    }

    if (!allowedRoles.includes(req.auth.role)) {
      next(
        new AppError(
          403,
          "You do not have permission to access this resource",
          "FORBIDDEN",
        ),
      );
      return;
    }

    next();
  };
};
