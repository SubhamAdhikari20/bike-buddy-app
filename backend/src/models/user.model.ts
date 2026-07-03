// src/models/user.model.ts
import mongoose, { Schema, Document } from "mongoose";
import type { User } from "./../types/user.type.ts";


export interface IUser extends User, Document {
    createdAt: Date;
    updatedAt: Date;
}

const userSchema: Schema<IUser> = new Schema({
    email: {
        type: String,
        required: [true, "Email is required"],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, "Invalid email format"]
    },
    role: {
        type: String,
        enum: ["admin", "owner", "renter"],
        default: "renter"
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    verifyCode: {
        type: String,
        default: null
    },
    verifyCodeExpiryDate: {
        type: Date,
        default: null
    },
    verifyEmailResetPassword: {
        type: String,
        default: null
    },
    verifyEmailResetPasswordExpiryDate: {
        type: Date,
        default: null
    },
},
    {
        timestamps: true
    }
);

const UserModel = (mongoose.models.users as mongoose.Model<IUser>) ?? (mongoose.model<IUser>("users", userSchema));

export default UserModel;