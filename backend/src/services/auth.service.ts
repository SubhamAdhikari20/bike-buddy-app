import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import AppError from "../errors/AppError.ts";
import { comparePassword, hashPassword } from "../utils/password.ts";
import { signToken } from "../utils/jwt.ts";
import { GOOGLE_CLIENT_IDS, JWT_LOGIN_EXPIRES_IN } from "../config/index.ts";
import { sendOtpEmail } from "../helpers/send-otp-email.ts";
import { sendResetPasswordVerificationEmail } from "../helpers/send-reset-password-verification-email.ts";
import { userRepository } from "../repositories/user.repository.ts";
import { ownerRepository } from "../repositories/owner.repository.ts";
import { renterRepository } from "../repositories/renter.repository.ts";
import { adminRepository } from "../repositories/admin.repository.ts";
import type { AuthRole } from "../interfaces/auth.interface.ts";
import { toSafeProfile, toSafeUser } from "../utils/auth-response.ts";
import BookingModel from "../models/booking.model.ts";
import BikeModel from "../models/bike.model.ts";
import SupportTicketModel from "../models/support-ticket.model.ts";
import SosAlertModel from "../models/sos-alert.model.ts";
import DamageReportModel from "../models/damage-report.model.ts";
import ReviewModel from "../models/review.model.ts";

const googleClient = new OAuth2Client();

