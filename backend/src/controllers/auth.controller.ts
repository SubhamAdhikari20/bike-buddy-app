import type { RequestHandler } from "express";
import ApiResponse from "../utils/ApiResponse.ts";
import authService from "../services/auth.service.ts";

export const registerRenter: RequestHandler = async (req, res, next) => {
    try {
        const result = await authService.registerRenter(req.body);
        res.cookie("accessToken", result.token, { httpOnly: true, sameSite: "lax", secure: false });
        res.status(201).json(new ApiResponse(201, "Renter registered successfully", result));
    } catch (error) {
        next(error);
    }
};

export const registerOwner: RequestHandler = async (req, res, next) => {
    try {
        const result = await authService.registerOwner(req.body);
        res.cookie("accessToken", result.token, { httpOnly: true, sameSite: "lax", secure: false });
        res.status(201).json(new ApiResponse(201, "Owner registered successfully", result));
    } catch (error) {
        next(error);
    }
};

export const login: RequestHandler = async (req, res, next) => {
    try {
        const result = await authService.login(req.body);
        res.cookie("accessToken", result.token, { httpOnly: true, sameSite: "lax", secure: false });
        res.status(200).json(new ApiResponse(200, "Login successful", result));
    } catch (error) {
        next(error);
    }
};

export const logout: RequestHandler = async (req, res) => {
    res.clearCookie("accessToken");
    res.status(200).json(new ApiResponse(200, "Logout successful", { loggedOut: true }));
};

export const me: RequestHandler = async (req, res, next) => {
    try {
        const result = await authService.me(req.auth!);
        res.status(200).json(new ApiResponse(200, "Profile fetched successfully", result));
    } catch (error) {
        next(error);
    }
};

export const updateProfile: RequestHandler = async (req, res, next) => {
    try {
        const result = await authService.updateProfile(req.auth!, req.body);
        res.status(200).json(new ApiResponse(200, "Profile updated successfully", result));
    } catch (error) {
        next(error);
    }
};

export const forgotPassword: RequestHandler = async (req, res, next) => {
    try {
        const result = await authService.forgotPassword(req.body);
        res.status(200).json(new ApiResponse(200, "Password reset token generated", result));
    } catch (error) {
        next(error);
    }
};

export const resetPassword: RequestHandler = async (req, res, next) => {
    try {
        const result = await authService.resetPassword(req.body);
        res.status(200).json(new ApiResponse(200, "Password reset successful", result));
    } catch (error) {
        next(error);
    }
};

export const assignRole: RequestHandler = async (req, res, next) => {
    try {
        const result = await authService.assignRole(req.auth!.userId, req.body);
        res.status(200).json(new ApiResponse(200, "Role updated successfully", result));
    } catch (error) {
        next(error);
    }
};
