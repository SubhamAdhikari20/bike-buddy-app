import crypto from "crypto";
import AppError from "../errors/AppError.ts";
import { comparePassword, hashPassword } from "../utils/password.ts";
import { signToken } from "../utils/jwt.ts";
import { JWT_LOGIN_EXPIRES_IN, JWT_SIGNUP_EXPIRES_IN } from "../config/index.ts";
import { userRepository } from "../repositories/user.repository.ts";
import { ownerRepository } from "../repositories/owner.repository.ts";
import { renterRepository } from "../repositories/renter.repository.ts";
import { adminRepository } from "../repositories/admin.repository.ts";
import type { AuthRole } from "../interfaces/auth.interface.ts";

const buildSession = async (baseUser: any, profile: any, role: AuthRole) => {
    const token = signToken(
        {
            userId: baseUser._id.toString(),
            role,
            profileId: profile?._id?.toString(),
        },
        JWT_LOGIN_EXPIRES_IN,
    );

    return {
        token,
        expiresIn: JWT_LOGIN_EXPIRES_IN,
        user: {
            id: baseUser._id.toString(),
            email: baseUser.email,
            role: baseUser.role,
            isVerified: baseUser.isVerified,
        },
        profile,
    };
};

const getProfileRepository = (role: AuthRole) => {
    if (role === "owner") {
        return ownerRepository;
    }

    if (role === "admin") {
        return adminRepository;
    }

    return renterRepository;
};

const getProfileByUser = async (user: any) => {
    const repository = getProfileRepository(user.role as AuthRole);
    return repository.findByBaseUserId(user._id.toString());
};

const createBaseUser = async (email: string, role: AuthRole) => {
    return userRepository.create({
        email,
        role,
        isVerified: true,
    });
};

const authService = {
    async registerRenter(payload: { fullName: string; email: string; phoneNumber?: string | null; password: string; bio?: string | null; terms: boolean }) {
        const existingUser = await userRepository.findByEmail(payload.email);
        if (existingUser) {
            throw new AppError(409, "Email is already registered", "CONFLICT");
        }

        const baseUser = await createBaseUser(payload.email, "renter");
        try {
            const passwordHash = await hashPassword(payload.password);
            const profile = await renterRepository.create({
                baseUserId: baseUser._id,
                fullName: payload.fullName,
                phoneNumber: payload.phoneNumber ?? null,
                password: passwordHash,
                profilePictureUrl: null,
                googleId: null,
                bio: payload.bio ?? null,
                terms: payload.terms,
            });

            return buildSession(baseUser, profile, "renter");
        } catch (error) {
            await userRepository.deleteById(baseUser._id.toString());
            throw error;
        }
    },

    async registerOwner(payload: { fullName: string; email: string; phoneNumber: string; password: string; bio?: string | null; profilePictureUrl?: string | null }) {
        const existingUser = await userRepository.findByEmail(payload.email);
        if (existingUser) {
            throw new AppError(409, "Email is already registered", "CONFLICT");
        }

        const baseUser = await createBaseUser(payload.email, "owner");
        try {
            const passwordHash = await hashPassword(payload.password);
            const profile = await ownerRepository.create({
                baseUserId: baseUser._id,
                fullName: payload.fullName,
                phoneNumber: payload.phoneNumber,
                password: passwordHash,
                profilePictureUrl: payload.profilePictureUrl ?? null,
                bio: payload.bio ?? null,
                ownerNotes: null,
                ownerStatus: "pending",
                ownerVerificationDate: null,
            });

            return buildSession(baseUser, profile, "owner");
        } catch (error) {
            await userRepository.deleteById(baseUser._id.toString());
            throw error;
        }
    },

    async login(payload: { email: string; password: string }) {
        const baseUser = await userRepository.findByEmail(payload.email);
        if (!baseUser) {
            throw new AppError(401, "Invalid email or password", "UNAUTHORIZED");
        }

        const profile = await getProfileByUser(baseUser);
        if (!profile || !profile.password) {
            throw new AppError(401, "Invalid account configuration", "UNAUTHORIZED");
        }

        const isPasswordValid = await comparePassword(payload.password, profile.password);
        if (!isPasswordValid) {
            throw new AppError(401, "Invalid email or password", "UNAUTHORIZED");
        }

        return buildSession(baseUser, profile, baseUser.role as AuthRole);
    },

    async me(auth: { userId: string; role: AuthRole }) {
        const baseUser = await userRepository.findById(auth.userId);
        if (!baseUser) {
            throw new AppError(404, "User not found", "NOT_FOUND");
        }

        const profile = await getProfileByUser(baseUser);
        return {
            user: baseUser,
            profile,
        };
    },

    async updateProfile(auth: { userId: string; role: AuthRole }, payload: { fullName?: string; phoneNumber?: string | null; bio?: string | null; profilePictureUrl?: string | null }) {
        const baseUser = await userRepository.findById(auth.userId);
        if (!baseUser) {
            throw new AppError(404, "User not found", "NOT_FOUND");
        }

        const repository = getProfileRepository(auth.role);
        const profile = await repository.findByBaseUserId(auth.userId);
        if (!profile) {
            throw new AppError(404, "Profile not found", "NOT_FOUND");
        }

        const updatedProfile = await repository.updateById(profile._id.toString(), {
            ...payload,
        });

        return {
            user: baseUser,
            profile: updatedProfile,
        };
    },

    async forgotPassword(payload: { email: string }) {
        const baseUser = await userRepository.findByEmail(payload.email);
        if (!baseUser) {
            throw new AppError(404, "User not found", "NOT_FOUND");
        }

        const resetToken = crypto.randomBytes(32).toString("hex");
        const resetTokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");
        await userRepository.updateById(baseUser._id.toString(), {
            verifyEmailResetPassword: resetTokenHash,
            verifyEmailResetPasswordExpiryDate: new Date(Date.now() + 60 * 60 * 1000),
        });

        return {
            resetToken,
            expiresIn: "1h",
        };
    },

    async resetPassword(payload: { token: string; password: string }) {
        const tokenHash = crypto.createHash("sha256").update(payload.token).digest("hex");
        const users = await userRepository.list({
            verifyEmailResetPassword: tokenHash,
            verifyEmailResetPasswordExpiryDate: { $gt: new Date() },
        });

        const baseUser = users[0];
        if (!baseUser) {
            throw new AppError(400, "Reset token is invalid or expired", "BAD_REQUEST");
        }

        const repository = getProfileRepository(baseUser.role as AuthRole);
        const profile = await repository.findByBaseUserId(baseUser._id.toString());
        if (!profile) {
            throw new AppError(404, "Profile not found", "NOT_FOUND");
        }

        const passwordHash = await hashPassword(payload.password);
        await repository.updateById(profile._id.toString(), { password: passwordHash });
        await userRepository.updateById(baseUser._id.toString(), {
            verifyEmailResetPassword: null,
            verifyEmailResetPasswordExpiryDate: null,
        });

        return { message: "Password reset successfully" };
    },

    async assignRole(adminUserId: string, payload: { userId: string; role: AuthRole }) {
        const targetUser = await userRepository.findById(payload.userId);
        if (!targetUser) {
            throw new AppError(404, "User not found", "NOT_FOUND");
        }

        const updated = await userRepository.updateById(payload.userId, { role: payload.role });
        return updated;
    },
};

export default authService;
