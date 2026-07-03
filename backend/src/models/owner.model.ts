// backend/src/models/owner.model.ts
import mongoose, { Schema, Document } from "mongoose";
import type { Owner } from "./../types/owner.type.ts";


export interface IOwner extends Omit<Owner, "baseUserId">, Document {
    baseUserId: Schema.Types.ObjectId | string,
    createdAt: Date;
    updatedAt: Date;
}

const ownerSchema: Schema<IOwner> = new Schema({
    baseUserId: {
        type: Schema.Types.ObjectId,
        ref: "users",
        required: true,
        unique: true
    },
    fullName: {
        type: String,
        required: [true, "Full name is required"],
        trim: true
    },
    phoneNumber: {
        type: String,
        required: [true, "Phone number is required"],
        unique: true,
        trim: true,
        minLength: [10, "Phone number must be 10 digits"],
        maxLength: [10, "Phone number must be 10 digits"],
    },
    password: {
        type: String,
        minLength: [8, "Password must be at least 8 characters"],
        default: null
    },
    profilePictureUrl: {
        type: String,
        default: null
    },
    bio: {
        type: String,
        maxLength: [500, "Bio cannot exceed 500 characters"],
        default: null
    },
    ownerNotes: {
        type: String,
        default: null
    },
    ownerStatus: {
        type: String,
        enum: ["none", "pending", "verified", "rejected"],
        default: "none"
    },
    ownerVerificationDate: {
        type: Date,
        default: null
    },
},
    {
        timestamps: true
    }
);

const OwnerModel = (mongoose.models.owners as mongoose.Model<IOwner>) ?? (mongoose.model<IOwner>("owners", ownerSchema));

export default OwnerModel;