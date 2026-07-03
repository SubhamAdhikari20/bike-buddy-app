// backend/src/schemas/user.schema.ts
import { z } from "zod";


export const fullNameValidation = z
    .string()
    .min(3, { message: "Name must be atleast 3 characters long" })
    .max(20, { message: "Name must not exceed 20 characters" })
    .regex(/^[a-zA-Z ]+$/, { message: "Name must contain only alphabets and spaces" });

export const emailValidation = z
    .email({ message: "Invalid email address" })
    .min(5, { message: "Email must be atleast 5 characters long" })
    .max(50, { message: "Email must not exceed 50 characters" });

export const phoneNumberValidation = z
    .string()
    .min(10, { message: "Phone number must be 10 digits long" })
    .max(10, { message: "Phone number must be 10 digits long" })
    .regex(/^[0-9]+$/, { message: "Phone number must contain only digits" });

export const passwordValidation = z
    .string()
    .min(8, { message: "Password must be atleast 8 characters long" })
    .max(20, { message: "Password must not exceed 20 characters" })
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,20}$/, { message: "Password must contain atleast 1 uppercase, 1 lowercase, 1 digit and 1 special character" });

export const confirmPasswordValidation = z
    .string()
    .min(8, { message: "Confirm Password must be atleast 8 characters long" })
    .max(20, { message: "Confirm Password must not exceed 20 characters" })
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,20}$/, { message: "Confirm Password must contain atleast 1 uppercase, 1 lowercase, 1 digit and 1 special character" });

// export const roleValidation = z
//     .enum(["admin", "owner", "renter"], {
//         error: "Role is required"
//     }).optional();

export const roleValidation = z
    .enum(["admin", "owner", "renter"]);

export const bioValidation = z
    .string()
    // .min(5, { message: "Bio must be atleast 5 characters long" })
    .max(500, { message: "Bio must not exceed 500 characters" })
    .nullish();

// export const termsAndConditionsValidation = z
//     .literal(true, { message: "You must accept the terms and conditions" });

export const termsAndConditionsValidation = z
    .boolean().refine((value) => value === true, {
        message: "You must accept the terms and conditions"
    });

export const otpValidation = z
    .string()
    .length(6, { message: "Verification code must be 6 characters long" })
    .regex(/^[0-9]+$/, { message: "Verification code must contain only digits" });

export const identifierValidation = z
    .string()
    .min(3, { message: "Identifier is required" });