const buildSession = (baseUser: any, profile: any, role: AuthRole) => {
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
    user: toSafeUser(baseUser),
    profile: toSafeProfile(profile),
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

const getProfileByUser = async (user: any, includePassword = false) => {
  const repository = getProfileRepository(user.role as AuthRole);
  if (includePassword) {
    return repository.findByBaseUserIdWithPassword(user._id.toString());
  }
  return repository.findByBaseUserId(user._id.toString());
};

const createBaseUser = async (
  email: string,
  role: AuthRole,
  isVerified = false,
) => {
  return userRepository.create({
    email: email.trim().toLowerCase(),
    role,
    isVerified,
  });
};

const authService = {
  async registerRenter(payload: {
    fullName: string;
    email: string;
    phoneNumber?: string | null;
    password: string;
    bio?: string | null;
    terms: boolean;
  }) {
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
        ...(payload.phoneNumber ? { phoneNumber: payload.phoneNumber } : {}),
        password: passwordHash,
        profilePictureUrl: null,
        bio: payload.bio ?? null,
        terms: payload.terms,
      });

      return buildSession(baseUser, profile, "renter");
    } catch (error) {
      await userRepository.deleteById(baseUser._id.toString());
      throw error;
    }
  },

  async registerOwner(payload: {
    fullName: string;
    email: string;
    phoneNumber: string;
    password: string;
    bio?: string | null;
    profilePictureUrl?: string | null;
  }) {
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

    const profile = await getProfileByUser(baseUser, true);
    if (!profile || !profile.password) {
      throw new AppError(401, "Invalid email or password", "UNAUTHORIZED");
    }

    const isPasswordValid = await comparePassword(
      payload.password,
      profile.password,
    );
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
      user: toSafeUser(baseUser),
      profile: toSafeProfile(profile),
    };
  },

  async updateProfile(
    auth: { userId: string; role: AuthRole },
    payload: {
      fullName?: string;
      phoneNumber?: string | null;
      bio?: string | null;
      profilePictureUrl?: string | null;
    },
  ) {
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
      user: toSafeUser(baseUser),
      profile: toSafeProfile(updatedProfile),
    };
  },

  async forgotPassword(payload: { email: string }) {
    const baseUser = await userRepository.findByEmail(payload.email);
    if (!baseUser) {
      return {
        message:
          "If an account exists for that email, a reset code has been sent.",
        expiresInMinutes: 15,
      };
    }

    const resetCode = String(crypto.randomInt(100000, 1000000));
    const resetTokenHash = crypto
      .createHash("sha256")
      .update(resetCode)
      .digest("hex");
    await userRepository.updateById(baseUser._id.toString(), {
      verifyEmailResetPassword: resetTokenHash,
      verifyEmailResetPasswordExpiryDate: new Date(Date.now() + 15 * 60 * 1000),
    });

    const profile = await getProfileByUser(baseUser);
    await sendResetPasswordVerificationEmail(
      String(profile?.fullName ?? "there"),
      baseUser.email,
      resetCode,
    );

    return {
      message:
        "If an account exists for that email, a reset code has been sent.",
      expiresInMinutes: 15,
    };
  },

  async resetPassword(payload: {
    email: string;
    code: string;
    password: string;
  }) {
    const tokenHash = crypto
      .createHash("sha256")
      .update(payload.code)
      .digest("hex");
    const users = await userRepository.list({
      email: payload.email.trim().toLowerCase(),
      verifyEmailResetPassword: tokenHash,
      verifyEmailResetPasswordExpiryDate: { $gt: new Date() },
    });

    const baseUser = users[0];
    if (!baseUser) {
      throw new AppError(
        400,
        "Reset token is invalid or expired",
        "BAD_REQUEST",
      );
    }

    const repository = getProfileRepository(baseUser.role as AuthRole);
    const profile = await repository.findByBaseUserId(baseUser._id.toString());
    if (!profile) {
      throw new AppError(404, "Profile not found", "NOT_FOUND");
    }

    const passwordHash = await hashPassword(payload.password);
    await repository.updateById(profile._id.toString(), {
      password: passwordHash,
    });
    await userRepository.updateById(baseUser._id.toString(), {
      verifyEmailResetPassword: null,
      verifyEmailResetPasswordExpiryDate: null,
    });

    return { message: "Password reset successfully" };
  },

  async googleRenterAuth(payload: { idToken: string; terms: true }) {
    if (GOOGLE_CLIENT_IDS.length === 0) {
      throw new AppError(
        503,
        "Google sign-in is not configured",
        "GOOGLE_AUTH_NOT_CONFIGURED",
      );
    }

    let googlePayload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: payload.idToken,
        audience: GOOGLE_CLIENT_IDS,
      });
      googlePayload = ticket.getPayload();
    } catch {
      throw new AppError(
        401,
        "Google sign-in could not be verified",
        "UNAUTHORIZED",
      );
    }

    if (
      !googlePayload?.sub ||
      !googlePayload.email ||
      googlePayload.email_verified !== true
    ) {
      throw new AppError(
        401,
        "Google account email is not verified",
        "UNAUTHORIZED",
      );
    }

    const email = googlePayload.email.trim().toLowerCase();
    let baseUser = await userRepository.findByEmail(email);

    if (baseUser && baseUser.role !== "renter") {
      throw new AppError(
        403,
        "Google sign-in is available only for renter accounts",
        "FORBIDDEN",
      );
    }

    if (!baseUser) {
      baseUser = await createBaseUser(email, "renter", true);
      try {
        const profile = await renterRepository.create({
          baseUserId: baseUser._id,
          fullName:
            googlePayload.name?.trim() ||
            email.split("@")[0] ||
            "Bike Buddy renter",
          phoneNumber: null,
          password: null,
          profilePictureUrl: googlePayload.picture ?? null,
          googleId: googlePayload.sub,
          bio: null,
          terms: payload.terms,
        });
        return buildSession(baseUser, profile, "renter");
      } catch (error) {
        await userRepository.deleteById(baseUser._id.toString());
        throw error;
      }
    }

    const existingProfile = await renterRepository.findByBaseUserId(
      baseUser._id.toString(),
    );
    if (!existingProfile) {
      throw new AppError(
        409,
        "This account is missing its renter profile",
        "ACCOUNT_CONFIGURATION_ERROR",
      );
    }
    if (
      existingProfile.googleId &&
      existingProfile.googleId !== googlePayload.sub
    ) {
      throw new AppError(
        409,
        "This email is already linked to a different Google account",
        "CONFLICT",
      );
    }

    const profile =
      (await renterRepository.updateById(existingProfile._id.toString(), {
        googleId: googlePayload.sub,
        profilePictureUrl:
          existingProfile.profilePictureUrl ?? googlePayload.picture ?? null,
      })) ?? existingProfile;

    if (!baseUser.isVerified) {
      baseUser =
        (await userRepository.updateById(baseUser._id.toString(), {
          isVerified: true,
        })) ?? baseUser;
    }

    return buildSession(baseUser, profile, "renter");
  },

  async sendOtp(payload: { email: string }) {
    const baseUser = await userRepository.findByEmail(payload.email);
    if (!baseUser) {
      throw new AppError(
        404,
        "No account found with this email. Please sign up first.",
        "NOT_FOUND",
      );
    }

    const otp = String(crypto.randomInt(100000, 1000000));
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
    await userRepository.updateById(baseUser._id.toString(), {
      verifyCode: otpHash,
      verifyCodeExpiryDate: new Date(Date.now() + 10 * 60 * 1000),
    });

    const profile = await getProfileByUser(baseUser);
    const emailResult = await sendOtpEmail(
      profile?.fullName ?? "there",
      baseUser.email,
      otp,
    );
    if (!emailResult.success) {
      throw new AppError(
        500,
        "Could not send the OTP email. Please try again.",
        "EMAIL_FAILED",
      );
    }

    return {
      email: baseUser.email,
      expiresInMinutes: 10,
      resendAfterSeconds: 30,
    };
  },

  async verifyOtp(payload: { email: string; code: string }) {
    const baseUser = await userRepository.findByEmail(payload.email);
    if (!baseUser) {
      throw new AppError(404, "No account found with this email.", "NOT_FOUND");
    }

    const codeHash = crypto
      .createHash("sha256")
      .update(payload.code)
      .digest("hex");
    const isCodeValid = baseUser.verifyCode === codeHash;
    const isCodeAlive =
      baseUser.verifyCodeExpiryDate &&
      new Date(baseUser.verifyCodeExpiryDate) > new Date();

    if (!isCodeValid || !isCodeAlive) {
      throw new AppError(
        401,
        "The code is wrong or has expired. Please request a new one.",
        "UNAUTHORIZED",
      );
    }

    await userRepository.updateById(baseUser._id.toString(), {
      verifyCode: null,
      verifyCodeExpiryDate: null,
      isVerified: true,
    });

    const profile = await getProfileByUser(baseUser);
    if (!profile) {
      throw new AppError(401, "Invalid account configuration", "UNAUTHORIZED");
    }

    return buildSession(baseUser, profile, baseUser.role as AuthRole);
  },

  async submitKyc(
    auth: { userId: string; role: AuthRole },
    payload: { idDocumentUrl: string },
  ) {
    if (auth.role !== "renter") {
      throw new AppError(
        403,
        "Only renters submit ID verification",
        "FORBIDDEN",
      );
    }

    const renter = await renterRepository.findByBaseUserId(auth.userId);
    if (!renter) {
      throw new AppError(404, "Profile not found", "NOT_FOUND");
    }

    if (renter.kycStatus === "approved") {
      throw new AppError(409, "Your ID is already verified", "CONFLICT");
    }

    const updated = await renterRepository.updateById(renter._id.toString(), {
      idDocumentUrl: payload.idDocumentUrl,
      kycStatus: "pending",
      kycSubmittedAt: new Date(),
    });

    return {
      kycStatus: updated?.kycStatus,
      kycSubmittedAt: updated?.kycSubmittedAt,
      reviewNotice:
        "Your ID is queued for administrator review. No review time is guaranteed.",
    };
  },

  async getKycStatus(auth: { userId: string; role: AuthRole }) {
    if (auth.role !== "renter") {
      return { kycStatus: "approved" };
    }

    const renter = await renterRepository.findByBaseUserId(auth.userId);
    if (!renter) {
      throw new AppError(404, "Profile not found", "NOT_FOUND");
    }

    return {
      kycStatus: renter.kycStatus ?? "unverified",
      kycSubmittedAt: renter.kycSubmittedAt ?? null,
    };
  },

  async deleteAccount(auth: { userId: string; role: AuthRole }) {
    if (auth.role === "admin") {
      throw new AppError(
        403,
        "Administrator accounts require an operator-managed offboarding process",
        "FORBIDDEN",
      );
    }
    const baseUser = await userRepository.findById(auth.userId);
    if (!baseUser) {
      throw new AppError(404, "User not found", "NOT_FOUND");
    }

    const repository = getProfileRepository(auth.role);
    const profile = await repository.findByBaseUserId(auth.userId);
    const profileId = profile?._id.toString();
    if (profileId) {
      const activeStatuses = ["pending", "confirmed"] as const;
      const activeBookingFilter =
        auth.role === "owner"
          ? { ownerId: profileId, status: { $in: activeStatuses } }
          : { renterId: profileId, status: { $in: activeStatuses } };
      const activeBookingExists = await BookingModel.exists(
        activeBookingFilter,
      );
      if (activeBookingExists) {
        throw new AppError(
          409,
          "Cancel or complete active bookings before deleting this account",
          "ACTIVE_BOOKINGS",
        );
      }
      if (
        auth.role === "owner" &&
        (await BikeModel.exists({ ownerId: profileId }))
      ) {
        throw new AppError(
          409,
          "Remove your bike listings before deleting the owner account",
          "ACTIVE_LISTINGS",
        );
      }
    }

    await Promise.all([
      SupportTicketModel.deleteMany({ userId: auth.userId }),
      SosAlertModel.deleteMany({ userId: auth.userId }),
      DamageReportModel.deleteMany({ reportedBy: auth.userId }),
      ReviewModel.deleteMany({ userId: auth.userId }),
    ]);
    if (profile) {
      await repository.deleteById(profile._id.toString());
    }
    await userRepository.deleteById(auth.userId);

    return {
      deleted: true,
      retainedRecords:
        "Historical booking and payment records may remain without an active identity profile.",
    };
  },
};

export default authService;
